"""Shared cooldown for this backend's USD-M REST traffic, independent of viewers."""

import asyncio
import json
import logging
import math
import re
import time
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import httpx

logger = logging.getLogger(__name__)


class RestCooldownError(Exception):
    def __init__(self, info):
        self.info = info
        super().__init__(info["message"])


class FuturesRestGate:
    def __init__(self, state_file: Path | None = None, *, clock=time.time):
        self.clock = clock
        self.state_file = state_file
        self.retry_at = 0.0
        self.status = None
        self.revision = 0
        self.recovery_lock = asyncio.Lock()
        if state_file is not None:
            try:
                saved = json.loads(state_file.read_text(encoding="utf-8"))
                deadline = float(saved["retry_at"])
                if saved["status"] in (418, 429) and math.isfinite(deadline) and deadline > 0:
                    self.retry_at, self.status = deadline, saved["status"]
            except FileNotFoundError:
                pass
            except (OSError, ValueError, KeyError, TypeError):
                logger.warning("Unable to restore futures REST cooldown")

    def info(self):
        if self.clock() >= self.retry_at:
            return None
        return {
            "http_status": self.status,
            "retry_at": math.ceil(self.retry_at * 1000),
            "message": ("币安暂时封禁当前网络出口，合约行情查询已暂停。"
                        if self.status == 418 else "币安请求频率受限，合约行情查询已暂停。"),
        }

    def check(self):
        info = self.info()
        if info is not None:
            raise RestCooldownError(info)

    def persist(self):
        if self.state_file is None:
            return
        try:
            self.state_file.parent.mkdir(parents=True, exist_ok=True)
            temporary = self.state_file.with_suffix(".tmp")
            temporary.write_text(json.dumps({"retry_at": self.retry_at, "status": self.status}), encoding="utf-8")
            temporary.replace(self.state_file)
        except OSError:
            logger.exception("Unable to persist futures REST cooldown")

    def record(self, response: httpx.Response):
        now = self.clock()
        deadlines = []
        retry_after = response.headers.get("Retry-After", "")
        try:
            seconds = float(retry_after)
            if math.isfinite(seconds) and seconds > 0:
                deadlines.append(now + seconds)
        except ValueError:
            try:
                deadlines.append(parsedate_to_datetime(retry_after).timestamp())
            except (TypeError, ValueError, OverflowError):
                pass
        # Some 418 responses give the ban's Unix timestamp only in their message.
        try:
            message = response.json().get("msg", "")
            match = re.search(r"banned until\s+(\d{13})", str(message), re.IGNORECASE)
            if match:
                deadlines.append(int(match[1]) / 1000)
        except (ValueError, AttributeError):
            pass
        deadlines = [deadline for deadline in deadlines if math.isfinite(deadline) and deadline > now]
        deadline = max(deadlines, default=now + (120 if response.status_code == 418 else 60))
        if self.retry_at <= now:
            self.status = response.status_code
        elif response.status_code == 418:
            self.status = 418
        self.retry_at = max(self.retry_at, deadline, now + 1)
        self.revision += 1
        self.persist()
        logger.warning(
            "Binance futures REST paused: status=%s path=%s symbol=%s weight_1m=%s retry_at=%s",
            response.status_code, response.request.url.path, response.request.url.params.get("symbol", ""),
            response.headers.get("X-MBX-USED-WEIGHT-1M", "unknown"),
            datetime.fromtimestamp(self.retry_at, timezone.utc).isoformat(),
        )

    async def wait(self):
        # Cancellation of a subscriber never changes the stored deadline.
        while self.info() is not None:
            await asyncio.sleep(max(0, self.retry_at - self.clock()))

    async def request(self, client: httpx.AsyncClient, url: str, **kwargs):
        self.check()
        response = await client.get(url, **kwargs)
        if response.status_code in (418, 429):
            self.record(response)
            raise RestCooldownError(self.info())
        return response

    async def get(self, client: httpx.AsyncClient, url: str, **kwargs):
        self.check()
        if self.status is not None:
            # After expiry, allow one probe before queued requests resume normally.
            async with self.recovery_lock:
                self.check()
                if self.status is not None:
                    revision = self.revision
                    response = await self.request(client, url, **kwargs)
                    # A success started before another request's limit must not clear it.
                    if response.is_success and revision == self.revision:
                        self.retry_at, self.status = 0.0, None
                        self.persist()
                    return response
        # Already in-flight requests may finish; subsequent requests check the gate.
        return await self.request(client, url, **kwargs)
