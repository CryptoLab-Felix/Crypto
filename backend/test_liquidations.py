"""Estimates must retain their units, timestamps and direction across refreshes."""

import asyncio
import copy
import unittest
from datetime import datetime, timezone
from email.utils import format_datetime

import httpx
from fastapi.testclient import TestClient

from backend.liquidations import LiquidationService
from backend.main import app

NOW = 1_790_000_000.0


def fixture():
    return {
        "symbol": "ETH", "range": "1d", "updatedAt": int(NOW * 1000),
        "currentPrice": 2000, "binWidth": 2,
        "bins": [
            {"price": 1999, "side": "long", "total": 5000, "tiers": {"10": 2000, "100": 3000}},
            {"price": 2001, "side": "short", "total": 8000, "tiers": {"25": 8000}},
        ],
    }


class LiquidationServiceTests(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        self.now = NOW
        self.requests = []
        self.body = fixture()
        self.status = 200
        self.headers = {}

        async def handler(request):
            self.requests.append(request)
            await asyncio.sleep(0)
            return httpx.Response(self.status, json=self.body, headers=self.headers)

        self.client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
        self.service = LiquidationService(self.client, clock=lambda: self.now)

    async def asyncTearDown(self):
        await self.client.aclose()

    async def test_concurrent_viewers_share_cache_and_amounts_are_not_leveraged_again(self):
        results = await asyncio.gather(*(self.service.snapshot() for _ in range(12)))
        self.assertEqual(len(self.requests), 1)
        request = self.requests[0]
        self.assertEqual(str(request.url), "https://api.coinboss.com/api/liq-map?symbol=ETH&range=1d")
        self.assertNotIn("Authorization", request.headers)
        for result in results:
            self.assertEqual(result.status, "ready")
            self.assertEqual([row.total for row in result.data.bins], [5000, 8000])
            self.assertEqual(result.data.bin_width, 2)
        self.now += 14
        await self.service.snapshot()
        self.assertEqual(len(self.requests), 1)
        self.now += 1
        repeated = await self.service.snapshot()
        self.assertEqual(len(self.requests), 2)
        self.assertEqual(repeated.data.updated_at, int(NOW * 1000))
        self.assertEqual(repeated.data.bins[0].total, 5000)

    async def test_refresh_replaces_positions_and_rejects_older_snapshots(self):
        await self.service.snapshot()
        self.now += 15
        self.body["updatedAt"] += 15_000
        self.body["bins"] = [{"price": 2051, "side": "short", "total": 9000}]
        updated = await self.service.snapshot()
        self.assertEqual(len(updated.data.bins), 1)
        self.assertEqual(updated.data.bins[0].total, 9000)
        self.now += 15
        self.body = fixture()
        retained = await self.service.snapshot()
        self.assertEqual(retained.status, "stale")
        self.assertEqual(retained.data, updated.data)
        self.assertEqual(retained.fetched_at, updated.fetched_at)

    async def test_failure_retains_data_and_respects_rate_limit_then_recovers(self):
        original = await self.service.snapshot()
        self.now += 15
        self.status, self.headers = 429, {"Retry-After": "120"}
        failed = await self.service.snapshot()
        self.assertEqual(failed.status, "stale")
        self.assertIn("频率受限", failed.message)
        self.assertEqual(failed.data, original.data)
        self.assertEqual(failed.next_check_at, int((self.now + 120) * 1000))
        self.now += 119
        await self.service.snapshot()
        self.assertEqual(len(self.requests), 2)
        self.status = 200
        self.now += 1
        recovered = await self.service.snapshot()
        self.assertEqual(recovered.status, "ready")
        self.assertIsNone(recovered.message)
        self.assertEqual(len(self.requests), 3)

    async def test_date_retry_after_and_empty_cache_do_not_fabricate_zero_amounts(self):
        self.status = 503
        self.headers = {"Retry-After": format_datetime(datetime.fromtimestamp(NOW + 180, timezone.utc), usegmt=True)}
        result = await self.service.snapshot()
        self.assertEqual(result.status, "unavailable")
        self.assertIsNone(result.data)
        self.assertEqual(result.next_check_at, int((NOW + 180) * 1000))
        self.now += 179
        await self.service.snapshot()
        self.assertEqual(len(self.requests), 1)

    async def test_successful_fetch_does_not_make_old_model_fresh(self):
        self.body["updatedAt"] -= 601_000
        result = await self.service.snapshot()
        self.assertEqual(result.status, "stale")
        self.assertIn("10 分钟", result.message)
        self.assertEqual(result.fetched_at, int(NOW * 1000))
        self.assertEqual(result.data.updated_at, int(NOW * 1000) - 601_000)

    async def test_invalid_numbers_symbols_sides_timestamps_and_duplicates_are_rejected(self):
        mutations = [
            lambda data: data.update(symbol="BTC"),
            lambda data: data.update(binWidth=0),
            lambda data: data.update(currentPrice="NaN"),
            lambda data: data.update(updatedAt=int((NOW + 120) * 1000)),
            lambda data: data["bins"][0].update(total=-1),
            lambda data: data["bins"][0].update(total="Infinity"),
            lambda data: data["bins"][0].update(side="buy"),
            lambda data: data["bins"].append(copy.deepcopy(data["bins"][0])),
        ]
        for mutate in mutations:
            self.body = fixture()
            mutate(self.body)
            service = LiquidationService(self.client, clock=lambda: self.now)
            with self.subTest(body=self.body):
                result = await service.snapshot()
                self.assertEqual(result.status, "unavailable")
                self.assertIsNone(result.data)

    async def test_timeout_is_reported_and_retried_with_backoff(self):
        def timeout(request):
            raise httpx.ReadTimeout("timeout", request=request)

        async with httpx.AsyncClient(transport=httpx.MockTransport(timeout)) as client:
            service = LiquidationService(client, clock=lambda: self.now)
            first = await service.snapshot()
            self.assertIn("超时", first.message)
            self.now += 15
            second = await service.snapshot()
            self.assertEqual(second.next_check_at, int((self.now + 30) * 1000))


class LiquidationRouteTests(unittest.TestCase):
    def test_route_serializes_normalized_fields_without_binance_requests(self):
        calls = []

        def handler(request):
            calls.append(str(request.url))
            return httpx.Response(200, json=fixture())

        with TestClient(app) as client:
            upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            app.state.eth_liquidations = LiquidationService(upstream, clock=lambda: NOW)
            try:
                response = client.get("/api/markets/futures/eth/liquidations")
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers["cache-control"], "no-store")
                data = response.json()["data"]
                self.assertEqual(data["reference_price"], 2000)
                self.assertEqual(data["updated_at"], int(NOW * 1000))
                self.assertEqual(data["bins"][1], {"price": 2001, "side": "short", "total": 8000})
                self.assertEqual(len(calls), 1)
            finally:
                client.portal.call(upstream.aclose)
