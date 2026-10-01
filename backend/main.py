"""Read-only Binance market data for the web preview."""

import asyncio
import logging
import math
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from decimal import Decimal
from enum import Enum
from pathlib import Path
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field, ValidationError, field_validator

from backend.orderbook import EthMarketStream
from backend.binance_rest import FuturesRestGate, RestCooldownError
from backend.liquidations import LiquidationService, LiquidationSnapshot

logger = logging.getLogger(__name__)


class Market(str, Enum):
    spot = "spot"
    futures = "futures"


MARKETS = {
    Market.spot: ("https://data-api.binance.vision", "/api/v3/ticker/price", "/api/v3/ticker/24hr"),
    Market.futures: ("https://fapi.binance.com", "/fapi/v2/ticker/price", "/fapi/v1/ticker/24hr"),
}
ASSETS = (("BTCUSDT", "BTC", "Bitcoin"), ("ETHUSDT", "ETH", "Ethereum"))


class Price(BaseModel):
    symbol: str
    price: str

    @field_validator("price")
    @classmethod
    def valid_price(cls, value: str) -> str:
        if not Decimal(value).is_finite() or Decimal(value) <= 0:
            raise ValueError("Invalid market price")
        return value


class Statistics(BaseModel):
    symbol: str
    last_price: str = Field(alias="lastPrice")
    price_change: str = Field(alias="priceChange")
    price_change_percent: str = Field(alias="priceChangePercent")
    high_price: str = Field(alias="highPrice")
    low_price: str = Field(alias="lowPrice")
    volume: str
    quote_volume: str = Field(alias="quoteVolume")
    open_time: int = Field(alias="openTime")
    close_time: int = Field(alias="closeTime")
    count: int

    @field_validator("last_price", "price_change", "price_change_percent", "high_price", "low_price", "volume", "quote_volume")
    @classmethod
    def finite_number(cls, value: str) -> str:
        if not Decimal(value).is_finite():
            raise ValueError("Invalid market statistic")
        return value


class Quote(BaseModel):
    symbol: str
    asset: str
    name: str
    price: str | None = None
    statistics: Statistics | None = None
    errors: dict[str, str] = Field(default_factory=dict)


class MarketSnapshot(BaseModel):
    market: Market
    source: str
    fetched_at: datetime
    partial: bool
    quotes: list[Quote]
    rest_cooldown: dict | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(12.0, connect=6.0),
        headers={"User-Agent": "Crypto-Market-Preview/0.1"},
        limits=httpx.Limits(max_connections=12, max_keepalive_connections=8),
    ) as client:
        app.state.binance_client = client
        app.state.futures_rest = FuturesRestGate(
            Path(__file__).resolve().parent.parent / ".local" / "futures-rest-cooldown.json"
        )
        app.state.eth_stream = EthMarketStream(client, app.state.futures_rest)
        app.state.eth_liquidations = LiquidationService(client)
        try:
            yield
        finally:
            await app.state.eth_stream.close()


app = FastAPI(title="Crypto 行情 API", version="0.1.0", lifespan=lifespan)


async def fetch_data(client: httpx.AsyncClient, url: str, symbol: str, model: type[Price] | type[Statistics],
                     rest_gate: FuturesRestGate | None = None):
    try:
        response = (await rest_gate.get(client, url, params={"symbol": symbol}) if rest_gate else
                    await client.get(url, params={"symbol": symbol}))
        response.raise_for_status()
        data = model.model_validate(response.json())
        if data.symbol != symbol:
            raise ValueError("Unexpected symbol in upstream response")
        return data
    except RestCooldownError as error:
        return str(error)
    except httpx.TimeoutException:
        return "币安响应超时，请稍后重试。"
    except httpx.HTTPStatusError as error:
        status = error.response.status_code
        if status in (418, 429):
            return "币安请求频率受限，请稍后刷新。"
        if status in (403, 451):
            return "当前网络无法访问该币安行情服务。"
        return "币安行情服务暂时不可用，请稍后重试。"
    except (httpx.RequestError, ValueError, ValidationError, ArithmeticError):
        logger.warning("Unable to load %s for %s", url, symbol)
        return "行情数据暂时无法读取，请稍后重试。"


@app.get("/api/health")
async def health() -> dict[str, Literal["ok"]]:
    return {"status": "ok"}


@app.get("/api/markets/{market}", response_model=MarketSnapshot, response_model_by_alias=False)
async def market_snapshot(market: Market, request: Request) -> MarketSnapshot:
    host, price_path, stats_path = MARKETS[market]
    client = request.app.state.binance_client
    rest_gate = request.app.state.futures_rest if market == Market.futures else None
    tasks = [
        fetch_data(client, host + path, symbol, model, rest_gate)
        for symbol, _, _ in ASSETS
        for path, model in ((price_path, Price), (stats_path, Statistics))
    ]
    results = await asyncio.gather(*tasks)
    quotes = []
    for index, (symbol, asset, name) in enumerate(ASSETS):
        price, statistics = results[index * 2:index * 2 + 2]
        errors = {}
        if isinstance(price, str):
            errors["price"] = price
        if isinstance(statistics, str):
            errors["statistics"] = statistics
        quotes.append(Quote(
            symbol=symbol, asset=asset, name=name,
            price=price.price if isinstance(price, Price) else None,
            statistics=statistics if isinstance(statistics, Statistics) else None,
            errors=errors,
        ))

    cooldown = rest_gate.info() if rest_gate else None
    if all(quote.price is None and quote.statistics is None for quote in quotes):
        raise HTTPException(status_code=429 if cooldown else 502, detail={
            "message": cooldown["message"] if cooldown else "暂时无法获取币安行情，请检查网络后重试。",
            "errors": {quote.symbol: quote.errors for quote in quotes},
            "rest_cooldown": cooldown,
        }, headers={"Retry-After": str(math.ceil(rest_gate.retry_at - rest_gate.clock()))} if cooldown else None)
    return MarketSnapshot(
        market=market,
        source="Binance Spot" if market == Market.spot else "Binance USDⓈ-M Futures",
        fetched_at=datetime.now(timezone.utc),
        partial=any(quote.errors for quote in quotes),
        quotes=quotes,
        rest_cooldown=cooldown,
    )


@app.websocket("/api/markets/futures/eth/orderbook")
async def eth_orderbook(websocket: WebSocket):
    await websocket.accept()
    async with websocket.app.state.eth_stream.subscribe() as queue:
        async def send():
            while True:
                await asyncio.wait_for(websocket.send_json(await queue.get()), timeout=5)

        async def receive():
            while True:
                await websocket.receive_text()

        tasks = [asyncio.create_task(send()), asyncio.create_task(receive())]
        try:
            done, _ = await asyncio.wait(tasks, return_when=asyncio.FIRST_COMPLETED)
            for task in done:
                task.result()
        except (WebSocketDisconnect, TimeoutError, OSError):
            pass
        finally:
            for task in tasks:
                task.cancel()
            await asyncio.gather(*tasks, return_exceptions=True)


@app.get("/api/markets/futures/eth/liquidations", response_model=LiquidationSnapshot,
         response_model_by_alias=False)
async def eth_liquidations(request: Request, response: Response) -> LiquidationSnapshot:
    response.headers["Cache-Control"] = "no-store"
    return await request.app.state.eth_liquidations.snapshot()


# The production build can run on the same Python origin as the API.
frontend_dist = Path(__file__).resolve().parent.parent / "frontend" / "dist"
if frontend_dist.is_dir():
    app.mount("/", StaticFiles(directory=frontend_dist, html=True), name="frontend")
