import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

test("Margin Protection continues into both quote steps without crashing", async ({ page }) => {
  test.skip(!session || !storageKey, "Requires a managed trade session.");
  test.setTimeout(120_000);
  if (!session || !storageKey) return;
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.setItem("felix_tour_progress_v1", "6");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade/products/sebastian-herkner-man-of-parts/praia-da-granja-coffee-table");
  await expect(page.getByRole("dialog").filter({ hasText: "Absolute Margin Protection" })).toBeVisible({ timeout: 60_000 });
  await expect(page.locator("html")).toHaveAttribute("data-client-view", "active");
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/trade\/quotes$/);
  await expect(page.getByRole("dialog").filter({ hasText: "Professional Quote Generation" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator("html")).toHaveAttribute("data-client-view", "inactive");
  await expect(page.locator('[data-felix-target="quotes-create"]')).toBeVisible();
  await expect(page.locator('head link[rel="canonical"]')).toHaveCount(1);
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "Direct Client Billing" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-felix-target="quote-document-actions"]')).toBeVisible();
  expect(errors).toEqual([]);
});