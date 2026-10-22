import { test, expect, type Locator, type Page } from "@playwright/test";

const MATERIAL = "Frame upholstered in bouclé with legs in solid oak — individually finished in the atelier with a hand-polished natural surface";
const FINISH = "Natural Speckle or Natural Chocolate Speckle Shagreen shade lined in gold leaf with an individually hand-polished bronze support";
const DESCRIPTION = "Frame upholstered in bouclé with legs in solid oak — every surface is finished in the atelier and carefully polished by hand";
const productPath = "/designers/alexander-lamont/geo-table-lamp";
const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

// Never record session restoration. All long text is a read-only response fixture;
// these tests neither edit the catalogue nor create favorites or quotes.
test.use({ trace: "off", video: "off", reducedMotion: "reduce" });

async function expectReadable(text: Locator, page: Page) {
  await expect(text).toBeVisible();
  await expect.poll(() => text.evaluate(element => {
    const range = document.createRange();
    range.selectNodeContents(element);
    const bounds = element.getBoundingClientRect();
    const rects = Array.from(range.getClientRects()).filter(rect => rect.width > 0);
    return element.scrollWidth <= element.clientWidth + 1 && rects.every(rect =>
      rect.left >= bounds.left - 1 && rect.right <= bounds.right + 1 &&
      rect.left >= -1 && rect.right <= window.innerWidth + 1);
  })).toBe(true);
  if ((page.viewportSize()?.width ?? 1280) <= 768) {
    expect(await text.evaluate(element => {
      const range = document.createRange();
      range.selectNodeContents(element);
      return new Set(Array.from(range.getClientRects()).filter(rect => rect.width > 0).map(rect => Math.round(rect.top))).size;
    })).toBeGreaterThan(1);
  }
}

async function exerciseFinishPicker(page: Page) {
  const initialPicker = page.getByRole("combobox").filter({ hasText: /select.*(?:material|finish|shade)/i }).first();
  await expect(initialPicker).toBeVisible();
  await initialPicker.evaluate(element => element.setAttribute("data-wrap-test-picker", "true"));
  const picker = page.locator('[data-wrap-test-picker="true"]');
  await picker.focus();
  await picker.press("Enter");
  await expectReadable(page.getByRole("option", { name: MATERIAL, exact: true }), page);
  const finish = page.getByRole("option", { name: FINISH, exact: true });
  await expectReadable(finish, page);
  await finish.focus();
  await finish.press("Enter");
  await expect(picker).toContainText(FINISH);
  await expectReadable(picker.locator("span").first(), page);
  await picker.focus();
  await picker.press("Enter");
  await page.getByRole("button", { name: "Clear selection", exact: true }).press("Enter");
  await picker.focus();
  await picker.press("Enter");
  await page.getByRole("option", { name: MATERIAL, exact: true }).focus();
  await page.getByRole("option", { name: MATERIAL, exact: true }).press("Enter");
  await expect(picker).toContainText(MATERIAL);
  await expectReadable(picker.locator("span").first(), page);
}

for (const viewport of [
  { width: 375, height: 812 },
  { width: 768, height: 1024 },
  { width: 1280, height: 1800 },
]) {
  test.describe(`long materials and finishes at ${viewport.width}px`, () => {
    test.use({ viewport });
    test.setTimeout(90_000);
    test.afterEach(async ({ page }) => {
      await page.unrouteAll({ behavior: "ignoreErrors" });
    });

    test("public product page wraps options and selected finishes", async ({ page }, testInfo) => {
      await page.route("**/rest/v1/designer_curator_picks_public?**", async route => {
        const response = await route.fetch();
        const payload = await response.json();
        const patch = (row: Record<string, unknown>) => row.slug === "geo-table-lamp" ? {
          ...row, materials: `${MATERIAL}\n${FINISH}`, materials_description: DESCRIPTION,
          size_variants: [], is_upholstered: false,
        } : row;
        await route.fulfill({ response, json: Array.isArray(payload) ? payload.map(patch) : patch(payload) });
      });
      await page.route(/\/rest\/v1\/(?:product_fabrics|product_fabric_swatches_public)\?/, route =>
        route.fulfill({ json: [] }));
      await page.goto(productPath);
      await expect(page.locator(".product-page-root")).toBeVisible({ timeout: 60_000 });
      await exerciseFinishPicker(page);
      await page.locator('[data-wrap-test-picker="true"]').screenshot({ path: testInfo.outputPath("selected-product-finish.png") });
    });

    test("trade lightbox wraps descriptive materials and selectable finishes", async ({ page }, testInfo) => {
      test.skip(!session || !storageKey, "Requires a managed approved trade session.");
      if (!session || !storageKey) return;
      await page.route("**/rest/v1/trade_favorites?**", async route => {
        if (route.request().method() !== "GET") return route.abort();
        await route.fulfill({ json: [{
          id: "c7f69b29-53d4-4b02-9640-9f0406ef90a1",
          product_id: "24a54c89-5589-4b22-a67c-6210c1bde663", notes: null,
          created_at: "2026-10-22T00:00:00Z",
          trade_products: {
            product_name: "Wrapping Regression Lamp", brand_name: "Alexander Lamont",
            image_url: null, category: "Lighting", subcategory: "Table Lights",
            materials: `${MATERIAL}\n${FINISH}`, materials_description: DESCRIPTION,
            dimensions: "Ø 63 x H 50 cm", currency: "EUR",
            trade_price_cents: null, rrp_price_cents: null,
          },
        }] });
      });
      await page.goto("/");
      await page.evaluate(([key, value]) => {
        localStorage.setItem(key, value);
        localStorage.setItem("felix_dashboard_tour_seen_v1", "1");
        localStorage.setItem("trade_quick_tour_done", "1");
        localStorage.setItem("ma_client_safe_mode", "false");
      }, [storageKey, session]);
      await page.goto("/trade/favorites");
      await page.getByText("Wrapping Regression Lamp", { exact: true }).first().click();
      await expectReadable(page.getByText(DESCRIPTION, { exact: true }), page);
      await exerciseFinishPicker(page);
      await page.getByText(DESCRIPTION, { exact: true }).screenshot({ path: testInfo.outputPath("lightbox-materials.png") });
      await page.getByRole("button", { name: "Close", exact: true }).filter({ visible: true }).click();
      await expect(page.getByText(DESCRIPTION, { exact: true })).toBeHidden();
    });
  });
}