import { expect, test } from "@playwright/test";
import { mockEthStream } from "./eth-stream-fixture";

async function openEth(page: import("@playwright/test").Page) {
  // REST statistics can fail independently of the streaming feature.
  await page.route("**/api/markets/spot", (route) => route.fulfill({ status: 502, json: {} }));
  await page.route("**/api/markets/futures", (route) => route.fulfill({ status: 502, json: {} }));
  await page.goto("/");
}

test("ETH depth groups prices, accumulates outward, and applies live updates", async ({ page }) => {
  const mock = await mockEthStream(page);
  await openEth(page);
  await expect(page.getByTestId("eth-live-price")).toHaveText("2,000.00");
  const asks = page.getByRole("table", { name: "ETH 卖盘" });
  const bids = page.getByRole("table", { name: "ETH 买盘" });
  await expect(asks.locator(".depth-row")).toHaveCount(2);
  await expect(asks.locator(".depth-row").last()).toContainText("2,000.00–2,001.00");
  await expect(asks.locator(".depth-row").last().getByRole("cell").nth(1)).toHaveText("5.000");
  await expect(asks.locator(".depth-row").first().getByRole("cell").nth(2)).toHaveText("9.000");
  await expect(asks.locator(".depth-row").last().getByRole("cell").nth(3)).toHaveText("10,000.80");
  await expect(bids.locator(".depth-row").first().getByRole("cell").nth(1)).toHaveText("4.000");
  await page.getByRole("combobox", { name: "价格分组" }).selectOption("0.1");
  await expect(asks.locator(".depth-row")).toHaveCount(3);
  await expect(asks.locator(".depth-row").last()).toContainText("2,000.10–2,000.20");
  await page.getByRole("combobox", { name: "价格分组" }).selectOption("0");
  mock.send({ price: "2000.25", asks: [["2000.30", "1"], ["2001.20", "4"]], bids: [["2000.20", "2"]] });
  await expect(page.getByTestId("eth-live-price")).toHaveText("2,000.25", { timeout: 1500 });
  await expect(asks.locator(".depth-row")).toHaveCount(2);
  await expect(asks).not.toContainText("2,000.10");
  await expect(bids.locator(".depth-row")).toHaveCount(1);
  expect(mock.active.size).toBe(1);
});

test("ETH stream preserves stale data, reconnects, and releases when leaving or hidden", async ({ page }) => {
  const mock = await mockEthStream(page);
  await openEth(page);
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
  const initialConnections = mock.connections.length;
  mock.send({ book_status: "reconnecting", price: "2000.50" });
  await expect(page.getByText("盘口重连中 · 上次数据", { exact: true })).toBeVisible();
  await expect(page.getByTestId("eth-live-price")).toHaveText("2,000.50");
  await expect(page.getByRole("table", { name: "ETH 卖盘" }).locator(".depth-row")).toHaveCount(2);
  mock.pause();
  mock.connections.at(-1)!.close();
  await expect.poll(() => mock.connections.length).toBe(initialConnections + 1);
  mock.send({ book_status: "live", price_status: "live", book_received_at: Date.now() });
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("后台已暂停", { exact: true })).toBeVisible();
  await expect.poll(() => mock.active.size).toBe(0);
  mock.resume();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "BTC", exact: true }).click();
  await expect(page.locator(".eth-orderbook")).toHaveCount(0);
  await expect.poll(() => mock.active.size).toBe(0);
});

test("ETH silent transport is marked stale and retried; mobile layout stays within viewport", async ({ page }) => {
  const mock = await mockEthStream(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await openEth(page);
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.local/eth-orderbook-mobile.png", fullPage: true });
  mock.pause();
  const initialConnections = mock.connections.length;
  await expect(page.getByText("盘口重连中 · 上次数据", { exact: true })).toBeVisible({ timeout: 8_000 });
  await expect(page.getByTestId("eth-live-price")).toHaveText("2,000.00");
  await expect(page.locator(".eth-orderbook .stale-label")).toBeVisible();
  await expect.poll(() => mock.connections.length).toBeGreaterThan(initialConnections);
  mock.resume();
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
});

test("REST cooldown survives market switches and polling while live ETH updates continue", async ({ page }) => {
  await page.clock.install();
  const mock = await mockEthStream(page);
  await openEth(page);
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
  let requests = 0;
  await page.route("**/api/markets/futures", (route) => {
    requests += 1;
    return route.fulfill({ status: 502, json: {} });
  });
  const retryAt = await page.evaluate(() => Date.now() + 120_000);
  const cooldown = { http_status: 418 as const, retry_at: retryAt, message: "币安暂时封禁当前网络出口，合约行情查询已暂停。" };
  mock.send({ rest_cooldown: cooldown });
  const notice = page.locator(".rest-cooldown");
  await expect(notice).toContainText("币安暂时封禁当前网络出口");
  await expect(notice).toContainText("北京时间");
  await expect(page.getByRole("button", { name: "刷新行情", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "重新连接", exact: true })).toBeDisabled();
  mock.send({ price: "2002.75" });
  await expect(page.getByTestId("eth-live-price")).toHaveText("2,002.75");
  await expect(page.getByText("盘口实时连接", { exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: "../.local/eth-cooldown-mobile.png", fullPage: true });
  await page.getByRole("button", { name: /现货市场/ }).click();
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("button", { name: "刷新行情", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: /合约市场/ }).click();
  await expect(notice).toBeVisible();
  await page.clock.fastForward(31_000);
  expect(requests).toBe(0);
  await expect(page.getByRole("button", { name: "刷新行情", exact: true })).toBeDisabled();
  await page.clock.fastForward(91_000);
  await expect(notice).toHaveCount(0);
  await expect.poll(() => requests).toBeGreaterThan(0);
  await expect(page.getByRole("button", { name: "刷新行情", exact: true })).toBeEnabled();
});

test("REST error exposes its cooldown before the book connects", async ({ page }) => {
  const cooldown = { http_status: 429 as const, retry_at: Date.now() + 60_000, message: "币安请求频率受限，合约行情查询已暂停。" };
  const mock = await mockEthStream(page);
  mock.pause();
  await page.route("**/api/markets/spot", (route) => route.fulfill({ status: 502, json: {} }));
  await page.route("**/api/markets/futures", (route) => route.fulfill({
    status: 429, json: { detail: { message: cooldown.message, rest_cooldown: cooldown } },
  }));
  await page.goto("/");
  await expect(page.locator(".rest-cooldown")).toContainText("币安请求频率受限");
  await expect(page.getByRole("button", { name: "刷新行情", exact: true })).toBeDisabled();
  await expect.poll(() => mock.active.size).toBeGreaterThan(0);
  mock.send({ asks: [], bids: [], book_status: "reconnecting", rest_cooldown: cooldown });
  await expect(page.getByText("盘口同步等待解除限制", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "重新连接", exact: true })).toBeDisabled();
  // A concurrent 418 may upgrade severity without extending the shared deadline.
  mock.send({ rest_cooldown: { ...cooldown, http_status: 418 } });
  await expect(page.locator(".rest-cooldown")).toContainText("币安暂时封禁当前网络出口");
});
