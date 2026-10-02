import { expect, test } from "@playwright/test";
import { mockEthStream } from "./eth-stream-fixture";
import { liquidationFixture } from "./liquidation-fixture";

async function open(page: import("@playwright/test").Page) {
  await page.route("**/api/markets/futures", (route) => route.fulfill({ status: 502, json: {} }));
  await page.route("**/api/markets/spot", (route) => route.fulfill({ status: 502, json: {} }));
  await page.goto("/");
}

test("liquidation ladder uses notional as returned, accumulates outward and keeps price directions", async ({ page }) => {
  const mock = await mockEthStream(page);
  await open(page);
  const panel = page.getByRole("article", { name: "ETH 强平估算" });
  const buy = page.getByRole("table", { name: "ETH 强平买盘" });
  const sell = page.getByRole("table", { name: "ETH 强平卖盘" });
  await expect(panel.getByText("估算已加载", { exact: true })).toBeVisible();
  await expect(panel.getByRole("button", { name: "检查估算更新" })).toBeEnabled();
  const checked = page.waitForResponse("**/api/markets/futures/eth/liquidations");
  await panel.getByRole("button", { name: "检查估算更新" }).click();
  await checked;
  await expect(buy.locator(".liq-row")).toHaveCount(2);
  await expect(buy.locator(".liq-row").last().getByRole("cell")).toHaveText(["2,010.00–2,015.00", "300,000", "300,000"]);
  await expect(buy.locator(".liq-row").first().getByRole("cell")).toHaveText(["2,020.00–2,025.00", "500,000", "800,000"]);
  await expect(sell.locator(".liq-row").last().getByRole("cell")).toHaveText(["1,980.00–1,985.00", "600,000", "1,000,000"]);
  await expect(panel).toContainText("原始档宽约 2.0000 USD");
  await panel.getByRole("checkbox", { name: "仅显示非零" }).uncheck();
  await expect(buy.locator(".liq-row")).toHaveCount(3);
  await expect(buy.locator(".liq-row").last().getByRole("cell")).toHaveText(["2,005.00–2,010.00", "0", "0"]);
  mock.send({ price: "2015" });
  await expect(page.getByTestId("liq-current-price")).toHaveText("2,015.00");
  await expect(buy.locator(".liq-row")).toHaveCount(1);
  await expect(buy.locator(".liq-row").first().getByRole("cell")).toHaveText(["2,020.00–2,025.00", "500,000", "500,000"]);
  await expect(sell).not.toContainText("2,010.00");
  await expect(panel).toContainText("有 1 个非零价档位于当前价另一侧");
  expect(mock.active.size).toBe(1);
  await page.screenshot({ path: "../.local/eth-liquidations-desktop.png", fullPage: true });
});

test("price grouping preserves full-bin amounts, respects boundaries and adapts to source width", async ({ page }) => {
  await page.clock.install();
  await mockEthStream(page);
  let width = 2.7;
  await page.route("**/api/markets/futures/eth/liquidations", (route) => {
    const fixture = liquidationFixture();
    fixture.data!.bin_width = width;
    fixture.data!.bins = [
      { price: 1994.99, side: "long", total: 100 },
      { price: 1995, side: "long", total: 200 },
      { price: 1999.99, side: "long", total: 300 },
      { price: 2005, side: "short", total: 100 },
      { price: 2009.99, side: "short", total: 200 },
      { price: 2010, side: "short", total: 300 },
      { price: 2014.99, side: "short", total: 400 },
      { price: 2015, side: "short", total: 500 },
    ];
    return route.fulfill({ json: fixture });
  });
  await open(page);
  const panel = page.getByRole("article", { name: "ETH 强平估算" });
  const buy = page.getByRole("table", { name: "ETH 强平买盘" });
  const sell = page.getByRole("table", { name: "ETH 强平卖盘" });
  const grouping = panel.getByRole("combobox", { name: "强平价格分组" });
  await expect(grouping).toHaveValue("5");
  await expect(grouping.locator('option[value="1"]')).toHaveJSProperty("disabled", true);
  await expect(buy.locator(".liq-row")).toHaveCount(3);
  await expect(buy.locator(".liq-row").last().getByRole("cell")).toHaveText(["2,005.00–2,010.00", "300", "300"]);
  await expect(buy.locator(".liq-row").nth(1).getByRole("cell")).toHaveText(["2,010.00–2,015.00", "700", "1,000"]);
  await expect(sell.locator(".liq-row").first().getByRole("cell")).toHaveText(["1,995.00–2,000.00", "500", "500"]);
  await expect(panel.locator(".liq-summary strong")).toHaveText(["1,500 USD", "600 USD"]);
  await grouping.selectOption("10");
  await expect(buy.locator(".liq-row")).toHaveCount(2);
  await expect(buy.locator(".liq-row").first().getByRole("cell")).toHaveText(["2,010.00–2,020.00", "1,200", "1,500"]);
  await expect(sell.locator(".liq-row").first().getByRole("cell")).toHaveText(["1,990.00–2,000.00", "600", "600"]);
  await expect(panel.locator(".liq-summary strong")).toHaveText(["1,500 USD", "600 USD"]);
  await grouping.selectOption("0");
  await expect(buy.locator(".liq-row")).toHaveCount(5);
  await expect(buy.getByRole("columnheader").first()).toHaveText("价格档 (USD)");
  await expect(buy.locator(".liq-row").first().getByRole("cell")).toHaveText(["2,015.00", "500", "1,500"]);
  await grouping.selectOption("5");
  width = 7;
  await page.clock.fastForward(15_100);
  await expect(grouping).toHaveValue("10");
  await expect(grouping.locator('option[value="5"]')).toHaveJSProperty("disabled", true);
  await expect(panel.locator(".liq-summary strong")).toHaveText(["1,500 USD", "600 USD"]);
});

