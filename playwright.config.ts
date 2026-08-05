import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3001", trace: "on-first-retry" },
  webServer: { command: "node scripts/next.mjs dev --port 3001", url: "http://127.0.0.1:3001", reuseExistingServer: true, timeout: 120_000 },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], channel: "chrome" } }],
});
