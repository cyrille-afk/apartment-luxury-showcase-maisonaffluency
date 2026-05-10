import { test, expect, devices } from "@playwright/test";

/**
 * Verifies the ParallaxInterlude component is hidden at mobile widths
 * (< 768px / Tailwind `md` breakpoint) on every public route that could
 * conceivably render it. Today only `/` mounts it, but we sweep a broader
 * route set so future regressions surface immediately.
 *
 * The component carries `data-testid="parallax-interlude"` and uses
 * `hidden md:block`, so on mobile it should either not be in the DOM
 * or — if rendered — not be visible.
 */

const ROUTES = [
  "/",
  "/designers",
  "/collectibles",
  "/gallery",
  "/journal",
  "/new-in",
  "/contact",
  "/apartment-tour",
  "/studios",
  "/trade-program",
];

const MOBILE_VIEWPORTS = [
  { name: "iPhone-12", width: 390, height: 844 },
  { name: "small-mobile", width: 360, height: 800 },
  { name: "just-under-md", width: 767, height: 1000 },
];

test.describe("ParallaxInterlude is hidden on mobile", () => {
  for (const vp of MOBILE_VIEWPORTS) {
    test.describe(`viewport ${vp.name} (${vp.width}px)`, () => {
      test.use({ viewport: { width: vp.width, height: vp.height } });

      for (const route of ROUTES) {
        test(`route ${route}`, async ({ page }) => {
          const errors: string[] = [];
          page.on("pageerror", (e) => errors.push(e.message));

          await page.goto(route, { waitUntil: "domcontentloaded" });
          // Allow lazy chunks / suspense fallbacks to settle.
          await page
            .waitForLoadState("networkidle", { timeout: 15_000 })
            .catch(() => {});

          const interludes = page.locator('[data-testid="parallax-interlude"]');
          const count = await interludes.count();

          for (let i = 0; i < count; i++) {
            await expect(
              interludes.nth(i),
              `ParallaxInterlude #${i} should be hidden at ${vp.width}px on ${route}`,
            ).toBeHidden();
          }

          // Sanity: no runtime errors leaked from the route itself.
          expect(errors, `pageerrors on ${route}`).toEqual([]);
        });
      }
    });
  }
});
