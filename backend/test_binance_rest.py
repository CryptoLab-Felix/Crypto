"""Offline regression checks for a shared, persistent Binance REST cooldown."""

import asyncio
import tempfile
import unittest
from datetime import datetime, timezone
from email.utils import format_datetime
from pathlib import Path

import httpx

from backend.binance_rest import FuturesRestGate, RestCooldownError

HOST = "https://fapi.binance.com"


class RestGateTests(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.now = 1_800_000_000.0
        self.gate = FuturesRestGate(clock=lambda: self.now)

    def limit(self, status=429, headers=None, body=None):
        return httpx.Response(status, headers=headers, json=body or {}, request=httpx.Request("GET", HOST + "/fapi/v1/depth"))

    async def test_depth_and_tickers_share_gate_in_both_directions(self):
        for first_path, second_path in (("/fapi/v1/depth", "/fapi/v2/ticker/price"),
                                        ("/fapi/v1/ticker/24hr", "/fapi/v1/depth")):
            with self.subTest(first=first_path):
                requests = []
                gate = FuturesRestGate(clock=lambda: self.now)

                def handler(request):
                    requests.append(request.url.path)
                    return httpx.Response(429, headers={"Retry-After": "60"})

                async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
                    for path in (first_path, second_path, second_path):
                        with self.assertRaises(RestCooldownError):
                            await gate.get(client, HOST + path)
                    self.assertEqual(requests, [first_path])

    async def test_header_date_ban_timestamp_and_invalid_header_fallback(self):
        date = format_datetime(datetime.fromtimestamp(self.now + 90, timezone.utc), usegmt=True)
        for status, header, body, expected in (
            (429, "60", {}, 60),
            (429, date, {}, 90),
            (418, "10", {"msg": f"IP banned until {int((self.now + 3600) * 1000)}."}, 3600),
            (418, None, {"msg": f"IP banned until {int((self.now + 7200) * 1000)}."}, 7200),
            (429, "NaN", {}, 60),
            (429, "-1", {}, 60),
            (418, "invalid", {}, 120),
        ):
            with self.subTest(header=header):
                gate = FuturesRestGate(clock=lambda: self.now)
                gate.record(self.limit(status, {"Retry-After": header} if header else {}, body))
                self.assertEqual(gate.retry_at, self.now + expected)
                self.assertEqual(gate.info()["http_status"], status)

    async def test_later_response_cannot_shorten_ban_and_restart_preserves_it(self):
        with tempfile.TemporaryDirectory() as directory:
            path = Path(directory) / "cooldown.json"
            gate = FuturesRestGate(path, clock=lambda: self.now)
            gate.record(self.limit(418, {"Retry-After": "3600"}))
            gate.record(self.limit(429, {"Retry-After": "60"}))
            restored = FuturesRestGate(path, clock=lambda: self.now)
            self.assertEqual(restored.info(), gate.info())
            self.assertEqual(restored.info()["http_status"], 418)
            self.assertEqual(restored.retry_at, self.now + 3600)
            with self.assertRaises(RestCooldownError):
                restored.check()

    async def test_expiry_allows_only_one_probe_and_a_new_limit_blocks_waiters(self):
        self.gate.record(self.limit(headers={"Retry-After": "60"}))
        self.now += 61
        entered, release = asyncio.Event(), asyncio.Event()
        requests = []

        async def handler(request):
            requests.append(request.url.path)
            entered.set()
            await release.wait()
            return httpx.Response(429, headers={"Retry-After": "120"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            tasks = [asyncio.create_task(self.gate.get(client, HOST + path)) for path in
                     ("/fapi/v1/depth", "/fapi/v2/ticker/price", "/fapi/v1/ticker/24hr")]
            await asyncio.wait_for(entered.wait(), 1)
            self.assertEqual(len(requests), 1)
            release.set()
            results = await asyncio.gather(*tasks, return_exceptions=True)
            self.assertTrue(all(isinstance(result, RestCooldownError) for result in results))
            self.assertEqual(len(requests), 1)
            self.assertEqual(self.gate.retry_at, self.now + 120)

    async def test_successful_probe_resumes_requests(self):
        self.gate.record(self.limit(headers={"Retry-After": "60"}))
        self.now += 61
        async with httpx.AsyncClient(transport=httpx.MockTransport(lambda _: httpx.Response(200, json={}))) as client:
            response = await self.gate.get(client, HOST + "/fapi/v1/depth")
            self.assertEqual(response.status_code, 200)
            self.assertIsNone(self.gate.status)
            self.assertIsNone(self.gate.info())
            self.assertEqual((await self.gate.get(client, HOST + "/fapi/v1/ticker/24hr")).status_code, 200)

    async def test_in_flight_success_does_not_clear_new_limit(self):
        entered, release = asyncio.Event(), asyncio.Event()

        async def handler(request):
            if request.url.path.endswith("depth"):
                entered.set()
                await release.wait()
                return httpx.Response(200, json={})
            return httpx.Response(418, headers={"Retry-After": "3600"})

        async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
            pending = asyncio.create_task(self.gate.get(client, HOST + "/fapi/v1/depth"))
            await entered.wait()
            with self.assertRaises(RestCooldownError):
                await self.gate.get(client, HOST + "/fapi/v1/ticker/24hr")
            release.set()
            await pending
            self.assertEqual(self.gate.info()["http_status"], 418)
