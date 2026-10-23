import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, trace: "off", video: "off" });

test("mobile sign-in shows the desktop tour notice", async ({ page }) => {
  await page.goto("/trade/login");
  await expect(page.getByRole("note", { name: "Desktop onboarding tour" })).toBeVisible();
});

test("mobile Trade arrival blocks automatic, resumed and manual tours without completing them", async ({ page }) => {
  test.skip(!session || !storageKey, "Requires a managed Trade session.");
  if (!session || !storageKey) return;
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.setItem("felix_tour_progress_v1", "21");
    localStorage.setItem("trade_quick_tour_step", "0");
    localStorage.setItem("trade_quick_tour_done", "1");
  }, [storageKey, session]);
  await page.goto("/trade");
  await expect(page.getByRole("note", { name: "Desktop onboarding tour" })).toBeVisible({ timeout: 45000 });
  await page.evaluate(() => {
    window.dispatchEvent(new Event("felix-tour:start"));
    window.dispatchEvent(new Event("trade-tour:start"));
  });
  await expect(page.locator('html[data-felix-tour-active="true"]')).toHaveCount(0);
  await expect(page.locator("body[data-tour-step]")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("felix_dashboard_tour_seen_v1"))).toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("felix_tour_progress_v1"))).toBe("21");
});