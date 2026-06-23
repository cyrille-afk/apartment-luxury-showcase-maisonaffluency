import { test, expect } from "@playwright/test";

/**
 * Visual + structural regression for the public landing page (`/`).
 *
 * Covers regressions the user has been bitten by:
 *  - Mobile/PWA hero image disappearing
 *  - Hero CTAs ("Explore Our Curated Collection", "Meet our Designers") losing styling or going missing
 *  - "Meet our Designers" anchor scroll target missing
 *  - Designers hover hero section disappearing under #meet-designers
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

    // Both CTAs visible
    await expect(
      page.getByRole("button", { name: /explore our curated collection/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /meet our designers/i }),
    ).toBeVisible();

    // Meet-designers scroll target exists in the DOM
    await expect(page.locator("#meet-designers")).toHaveCount(1);
  });

  test("smoke: 'Meet our Designers' CTA scrolls to designers section", async ({ page }) => {
    await page.getByRole("button", { name: /meet our designers/i }).click();
    const section = page.locator("#meet-designers");
    await expect(section).toBeInViewport({ timeout: 5_000 });

    // Wait past the smooth-scroll + lazy section layout window. This catches
    // regressions where the CTA briefly hits the target, then scroll-restore or
    // lazy content above it pushes the target out of view.
    await page.waitForTimeout(2_500);
    await expect(section).toBeInViewport();

    const top = await section.evaluate((el) => el.getBoundingClientRect().top);
    expect(top, "designers section should settle below the fixed header").toBeGreaterThanOrEqual(80);
    expect(top, "designers section should not settle far below the viewport").toBeLessThan(220);
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
