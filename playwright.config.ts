import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 4173);
const BASE_URL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`;
const CHROMIUM_EXECUTABLE_PATH =
  process.env.PW_CHROMIUM_EXECUTABLE_PATH ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  // Run E2E in sequence under CI: parallel Playwright+Lighthouse routinely OOMs
  // standard ubuntu-latest runners (see PWA CI fixes #3).
  fullyParallel: !process.env.CI,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["list"], ["html", { open: "never", outputFolder: "playwright-report" }]]
    : [["list"]],
  use: {
    baseURL: BASE_URL,
    // retain-on-failure keeps a downloadable trace of failed runs for Trace Viewer.
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  // Pixel diff tolerance — small AA/font shifts shouldn't fail the build,
  // real layout/CTA regressions will.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.02, animations: "disabled" },
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 390, height: 844 },
        launchOptions: {
          // CI hardening: avoid sandbox/GPU issues on GitHub Actions headless runners.
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
          ...(CHROMIUM_EXECUTABLE_PATH ? { executablePath: CHROMIUM_EXECUTABLE_PATH } : {}),
        },
      },
    },
    {
      name: "desktop-chrome",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-gpu"],
          ...(CHROMIUM_EXECUTABLE_PATH ? { executablePath: CHROMIUM_EXECUTABLE_PATH } : {}),
        },
      },
    },
  ],
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: `npm run build && npm run preview -- --port ${PORT} --strictPort`,
        url: BASE_URL,
        reuseExistingServer: true,
        timeout: 180_000,
      },
});
