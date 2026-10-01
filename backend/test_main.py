"""Behavior checks without a Binance account or external network."""

import unittest

import httpx
from fastapi.testclient import TestClient

from backend.main import app
from backend.binance_rest import FuturesRestGate


def ticker(symbol):
    return {
        "symbol": symbol, "lastPrice": "80000.12345678", "priceChange": "1000.12345678",
        "priceChangePercent": "1.250", "highPrice": "81000.00", "lowPrice": "78000.00",
        "volume": "12000.12345", "quoteVolume": "960000000.00", "openTime": 1000,
        "closeTime": 86401000, "count": 120000,
    }


class MarketApiTests(unittest.TestCase):
    def request(self, market, handler):
        with TestClient(app) as client:
            upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            app.state.binance_client = upstream
            app.state.futures_rest = FuturesRestGate()
            try:
                return client.get(f"/api/markets/{market}")
            finally:
                client.portal.call(upstream.aclose)

    def test_correct_market_endpoints_and_preserved_decimal_precision(self):
        for market, host, prefix in (
            ("spot", "data-api.binance.vision", "/api/v3"),
            ("futures", "fapi.binance.com", "/fapi/v1"),
        ):
            with self.subTest(market=market):
                requests = []

                def handler(request):
                    requests.append((request.url.host, request.url.path, request.url.params["symbol"]))
                    symbol = request.url.params["symbol"]
                    payload = ticker(symbol) if request.url.path.endswith("24hr") else {"symbol": symbol, "price": "80000.12345678"}
                    return httpx.Response(200, json=payload)

                response = self.request(market, handler)
                self.assertEqual(response.status_code, 200)
                body = response.json()
                self.assertFalse(body["partial"])
                self.assertEqual(body["market"], market)
                self.assertEqual(body["quotes"][0]["price"], "80000.12345678")
                self.assertEqual(body["quotes"][0]["statistics"]["quote_volume"], "960000000.00")
                price_path = "/fapi/v2/ticker/price" if market == "futures" else prefix + "/ticker/price"
                self.assertEqual(set(requests), {
                    (host, path, symbol) for symbol in ("BTCUSDT", "ETHUSDT")
                    for path in (price_path, prefix + "/ticker/24hr")
                })

    def test_partial_failure_keeps_successful_fields_without_fabricating_price(self):
        def handler(request):
            if request.url.path.endswith("/price"):
                return httpx.Response(429, json={"msg": "too many requests"})
            return httpx.Response(200, json=ticker(request.url.params["symbol"]))

        response = self.request("spot", handler)
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertTrue(body["partial"])
        self.assertIsNone(body["quotes"][0]["price"])
        self.assertEqual(body["quotes"][0]["statistics"]["count"], 120000)
        self.assertIn("频率", body["quotes"][0]["errors"]["price"])

    def test_complete_upstream_failure_is_a_gateway_error(self):
        response = self.request("futures", lambda _: httpx.Response(451))
        self.assertEqual(response.status_code, 502)
        self.assertIn("message", response.json()["detail"])

    def test_malformed_data_and_wrong_symbol_are_not_displayed(self):
        def handler(request):
            if request.url.path.endswith("/price"):
                return httpx.Response(200, json={"symbol": "WRONG", "price": "123"})
            data = ticker(request.url.params["symbol"])
            data["volume"] = "NaN"
            return httpx.Response(200, json=data)

        self.assertEqual(self.request("spot", handler).status_code, 502)

    def test_timeout_returns_a_readable_error(self):
        def handler(request):
            raise httpx.ReadTimeout("timed out", request=request)

        response = self.request("spot", handler)
        self.assertEqual(response.status_code, 502)
        self.assertIn("超时", response.json()["detail"]["errors"]["BTCUSDT"]["price"])

    def test_unknown_market_does_not_call_upstream(self):
        def handler(_):
            self.fail("Invalid market must not reach Binance")

        self.assertEqual(self.request("invalid", handler).status_code, 422)

    def test_futures_limit_pauses_subsequent_refreshes_but_not_spot(self):
        requests = []

        def handler(request):
            requests.append(request.url.host)
            if request.url.host == "fapi.binance.com":
                return httpx.Response(418, headers={"Retry-After": "3600"})
            symbol = request.url.params["symbol"]
            payload = ticker(symbol) if request.url.path.endswith("24hr") else {"symbol": symbol, "price": "2000"}
            return httpx.Response(200, json=payload)

        with TestClient(app) as client:
            upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
            app.state.binance_client = upstream
            app.state.futures_rest = FuturesRestGate()
            try:
                first = client.get("/api/markets/futures")
                self.assertEqual(first.status_code, 429)
                self.assertEqual(first.json()["detail"]["rest_cooldown"]["http_status"], 418)
                self.assertGreaterEqual(int(first.headers["Retry-After"]), 3599)
                before = len(requests)
                for _ in range(3):
                    response = client.get("/api/markets/futures")
                    self.assertEqual(response.status_code, 429)
                    self.assertEqual(response.json()["detail"]["rest_cooldown"], first.json()["detail"]["rest_cooldown"])
                self.assertEqual(len(requests), before)
                self.assertEqual(client.get("/api/markets/spot").status_code, 200)
                self.assertEqual(requests.count("data-api.binance.vision"), 4)
            finally:
                client.portal.call(upstream.aclose)


if __name__ == "__main__":
    unittest.main()
