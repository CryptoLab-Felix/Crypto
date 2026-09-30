import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:5173",
    channel:
      process.env.PLAYWRIGHT_CHANNEL ??
      (process.platform === "win32" ? "chrome" : undefined),
    viewport: { width: 1440, height: 1000 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
});
