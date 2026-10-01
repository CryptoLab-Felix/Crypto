"""Depth synchronization and shared-stream lifecycle; no external network."""

import asyncio
import json
import math
import threading
import unittest
from contextlib import asynccontextmanager
from unittest.mock import patch

import httpx
from fastapi.testclient import TestClient

from backend.main import app
from backend.binance_rest import RestCooldownError
from backend.orderbook import EthMarketStream, OrderBook, SYMBOL


def snapshot():
    return {"lastUpdateId": 100, "bids": [["1999.99", "2.123"], ["1999", "4"]],
            "asks": [["2000.01", "3"], ["2001", "5"]]}


def event(first=99, last=101, previous=98, bids=None, asks=None):
    return {"e": "depthUpdate", "s": SYMBOL, "E": 1000, "U": first, "u": last, "pu": previous,
            "b": bids or [], "a": asks or []}


class OrderBookTests(unittest.TestCase):
    def test_snapshot_overlap_absolute_replacement_and_zero_deletion(self):
        book = OrderBook(snapshot())
        self.assertFalse(book.apply(event(first=90, last=99)))
        self.assertTrue(book.apply(event(bids=[["1999.99", "7.456"]], asks=[["2001", "0"]])))
        self.assertTrue(book.apply(event(first=102, last=103, previous=101, asks=[["2001", "6"]])))
        self.assertEqual(book.export()["bids"][0], ["1999.99", "7.456"])
        self.assertEqual(book.export()["asks"], [["2000.01", "3"], ["2001", "6"]])

    def test_snapshot_boundary_event_is_accepted_and_duplicates_ignored(self):
        book = OrderBook(snapshot())
        self.assertTrue(book.apply(event(last=100)))
        self.assertFalse(book.apply(event(last=100, bids=[["1999.99", "99"]])))
        self.assertEqual(book.export()["bids"][0][1], "2.123")

    def test_missing_initial_overlap_or_later_sequence_rejected(self):
        with self.assertRaises(ValueError):
            OrderBook(snapshot()).apply(event(first=101))
        book = OrderBook(snapshot())
        book.apply(event())
        with self.assertRaises(ValueError):
            book.apply(event(first=104, last=105, previous=103))

    def test_unknown_outer_levels_are_not_reported_as_complete_depth(self):
        book = OrderBook(snapshot())
        book.apply(event(bids=[["1900", "999"], ["1800", "0"]], asks=[["2100", "999"]]))
        self.assertEqual(len(book.export()["bids"]), 2)
        self.assertEqual(len(book.export()["asks"]), 2)

    def test_crossed_empty_wrong_symbol_and_nonfinite_data_rejected(self):
        for update in (event(bids=[["2001", "2"]]), event(asks=[["2000.01", "0"], ["2001", "0"]]),
                       event(bids=[["1999", "NaN"]]), dict(event(), s="BTCUSDT")):
            with self.subTest(update=update), self.assertRaises(ValueError):
                OrderBook(snapshot()).apply(update)


class SharedStreamTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.requests = []

        def handler(request):
            self.requests.append(request)
            return httpx.Response(200, json=snapshot())

        self.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        self.service = EthMarketStream(self.client)

    async def asyncTearDown(self):
        await self.service.close()
        await self.client.aclose()

    async def next_matching(self, queue, predicate):
        async with asyncio.timeout(2):
            while True:
                payload = await queue.get()
                if predicate(payload):
                    return payload

    async def test_shared_upstreams_latest_frame_and_last_viewer_cleanup(self):
        connections = []
        depth = asyncio.Queue()
        trades = asyncio.Queue()

        @asynccontextmanager
        async def connection(url, **_kwargs):
            connections.append(url)
            class Socket:
                async def recv(self):
                    return json.dumps(await (depth if "depth" in url else trades).get())
            yield Socket()

        with patch("backend.orderbook.connect", connection):
            async with self.service.subscribe() as first:
                async with self.service.subscribe() as second:
                    await depth.put(event())
                    await trades.put({"e": "aggTrade", "s": SYMBOL, "a": 1, "p": "2000.01", "T": 1234})
                    payload = await self.next_matching(first, lambda p: p["book_status"] == p["price_status"] == "live")
                    self.assertEqual(payload["price"], "2000.01")
                    self.assertEqual(payload["asks"][0], ["2000.01", "3"])
                    self.assertEqual(len(connections), 2)
                    self.assertEqual(len(self.requests), 1)
                    self.assertEqual(self.requests[0].url.params["limit"], "1000")
                    self.assertEqual(second.qsize(), 1)
                    await depth.put(event(first=102, last=103, previous=101, bids=[["1999.99", "8"]]))
                    await self.next_matching(first, lambda p: p["bids"][0][1] == "8")
                    self.assertEqual(second.qsize(), 1)
                    self.assertEqual((await second.get())["bids"][0][1], "8")
                self.assertTrue(self.service.tasks)
            self.assertFalse(self.service.tasks)
            self.assertFalse(self.service.subscribers)

    async def test_sequence_gap_marks_retained_book_stale_without_stopping_price(self):
        depth = asyncio.Queue()
        trades = asyncio.Queue()

        @asynccontextmanager
        async def connection(url, **_kwargs):
            class Socket:
                async def recv(self):
                    return json.dumps(await (depth if "depth" in url else trades).get())
            yield Socket()

        with patch("backend.orderbook.connect", connection):
            async with self.service.subscribe() as queue:
                await depth.put(event())
                await self.next_matching(queue, lambda p: p["book_status"] == "live")
                await depth.put(event(first=105, last=106, previous=104))
                payload = await self.next_matching(queue, lambda p: p["book_status"] == "reconnecting")
                self.assertEqual(payload["bids"][0][1], "2.123")
                await trades.put({"e": "aggTrade", "s": SYMBOL, "a": 2, "p": "2002", "T": 1235})
                payload = await self.next_matching(queue, lambda p: p["price"] == "2002")
                self.assertEqual(payload["price_status"], "live")
                self.assertEqual(payload["book_status"], "reconnecting")

    async def test_rate_limit_reports_reason_without_retrying_immediately(self):
        requests = []

        def limited(request):
            requests.append(request)
            return httpx.Response(429, headers={"Retry-After": "60"})

        @asynccontextmanager
        async def connection(*_args, **_kwargs):
            class Socket:
                async def recv(self):
                    await asyncio.Event().wait()
            yield Socket()

        async with httpx.AsyncClient(transport=httpx.MockTransport(limited)) as client:
            service = EthMarketStream(client)
            with patch("backend.orderbook.connect", connection):
                async with service.subscribe() as queue:
                    payload = await self.next_matching(queue, lambda p: p["book_status"] == "reconnecting")
                    self.assertIn("频率受限", payload["book_message"])
                    self.assertEqual(payload["bids"], [])
                    # Another publisher heartbeat must not generate a REST retry.
                    await asyncio.wait_for(queue.get(), timeout=2)
                    self.assertEqual(len(requests), 1)
                # Leaving and re-entering must not reset the server's cooldown.
                deadline = service.rest_gate.retry_at
                for _ in range(3):
                    async with service.subscribe() as queue:
                        payload = await queue.get()
                        self.assertEqual(payload["rest_cooldown"]["retry_at"], math.ceil(deadline * 1000))
                        self.assertEqual(payload["book_status"], "reconnecting")
                        await asyncio.wait_for(queue.get(), timeout=2)
                self.assertEqual(len(requests), 1)

    async def test_statistics_limit_keeps_live_websocket_book_and_price_running(self):
        depth, trades = asyncio.Queue(), asyncio.Queue()

        @asynccontextmanager
        async def connection(url, **_kwargs):
            class Socket:
                async def recv(self):
                    return json.dumps(await (depth if "depth" in url else trades).get())
            yield Socket()

        with patch("backend.orderbook.connect", connection):
            async with self.service.subscribe() as queue:
                await depth.put(event())
                await self.next_matching(queue, lambda p: p["book_status"] == "live")
                async with httpx.AsyncClient(transport=httpx.MockTransport(
                    lambda _: httpx.Response(418, headers={"Retry-After": "3600"})
                )) as limited_client:
                    with self.assertRaises(RestCooldownError):
                        await self.service.rest_gate.get(limited_client, "https://fapi.binance.com/fapi/v1/ticker/24hr")
                await depth.put(event(first=102, last=103, previous=101, bids=[["1999.99", "8"]]))
                await trades.put({"e": "aggTrade", "s": SYMBOL, "a": 1, "p": "2001", "T": 1234})
                payload = await self.next_matching(queue, lambda p: p["price"] == "2001" and p["bids"][0][1] == "8")
                self.assertEqual(payload["book_status"], "live")
                self.assertEqual(payload["price_status"], "live")
                self.assertEqual(payload["rest_cooldown"]["http_status"], 418)


class WebSocketRouteTests(unittest.TestCase):
    def test_websocket_sends_stream_and_unsubscribes_on_disconnect(self):
        class Service:
            active = False

            def __init__(self):
                self.stopped = threading.Event()

            @asynccontextmanager
            async def subscribe(self):
                self.active = True
                queue = asyncio.Queue()
                queue.put_nowait({"symbol": SYMBOL, "price": "2000"})
                try:
                    yield queue
                finally:
                    self.active = False
                    self.stopped.set()

            async def close(self):
                pass

        with TestClient(app) as client:
            service = Service()
            app.state.eth_stream = service
            with client.websocket_connect("/api/markets/futures/eth/orderbook") as websocket:
                self.assertEqual(websocket.receive_json()["price"], "2000")
                self.assertTrue(service.active)
                websocket.close()
                self.assertTrue(service.stopped.wait(timeout=3))
        self.assertFalse(service.active)
