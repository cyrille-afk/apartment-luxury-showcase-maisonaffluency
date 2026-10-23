import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

for (const loading of ["module", "data"] as const) {
test(`Step 6 to 7 waits for slow product ${loading} before declaring its price unavailable`, async ({ page }) => {
  test.skip(!session || !storageKey, "Requires a managed trade session.");
  if (!session || !storageKey) return;
  test.setTimeout(120_000);
  let releaseProduct: (() => void) | undefined;
  const productReady = new Promise<void>(resolve => { releaseProduct = resolve; });
  if (loading === "module") {
    await page.route("**/src/pages/TradeProductPage.tsx*", async route => {
      await productReady;
      await route.continue();
    });
  } else {
    await page.route("**/rest/v1/designers*", async route => {
      if (new URL(route.request().url()).searchParams.get("slug") === "eq.sebastian-herkner-man-of-parts") await productReady;
      await route.continue();
    });
  }
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.setItem("felix_tour_progress_v1", "5");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade/the-collection");
  const card = page.locator("[data-felix-tour-card]");
  await expect(card.filter({ hasText: "Client-Safe Presentations" })).toBeVisible({ timeout: 60_000 });
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/praia-da-granja-coffee-table$/);
  await expect(page.locator("[data-trade-page-loading]").first()).toBeVisible();
  await page.waitForTimeout(9000);
  await expect(page.getByText("This feature is not available here yet.", { exact: false })).toHaveCount(0);
  releaseProduct?.();
  await expect(card.filter({ hasText: "Absolute Margin Protection" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-felix-target="client-view-product-price"]')).toBeVisible();
  await card.getByRole("button", { name: "Next", exact: true }).click();
  await expect(card.filter({ hasText: "Professional Quote Generation" })).toBeVisible({ timeout: 30_000 });
  await expect(page.locator('[data-felix-target="quotes-create"]')).toBeVisible();
});
}

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