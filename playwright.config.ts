import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  // CanvasKit's software WebGL backends contend heavily when Chromium and
  // WebKit render page-turn meshes at the same time, stretching a sub-second
  // turn beyond assertion timeouts. Run the two browser projects serially.
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  timeout: 45_000,
  use: {
    baseURL: "http://127.0.0.1:8091",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "pnpm --filter @persimmon/app exec expo start --web --port 8091",
    url: "http://127.0.0.1:8091",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
