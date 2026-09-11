import { test, expect, devices } from "@playwright/test";

/**
 * Guards the mobile header wordmark against silent shrinkage.
 *
 * History: the AFFLUENCY logo was progressively stepped down
 * (1.65rem → 1.4rem → 1.15rem → 1.02rem) while fixing narrow-phone overflow,
 * which visibly shrank the brand on common phones. The sizes below are the
 * locked reference; changing them must be a deliberate edit to this spec.
 *
 * Source: src/components/Navigation.tsx
 *   text-[1.05rem] xs:text-[1.65rem]
 */

const SMALL = 16.8; // 1.05rem
const FULL = 26.4; // 1.65rem

const BREAKPOINTS = [
  { width: 320, height: 568, label: "iPhone SE (1st gen)", fontPx: SMALL },
  { width: 360, height: 800, label: "Android baseline", fontPx: FULL },
  { width: 375, height: 667, label: "iPhone SE / mini", fontPx: FULL },
  { width: 390, height: 844, label: "iPhone 14/15", fontPx: FULL },
  { width: 414, height: 896, label: "iPhone Plus/Max", fontPx: FULL },
  { width: 430, height: 932, label: "iPhone Pro Max", fontPx: FULL },
] as const;

const ROUTES = ["/", "/trade-program"] as const;

test.describe("Mobile header logo", () => {
  for (const bp of BREAKPOINTS) {
    for (const route of ROUTES) {
      test(`${bp.width}px (${bp.label}) — ${route} keeps the locked wordmark size`, async ({
        browser,
      }) => {
        const context = await browser.newContext({
          ...devices["Pixel 5"],
          viewport: { width: bp.width, height: bp.height },
          isMobile: true,
          hasTouch: true,
        });
        const page = await context.newPage();
        try {
          await page.goto(route, { waitUntil: "domcontentloaded" });

          const logo = page.getByTestId("mobile-brand-logo");
          await expect(logo).toBeVisible({ timeout: 15_000 });
          await expect(logo).toHaveText(/AFFLUENCY/);

          // 1. Font size matches the locked step for this breakpoint.
          const fontSize = await logo.evaluate(
            (el) => parseFloat(getComputedStyle(el).fontSize),
          );
          expect(
            fontSize,
            `logo font-size at ${bp.width}px should be ${bp.fontPx}px`,
          ).toBeCloseTo(bp.fontPx, 1);

          // 2. The wordmark must still fit inside the viewport (no clipping,
          //    which is what previous shrink fixes were trying to solve).
          const box = await logo.boundingBox();
          expect(box, "logo has no layout box").not.toBeNull();
          expect(box!.x).toBeGreaterThanOrEqual(-1);
          expect(box!.x + box!.width).toBeLessThanOrEqual(bp.width + 1);

          // 3. It must not be cut off by a clipping ancestor in the header
          //    (the wordmark sits inside truncate / overflow-hidden wrappers).
          const truncated = await logo.evaluate((el) => {
            const rect = el.getBoundingClientRect();
            let node = el.parentElement;
            for (let depth = 0; node && depth < 4; depth++, node = node.parentElement) {
              const style = getComputedStyle(node);
              if (style.overflowX === "hidden" || style.overflowX === "clip") {
                const clip = node.getBoundingClientRect();
                if (rect.left < clip.left - 1 || rect.right > clip.right + 1) return true;
              }
            }
            return false;
          });
          expect(truncated, `logo is clipped at ${bp.width}px`).toBe(false);
        } finally {
          await context.close();
        }
      });
    }
  }
});
