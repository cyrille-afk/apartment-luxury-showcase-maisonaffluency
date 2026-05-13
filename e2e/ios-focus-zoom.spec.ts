import { test, expect, devices } from "@playwright/test";

/**
 * iOS Safari focus/typing zoom guard.
 *
 * Mobile Safari auto-zooms (and won't always zoom back) when a focused
 * form control's *computed* font-size is below 16px. We enforce a 16px
 * floor in src/index.css for every editable surface; this suite walks
 * every form control on key routes, focuses it, types into it where
 * possible, and asserts the computed font-size stays ≥ 16px both at
 * rest and after typing.
 *
 * Runs in two iPhone Safari viewports (portrait + a smaller older device)
 * to cover both modern and legacy form-factors.
 */

const ROUTES = [
  "/trade/login",
  "/contact",
];

const FIELD_SELECTOR = [
  "input:not([type='hidden']):not([type='checkbox']):not([type='radio']):not([type='range']):not([type='file']):not([type='color']):not([type='submit']):not([type='button']):not([type='reset'])",
  "textarea",
  "select",
  "[contenteditable='true']",
  "[contenteditable='']",
  "[role='textbox']",
  "[role='combobox']",
  "[role='searchbox']",
  "[role='spinbutton']",
].join(",");

const MIN_FONT_PX = 16;

const PROFILES = [
  { name: "iPhone 13", device: devices["iPhone 13"] },
  { name: "iPhone SE", device: devices["iPhone SE"] },
];

for (const profile of PROFILES) {
  test.describe(`iOS focus-zoom guard — ${profile.name}`, () => {
    test.use({ ...profile.device });

    for (const route of ROUTES) {
      test(`every focusable form control stays ≥${MIN_FONT_PX}px on ${route}`, async ({ page }) => {
        const consoleErrors: string[] = [];
        page.on("pageerror", (e) => consoleErrors.push(String(e)));

        await page.goto(route);
        await page.waitForLoadState("networkidle");

        // Collect every visible, enabled form control on the page.
        const handles = await page.locator(FIELD_SELECTOR).elementHandles();
        const offenders: Array<{
          tag: string;
          type: string | null;
          name: string | null;
          phase: "rest" | "focus" | "typed";
          fontSizePx: number;
          identifier: string;
        }> = [];

        let visited = 0;
        for (const h of handles) {
          const visible = await h.isVisible().catch(() => false);
          if (!visible) continue;
          const disabled = await h.isDisabled().catch(() => false);
          if (disabled) continue;

          const meta = await h.evaluate((el) => {
            const e = el as HTMLElement & { type?: string; name?: string };
            return {
              tag: e.tagName.toLowerCase(),
              type: (e.getAttribute("type") || e.type || null) as string | null,
              name: e.getAttribute("name") || e.getAttribute("aria-label") || e.id || null,
              identifier:
                e.getAttribute("name") ||
                e.getAttribute("aria-label") ||
                e.id ||
                e.getAttribute("placeholder") ||
                e.tagName.toLowerCase(),
              isTextLike:
                e.tagName === "TEXTAREA" ||
                e.isContentEditable ||
                (e.tagName === "INPUT" &&
                  ["text", "email", "password", "search", "tel", "url", "number", ""].includes(
                    (e.getAttribute("type") || "text").toLowerCase()
                  )),
            };
          });

          const measure = async (phase: "rest" | "focus" | "typed") => {
            const px = await h.evaluate((el) => {
              const cs = getComputedStyle(el as Element);
              return parseFloat(cs.fontSize);
            });
            if (px < MIN_FONT_PX - 0.01) {
              offenders.push({ ...meta, phase, fontSizePx: px });
            }
            return px;
          };

          await measure("rest");

          // Focus phase.
          await h.scrollIntoViewIfNeeded().catch(() => {});
          await h.focus().catch(() => {});
          await measure("focus");

          // Typing phase (only for text-like fields, to avoid breaking selects/comboboxes).
          if (meta.isTextLike) {
            try {
              await h.type("a", { delay: 0 });
              await measure("typed");
              // Clean up — best effort, ignore failures on managed inputs.
              await h.evaluate((el) => {
                const e = el as HTMLInputElement | HTMLTextAreaElement;
                if ("value" in e) e.value = "";
              }).catch(() => {});
            } catch {
              /* non-typeable surface — skip */
            }
          }

          // Blur to reset state for the next field.
          await h.evaluate((el) => (el as HTMLElement).blur()).catch(() => {});
          visited++;
        }

        expect(visited, `no form controls were tested on ${route}`).toBeGreaterThan(0);
        expect(
          offenders,
          `Form controls below ${MIN_FONT_PX}px (would trigger iOS Safari zoom):\n` +
            JSON.stringify(offenders, null, 2)
        ).toEqual([]);
        expect(consoleErrors).toEqual([]);
      });
    }
  });
}
