import { expect, test } from "@playwright/test";
import type { Market, MarketSnapshot } from "../src/api";

const fixture = (market: Market): MarketSnapshot => ({
  market,
  source: "Test fixture",
  fetched_at: new Date().toISOString(),
  partial: false,
  quotes: ["BTC", "ETH"].map((asset, index) => ({
    symbol: `${asset}USDT`,
    asset,
    name: index === 0 ? "Bitcoin" : "Ethereum",
    price: index === 0 ? "80000.12" : "3000.45",
    errors: {},
    statistics: {
      symbol: `${asset}USDT`,
      last_price: "80000.12",
      price_change: "1000.12",
      price_change_percent: "1.25",
      high_price: "81000",
      low_price: "78000",
      volume: "12000",
      quote_volume: "960000000",
      open_time: 1000,
      close_time: 86401000,
      count: 120000,
    },
  })),
});

test("live spot and futures, refresh, and mobile layout", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(page.getByText("行情已连接", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "现货市场",
  );
  await expect(page.locator(".price-line strong").first()).toHaveText(
    /[\d,]+\.\d{2}/,
  );
  await expect(page.locator(".asset-card")).toHaveCount(2);
  await page.screenshot({ path: "../.local/spot-desktop.png", fullPage: true });
  await page.getByRole("button", { name: /合约市场/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "合约市场",
  );
  await expect(page.getByText("行情已连接", { exact: true })).toBeVisible();
  await expect(page.locator(".price-line strong").first()).toHaveText(
    /[\d,]+\.\d{2}/,
  );
  await page.screenshot({
    path: "../.local/futures-desktop.png",
    fullPage: true,
  });
  await page.getByRole("checkbox", { name: "每 30 秒刷新" }).uncheck();
  const response = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/markets/futures") &&
      response.status() === 200,
  );
  await page.getByRole("button", { name: "刷新行情" }).click();
  await response;
  await expect(page.getByRole("button", { name: "刷新行情" })).toBeEnabled();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.getByRole("button", { name: /现货市场/ })).toBeVisible();
  await page.screenshot({
    path: "../.local/futures-mobile.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("initial error can be retried, refresh error preserves visibly stale data", async ({
  page,
}) => {
  let fail = true;
  await page.route("**/api/markets/spot", (route) =>
    route.fulfill({
      status: fail ? 502 : 200,
      json: fail
        ? { detail: { message: "测试：行情暂时不可用。" } }
        : fixture("spot"),
    }),
  );
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText("测试：行情暂时不可用。");
  await expect(page.locator(".price-line strong").first()).toHaveText("—");
  fail = false;
  await page.getByRole("button", { name: /重新加载/ }).click();
  await expect(page.locator(".price-line strong").first()).toHaveText(
    "80,000.12",
  );
  fail = true;
  await page.getByRole("button", { name: "刷新行情" }).click();
  await expect(page.getByRole("alert")).toContainText("下方保留上次获取的数据");
  await expect(page.locator(".stale-label").first()).toBeVisible();
  await expect(page.locator(".price-line strong").first()).toHaveText(
    "80,000.12",
  );
});

test("partial API failure is shown without substituting statistics for latest price", async ({
  page,
}) => {
  const snapshot = fixture("spot");
  snapshot.partial = true;
  snapshot.quotes[0].price = null;
  snapshot.quotes[0].errors.price = "币安响应超时，请稍后重试。";
  await page.route("**/api/markets/spot", (route) =>
    route.fulfill({ json: snapshot }),
  );
  await page.goto("/");
  await expect(page.getByText("部分数据可用", { exact: true })).toBeVisible();
  await expect(page.locator(".price-line strong").first()).toHaveText("—");
  await expect(page.locator(".partial-error")).toContainText("超时");
  await expect(page.locator(".price-line strong").nth(1)).toHaveText(
    "3,000.45",
  );
});

test("switching market ignores delayed responses from the previous module", async ({
  page,
}) => {
  await page.route("**/api/markets/spot", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await route.fulfill({ json: fixture("spot") }).catch(() => {});
  });
  const futures = fixture("futures");
  futures.quotes[0].price = "81000.99";
  await page.route("**/api/markets/futures", (route) =>
    route.fulfill({ json: futures }),
  );
  await page.goto("/");
  await page.getByRole("button", { name: /合约市场/ }).click();
  await expect(page.locator(".price-line strong").first()).toHaveText(
    "81,000.99",
  );
  await page.waitForTimeout(1500);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "合约市场",
  );
  await expect(page.locator(".price-line strong").first()).toHaveText(
    "81,000.99",
  );
});
