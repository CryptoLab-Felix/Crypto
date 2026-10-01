import { defineConfig } from "@playwright/test";
import baseConfig from "./playwright.config";

export default defineConfig(baseConfig, {
  forbidOnly: true,
  grepInvert: /@live/,
  reporter: [
    [process.env.CI ? "github" : "list"],
    ["html", { open: "never" }],
  ],
  use: {
    baseURL: "http://127.0.0.1:4173",
    channel: undefined,
  },
  webServer: {
    command: "npm run preview",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
