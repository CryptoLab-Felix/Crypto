"""Shared, read-only ETH futures streams and a sequence-checked local book."""

import asyncio
import json
import logging
import random
import time
from contextlib import asynccontextmanager
from decimal import Decimal

import httpx
from websockets.asyncio.client import connect

from backend.binance_rest import FuturesRestGate, RestCooldownError

logger = logging.getLogger(__name__)
SYMBOL = "ETHUSDT"
DEPTH_URL = "wss://fstream.binance.com/public/ws/ethusdt@depth@100ms"
TRADE_URL = "wss://fstream.binance.com/market/ws/ethusdt@aggTrade"


def milliseconds():
    return int(time.time() * 1000)


def number(value, *, allow_zero=False):
    result = Decimal(value)
    if not result.is_finite() or result < 0 or (not allow_zero and result == 0):
        raise ValueError("Invalid price or quantity")
    return result


class OrderBook:
    def __init__(self, snapshot):
        self.bids = self.levels(snapshot["bids"])
        self.asks = self.levels(snapshot["asks"])
        self.last_id = int(snapshot["lastUpdateId"])
        self.synced = False
        # Levels outside the initial snapshot may be unknown, not empty.
        self.bid_floor = min(self.bids)
        self.ask_ceiling = max(self.asks)
        self.validate()

    @staticmethod
    def levels(rows):
        return {number(price): number(qty) for price, qty in rows}

    def validate(self):
        if not self.bids or not self.asks or max(self.bids) >= min(self.asks):
            raise ValueError("Empty or crossed order book; resynchronize")

    def apply(self, event):
        if event["s"] != SYMBOL or event["e"] != "depthUpdate":
            raise ValueError("Unexpected depth stream")
        first, last, previous = (int(event[key]) for key in ("U", "u", "pu"))
        if last < self.last_id or (self.synced and last == self.last_id):
            return False
        if not self.synced:
            if not first <= self.last_id <= last:
                raise ValueError("Snapshot does not overlap depth stream")
        elif previous != self.last_id:
            raise ValueError("Missing depth updates")
        for side, rows in ((self.bids, event["b"]), (self.asks, event["a"])):
            for raw_price, raw_qty in rows:
                price, qty = number(raw_price), number(raw_qty, allow_zero=True)
                if side is self.bids and price < self.bid_floor:
                    continue
                if side is self.asks and price > self.ask_ceiling:
                    continue
                if qty == 0:
                    side.pop(price, None)
                else:
                    side[price] = qty  # Updates contain absolute quantities.
        self.validate()
        # Bound memory while retaining only a fully known contiguous price range.
        for side, reverse in ((self.bids, True), (self.asks, False)):
            if len(side) > 1000:
                for price in sorted(side, reverse=reverse)[1000:]:
                    del side[price]
                if reverse:
                    self.bid_floor = min(side)
                else:
                    self.ask_ceiling = max(side)
        self.last_id, self.synced = last, True
        return True

    def export(self):
        return {
            name: [[format(p, "f"), format(side[p], "f")] for p in sorted(side, reverse=reverse)]
            for name, side, reverse in (("bids", self.bids, True), ("asks", self.asks, False))
        }


