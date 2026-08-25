import { test, expect } from "@playwright/test";

/**
 * Structural smoke checks for the key trade-facing routes. These are not pixel
 * snapshots (DB-backed content shifts too often) — they assert that the page
 * loaded, navigation chrome rendered, and at least one expected anchor is present.
 */

test.describe("Designers index", () => {
  test("loads and renders the designers grid", async ({ page }) => {
    const response = await page.goto("/designers", { waitUntil: "domcontentloaded" });
    expect(response?.ok(), "GET /designers must return 2xx").toBeTruthy();

    // Page heading should mention designers (h1/h2 — match either).
    const headings = page.getByRole("heading", { name: /designers?/i });
    await expect(headings.first()).toBeVisible({ timeout: 10_000 });

    // No empty body crash.
    const bodyText = (await page.locator("body").innerText()).trim();
    expect(bodyText.length).toBeGreaterThan(50);

    // Console errors → fail (excluding noisy 3rd-party).
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    await page.waitForTimeout(500);
    expect(errors, "uncaught runtime errors on /designers").toHaveLength(0);
  });

  test("mobile/PWA: hero directory remains inside the visible viewport", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "mobile-only layout guard");

    const directoryButton = () => page.getByRole("button", { name: /search 150\+ designers/i }).first();
    const measure = async (url: string) => {
      await page.goto(url, { waitUntil: "domcontentloaded" });
      await expect(directoryButton()).toBeVisible({ timeout: 15_000 });
      return directoryButton().evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, bottomGap: window.innerHeight - rect.bottom };
      });
    };

    const mobileBrowser = await measure("/designers");
    const pwaStandalone = await measure("/designers?source=pwa");

    // Playwright's mobile viewport represents the visible area above browser
    // chrome, so a small positive inset is the correct safety requirement.
    expect(mobileBrowser.bottomGap, "browser mobile directory must remain inside the visible viewport").toBeGreaterThan(16);
    expect(pwaStandalone.bottomGap, "PWA directory must remain inside the visible viewport").toBeGreaterThan(8);
  });
});

test.describe("Sample public product page", () => {
  test("first designer card links to a working product page", async ({ page }) => {
    await page.goto("/designers", { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => {});

    // Find first internal link to /designers/:slug/:product or /product/:id
    const productLink = page
      .locator(
        'a[href^="/designers/"][href*="/"][href*="-"], a[href^="/product/"]',
      )
      .filter({ hasNot: page.locator("[href$='/designers/']") })
      .first();

    const count = await productLink.count();
    test.skip(count === 0, "No product link discoverable from /designers in this env");

    const href = await productLink.getAttribute("href");
    await productLink.click();
    await page.waitForLoadState("domcontentloaded");

    // Asserts we landed on a product-shaped URL and the page has content.
    expect(page.url(), `clicked link ${href} should land on a product page`).toMatch(
      /\/(product|designers)\/[^/]+/,
    );
    const body = (await page.locator("body").innerText()).trim();
    expect(body.length).toBeGreaterThan(100);
  });
});
