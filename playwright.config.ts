import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PW_PORT ?? 4173);
const BASE_URL = process.env.PW_BASE_URL ?? `http://localhost:${PORT}`;
const CHROMIUM_EXECUTABLE_PATH =
  process.env.PW_CHROMIUM_EXECUTABLE_PATH ||
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "off",
  },
  projects: [
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 5"],
        ...(CHROMIUM_EXECUTABLE_PATH
          ? { launchOptions: { executablePath: CHROMIUM_EXECUTABLE_PATH } }
          : {}),
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
