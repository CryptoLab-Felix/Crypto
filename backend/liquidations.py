"""Cached CoinBoss estimates. Amounts are position notional, never margin."""

import asyncio
import logging
import math
import time
from email.utils import parsedate_to_datetime
from typing import Annotated, Literal

import httpx
from pydantic import BaseModel, Field, FiniteFloat, model_validator

logger = logging.getLogger(__name__)
URL = "https://api.coinboss.com/api/liq-map"
POLL_SECONDS = 15
MODEL_SECONDS = 300
STALE_SECONDS = 600
Positive = Annotated[FiniteFloat, Field(gt=0)]
NonNegative = Annotated[FiniteFloat, Field(ge=0)]


class LiquidationBin(BaseModel):
    price: Positive
    side: Literal["long", "short"]
    # CoinBoss already totals all leverage tiers. Do not multiply by leverage.
    total: NonNegative


class LiquidationMap(BaseModel):
    symbol: Literal["ETH"]
    range: Literal["1d"]
    updated_at: int = Field(alias="updatedAt", gt=0)
    reference_price: Positive = Field(alias="currentPrice")
    bin_width: Positive = Field(alias="binWidth")
    bins: list[LiquidationBin] = Field(min_length=1, max_length=5000)

    @model_validator(mode="after")
    def unique_prices(self):
        keys = [(row.price, row.side) for row in self.bins]
        if len(set(keys)) != len(keys):
            raise ValueError("Duplicate liquidation price levels")
        return self


class LiquidationSnapshot(BaseModel):
    source: Literal["CoinBoss"] = "CoinBoss"
    status: Literal["ready", "stale", "unavailable"]
    data: LiquidationMap | None
    message: str | None
    fetched_at: int | None
    server_time: int
    next_check_at: int
    model_interval_seconds: int = MODEL_SECONDS


def retry_seconds(response: httpx.Response, now: float) -> float:
    value = response.headers.get("Retry-After", "")
    try:
        seconds = float(value)
        if math.isfinite(seconds):
            return max(0, seconds)
    except ValueError:
        pass
    try:
        return max(0, parsedate_to_datetime(value).timestamp() - now)
    except (ValueError, TypeError, OverflowError):
        return 60 if response.status_code in (418, 429) else POLL_SECONDS


class LiquidationService:
    """One cache per backend process; requests only while pages are viewed."""

    def __init__(self, client: httpx.AsyncClient, *, clock=time.time):
        self.client = client
        self.clock = clock
        self.lock = asyncio.Lock()
        self.data: LiquidationMap | None = None
        self.fetched_at: int | None = None
        self.next_check = 0.0
        self.message: str | None = None
        self.failures = 0

    async def snapshot(self) -> LiquidationSnapshot:
        async with self.lock:
            if self.clock() >= self.next_check:
                await self.refresh()
        now = self.clock()
        message = self.message
        if self.data and now * 1000 - self.data.updated_at > STALE_SECONDS * 1000:
            message = message or "CoinBoss 模型超过 10 分钟未更新，以下为上次估算。"
        return LiquidationSnapshot(
            status="unavailable" if self.data is None else "stale" if message else "ready",
            data=self.data, message=message, fetched_at=self.fetched_at,
            server_time=int(now * 1000), next_check_at=math.ceil(self.next_check * 1000),
        )

    async def refresh(self):
        delay = POLL_SECONDS
        try:
            response = await self.client.get(URL, params={"symbol": "ETH", "range": "1d"})
            if response.is_error:
                delay = max(delay, retry_seconds(response, self.clock()))
            response.raise_for_status()
            data = LiquidationMap.model_validate(response.json())
            if data.updated_at > self.clock() * 1000 + 60_000:
                raise ValueError("Model timestamp is in the future")
            if self.data and data.updated_at < self.data.updated_at:
                raise ValueError("Model timestamp went backwards")
            # Repeated snapshots replace the cache, never accumulate over time.
            self.data = data
            self.fetched_at = int(self.clock() * 1000)
            self.message = None
            self.failures = 0
        except httpx.HTTPStatusError as error:
            status = error.response.status_code
            if status in (418, 429):
                self.message = "CoinBoss 请求频率受限，将在冷却结束后自动重试。"
            elif status in (401, 403):
                self.message = "CoinBoss 当前拒绝访问，请等待恢复或检查接口访问条件。"
                delay = max(delay, MODEL_SECONDS)
            else:
                self.message = "CoinBoss 服务暂时不可用，将自动重试。"
            self.failures += 1
            logger.warning("CoinBoss liquidation request failed: HTTP %s", status)
        except (httpx.RequestError, ValueError, ArithmeticError) as error:
            self.message = ("CoinBoss 响应超时，将自动重试。" if isinstance(error, httpx.TimeoutException)
                            else "CoinBoss 估算数据暂时无法读取，将自动重试。")
            self.failures += 1
            logger.warning("CoinBoss liquidation request failed: %s", type(error).__name__)
        if self.failures:
            delay = max(delay, min(MODEL_SECONDS, POLL_SECONDS * 2 ** min(self.failures - 1, 5)))
        self.next_check = self.clock() + delay