class EthMarketStream:
    """One pair of upstream connections per process, started only while viewed."""

    def __init__(self, client: httpx.AsyncClient, rest_gate: FuturesRestGate | None = None):
        self.client = client
        self.rest_gate = rest_gate if rest_gate is not None else FuturesRestGate()
        self.subscribers = set()
        self.tasks = []
        self.changed = asyncio.Event()
        self.reset()

    def reset(self):
        self.state = {
            "symbol": SYMBOL, "bids": [], "asks": [], "price": None,
            "book_status": "connecting", "price_status": "connecting",
            "book_time": None, "price_time": None,
            "book_received_at": None, "price_received_at": None,
            "book_message": None, "price_message": None,
        }

    @asynccontextmanager
    async def subscribe(self):
        queue = asyncio.Queue(maxsize=1)
        self.subscribers.add(queue)
        if not self.tasks:
            self.reset()
            self.tasks = [asyncio.create_task(job()) for job in (
                self.depth_loop, self.trade_loop, self.publish_loop,
            )]
        queue.put_nowait(self.payload())
        try:
            yield queue
        finally:
            self.subscribers.discard(queue)
            if not self.subscribers:
                await self.close()

    async def close(self):
        tasks, self.tasks = self.tasks, []
        for task in tasks:
            task.cancel()
        await asyncio.gather(*tasks, return_exceptions=True)

    def payload(self):
        payload = dict(self.state, server_time=milliseconds(), rest_cooldown=self.rest_gate.info())
        if payload["rest_cooldown"] and payload["book_status"] != "live":
            payload.update(book_status="reconnecting", book_message=payload["rest_cooldown"]["message"])
        return payload

    async def publish_loop(self):
        while True:
            try:
                await asyncio.wait_for(self.changed.wait(), timeout=1)
            except TimeoutError:
                pass
            self.changed.clear()
            payload = self.payload()
            for queue in tuple(self.subscribers):
                if queue.full():
                    queue.get_nowait()
                queue.put_nowait(payload)
            # Coalesce trade bursts, without buffering old frames for slow viewers.
            await asyncio.sleep(0.025)

    async def depth_loop(self):
        delay = 1
        while True:
            try:
                await self.rest_gate.wait()
                async with connect(DEPTH_URL, open_timeout=10, close_timeout=2,
                                   max_queue=2048, ping_interval=20, ping_timeout=10) as ws:
                    # websockets buffers incoming events while REST is in flight.
                    response = await self.rest_gate.get(
                        self.client,
                        "https://fapi.binance.com/fapi/v1/depth",
                        params={"symbol": SYMBOL, "limit": 1000},
                    )
                    response.raise_for_status()
                    book = OrderBook(response.json())
                    while True:
                        event = json.loads(await asyncio.wait_for(ws.recv(), timeout=5))
                        if book.apply(event):
                            self.state.update(book.export(), book_status="live",
                                              book_time=int(event["E"]),
                                              book_received_at=milliseconds(), book_message=None)
                            self.changed.set()
                            delay = 1
            except asyncio.CancelledError:
                raise
            except RestCooldownError as error:
                self.state.update(book_status="reconnecting", book_message=str(error))
                self.changed.set()
                # The next iteration waits on the shared, persistent deadline.
            except Exception as error:
                logger.warning("ETH depth reconnect: %s", type(error).__name__)
                self.state["book_status"] = "reconnecting"
                self.state["book_message"] = "盘口暂时不可用，正在自动重新同步。"
                if isinstance(error, httpx.HTTPStatusError) and error.response.status_code in (403, 451):
                    self.state["book_message"] = "当前网络无法访问币安盘口服务，将自动重试。"
                self.changed.set()
                await asyncio.sleep(delay + random.uniform(0, 0.5))
                delay = min(delay * 2, 30)

    async def trade_loop(self):
        delay = 1
        while True:
            try:
                async with connect(TRADE_URL, open_timeout=10, close_timeout=2,
                                   ping_interval=20, ping_timeout=10) as ws:
                    last_id = -1
                    while True:
                        try:
                            raw = await asyncio.wait_for(ws.recv(), timeout=30)
                        except TimeoutError:
                            # A quiet market is not a stale price: check transport health.
                            await asyncio.wait_for(await ws.ping(), timeout=5)
                            continue
                        event = json.loads(raw)
                        if event["s"] != SYMBOL or event["e"] != "aggTrade":
                            raise ValueError("Unexpected trade stream")
                        trade_id = int(event["a"])
                        if trade_id <= last_id:
                            continue
                        price = format(number(event["p"]), "f")
                        self.state.update(price=price, price_status="live",
                                          price_time=int(event["T"]),
                                          price_received_at=milliseconds(), price_message=None)
                        self.changed.set()
                        last_id, delay = trade_id, 1
            except asyncio.CancelledError:
                raise
            except Exception as error:
                logger.warning("ETH trade reconnect: %s", type(error).__name__)
                self.state["price_status"] = "reconnecting"
                self.state["price_message"] = "成交价连接中断，正在自动重连。"
                self.changed.set()
                await asyncio.sleep(delay + random.uniform(0, 0.5))
                delay = min(delay * 2, 30)