test("polling replaces snapshots, retains errors and stops when hidden or leaving ETH", async ({ page }) => {
  await page.clock.install();
  await mockEthStream(page);
  let requests = 0;
  let fail = false;
  let total = 300_000;
  await page.route("**/api/markets/futures/eth/liquidations", (route) => {
    requests++;
    const fixture = liquidationFixture();
    fixture.data!.bins = [{ price: 2010, side: "short", total }];
    return route.fulfill({ status: fail ? 502 : 200, json: fail ? {} : fixture });
  });
  await open(page);
  const panel = page.getByRole("article", { name: "ETH 强平估算" });
  const amount = page.getByRole("table", { name: "ETH 强平买盘" }).locator(".liq-row").getByRole("cell").nth(1);
  await expect(amount).toHaveText("300,000");
  const initial = requests;
  total = 120_000;
  await page.clock.fastForward(15_100);
  await expect(amount).toHaveText("120,000");
  expect(requests).toBe(initial + 1);
  fail = true;
  await page.clock.fastForward(15_100);
  await expect(panel).toContainText("上次估算 · 待更新");
  await expect(amount).toHaveText("120,000");
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  const beforePause = requests;
  await page.clock.fastForward(60_000);
  expect(requests).toBe(beforePause);
  await expect(panel).toContainText("估算检查已暂停");
  fail = false;
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(panel.getByText("估算已加载", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "BTC", exact: true }).click();
  await expect(panel).toHaveCount(0);
  const beforeLeave = requests;
  await page.clock.fastForward(60_000);
  expect(requests).toBe(beforeLeave);
});

test("unavailable estimates never show fabricated zero totals and recover on mobile", async ({ page }) => {
  await page.clock.install();
  await mockEthStream(page);
  let unavailable = true;
  await page.route("**/api/markets/futures/eth/liquidations", (route) => {
    const fixture = liquidationFixture();
    if (unavailable) {
      fixture.status = "unavailable";
      fixture.data = null;
      fixture.message = "CoinBoss 请求频率受限，将在冷却结束后自动重试。";
    }
    return route.fulfill({ json: fixture });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await open(page);
  const panel = page.getByRole("article", { name: "ETH 强平估算" });
  await expect(panel).toContainText("估算暂不可用");
  await expect(panel.locator(".liq-summary strong")).toHaveText(["— USD", "— USD"]);
  await expect(page.getByTestId("liq-current-price")).toHaveText("2,000.00");
  unavailable = false;
  await page.clock.fastForward(15_100);
  await expect(panel.getByText("估算已加载", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: "../.local/eth-liquidations-mobile.png" });
});

test("old models and unavailable live price have explicit age and reference labels", async ({ page }) => {
  const mock = await mockEthStream(page);
  mock.send({ price: null, price_status: "connecting" });
  await page.route("**/api/markets/futures/eth/liquidations", (route) => {
    const fixture = liquidationFixture();
    fixture.data!.updated_at -= 700_000;
    return route.fulfill({ json: fixture });
  });
  await open(page);
  const panel = page.getByRole("article", { name: "ETH 强平估算" });
  await expect(panel).toContainText("上次估算 · 待更新");
  await expect(panel).toContainText("CoinBoss 模型参考价");
  await expect(panel).toContainText("超过 10 分钟未更新");
  await expect(page.getByTestId("liq-current-price")).toHaveText("2,000.00");
});
