import { test, expect } from "@playwright/test";

/**
 * Visual + structural regression for the public landing page (`/`).
 *
 * Covers regressions the user has been bitten by:
 *  - Mobile/PWA hero image disappearing
 *  - Hero CTAs ("Explore the Collection", "Singapore Gallery Preview") losing styling or going missing
 *  - Primary CTA failing to navigate to the designers directory
 *  - Designers directory route becoming unavailable
 *
 * Runs on both projects defined in playwright.config.ts (mobile-chrome 390x844, desktop-chrome 1280x800).
 */

test.describe("Landing page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    // Wait for hero image to actually render.
    await page
      .getByRole("img", { name: /luxury living room/i })
      .first()
      .waitFor({ state: "visible", timeout: 15_000 });
    // Disable animations to stabilize snapshots.
    await page.addStyleTag({
      content: `*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}`,
    });
  });

  test("smoke: hero image + both CTAs + designers section present", async ({ page }) => {
    const heroImg = page.getByRole("img", { name: /luxury living room/i }).first();
    await expect(heroImg).toBeVisible();

    // Image must have a real src that resolved (naturalWidth > 0).
    const naturalWidth = await heroImg.evaluate(
      (el) => (el as HTMLImageElement).naturalWidth,
    );
    expect(naturalWidth, "hero <img> failed to load").toBeGreaterThan(0);

    // Primary and secondary CTAs visible
    await expect(
      page.getByRole("button", { name: /^explore the collection/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /singapore gallery preview/i }),
    ).toBeVisible();

    // The designers route remains available as the primary CTA destination.
    const designersResponse = await page.request.get("/designers");
    expect(designersResponse.ok()).toBeTruthy();
  });

  test("smoke: 'Explore the Collection' CTA opens the designers directory", async ({ page }) => {
    await page.getByRole("button", { name: /^explore the collection/i }).click();
    await expect(page).toHaveURL(/\/designers(?:[/?#]|$)/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /designers?/i }).first()).toBeVisible({ timeout: 10_000 });
  });

  test("visual: above-the-fold hero snapshot", async ({ page }, testInfo) => {
    // Hide the hero image to avoid Cloudinary variance (focus diff on layout/text/CTAs).
    await page.addStyleTag({
      content: `picture img{visibility:hidden!important}`,
    });
    await expect(page).toHaveScreenshot(`landing-hero-${testInfo.project.name}.png`, {
      fullPage: false,
    });
  });
});
