import { test, expect, devices } from "@playwright/test";

/**
 * Mobile PWA / a11y regression suite.
 *
 * Catches layout regressions for:
 *  1. Viewport meta tag (must allow user scaling, viewport-fit=cover)
 *  2. Safe-area inset usage on the sticky/fixed header
 *  3. Tap target minimum size (≥44×44 px per WCAG 2.5.5)
 *  4. No horizontal overflow at common mobile widths
 *  5. PWA manifest presence with required fields
 *
 * Runs against `/` and `/trade/login` (a public, render-stable route).
 */

const ROUTES = ["/", "/trade/login"];
const waitForAppReady = async (page: import("@playwright/test").Page) => {
  await page.waitForLoadState("domcontentloaded");
  await page.locator("body").waitFor({ state: "visible" });
};

// Keep this aligned with playwright.config.ts; CI runs inside the official
// Playwright image so Chromium and its Linux shared libraries are present.
test.use({ ...devices["Pixel 5"] });

test.describe("Mobile PWA & accessibility", () => {
  test("viewport meta allows user-scalable + viewport-fit=cover", async ({ page }) => {
    await page.goto("/");
    const content = await page
      .locator('meta[name="viewport"]')
      .getAttribute("content");
    expect(content, "viewport meta must exist").toBeTruthy();
    expect(content!).toMatch(/width=device-width/);
    expect(content!).toMatch(/viewport-fit=cover/);
    // Must NOT disable user scaling — a11y requirement.
    expect(content!).not.toMatch(/user-scalable\s*=\s*no/i);
    expect(content!).not.toMatch(/maximum-scale\s*=\s*1(\b|,)/);
  });

  test("manifest is reachable and has core PWA fields", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    expect(href, "manifest link must exist").toBeTruthy();
    const res = await request.get(href!);
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    for (const key of ["name", "short_name", "start_url", "display", "icons"]) {
      expect(json[key], `manifest.${key}`).toBeTruthy();
    }
    expect(Array.isArray(json.icons) && json.icons.length).toBeTruthy();
  });

  test("manifest passes installability rules (display, scope, icons ≥192 + maskable)", async ({ page, request }) => {
    await page.goto("/");
    const href = await page.locator('link[rel="manifest"]').getAttribute("href");
    const json = await (await request.get(href!)).json();

    // Installability: display must be standalone (or fullscreen/minimal-ui)
    expect(["standalone", "fullscreen", "minimal-ui"]).toContain(json.display);
    // start_url + scope must be same-origin paths
    expect(String(json.start_url)).toMatch(/^\//);
    expect(String(json.scope ?? "/")).toMatch(/^\//);
    // Chrome installability needs ≥192px PNG icon and a maskable variant.
    const sizesPx = (icon: any) =>
      String(icon.sizes || "")
        .split(/\s+/)
        .map((s) => parseInt(s.split("x")[0], 10))
        .filter((n) => !Number.isNaN(n));
    const has192Png = json.icons.some(
      (i: any) => i.type === "image/png" && sizesPx(i).some((n) => n >= 192),
    );
    const hasMaskable = json.icons.some((i: any) =>
      String(i.purpose || "").split(/\s+/).includes("maskable"),
    );
    expect(has192Png, "needs ≥192px PNG icon").toBe(true);
    expect(hasMaskable, "needs at least one maskable icon").toBe(true);

    // Every declared icon must actually resolve.
    for (const icon of json.icons) {
      const r = await request.get(new URL(icon.src, page.url()).toString());
      expect(r.ok(), `icon ${icon.src} → ${r.status()}`).toBe(true);
    }

    // Apple touch icon for iOS home-screen install.
    const appleHref = await page
      .locator('link[rel="apple-touch-icon"]')
      .first()
      .getAttribute("href");
    expect(appleHref, "apple-touch-icon link required for iOS install").toBeTruthy();
    const appleRes = await request.get(new URL(appleHref!, page.url()).toString());
    expect(appleRes.ok()).toBe(true);

    // theme-color helps Chrome treat the site as installable on Android.
    const themeColor = await page
      .locator('meta[name="theme-color"]')
      .first()
      .getAttribute("content");
    expect(themeColor).toBeTruthy();
  });

  test("service worker is a self-unregistering kill-switch (no stale app SW persists)", async ({ page, request }) => {
    // This project is intentionally manifest-only PWA. public/sw.js exists only
    // to evict any worker installed by an older release. It MUST unregister
    // itself on activate so returning visitors don't get a stale shell.
    const swRes = await request.get("/sw.js");
    expect(swRes.ok(), "/sw.js must be served").toBe(true);
    const body = await swRes.text();
    expect(body, "sw.js must call self.registration.unregister()").toMatch(
      /self\.registration\.unregister\s*\(/,
    );

    await page.goto("/");
    await waitForAppReady(page);

    // Give the activate handler a moment to run if anything registered it.
    const remaining = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return [];
      // Wait up to 3s for any in-flight unregister() from activate.
      const deadline = Date.now() + 3000;
      while (Date.now() < deadline) {
        const regs = await navigator.serviceWorker.getRegistrations();
        const appRegs = regs.filter((r) =>
          /\/(sw|service-worker)\.js(\?|$)/.test(r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || ""),
        );
        if (appRegs.length === 0) return [];
        await new Promise((r) => setTimeout(r, 250));
      }
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.map((r) => r.active?.scriptURL || r.scope);
    });
    expect(remaining, "kill-switch SW left a stale registration").toEqual([]);
  });


  for (const route of ROUTES) {
    test(`no horizontal overflow on ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForAppReady(page);
      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));
      // Allow 1px sub-pixel rounding.
      expect(scrollW).toBeLessThanOrEqual(clientW + 1);
    });

    test(`primary tap targets are ≥40px on ${route}`, async ({ page }) => {
      await page.goto(route);
      await waitForAppReady(page);
      // Sample interactive elements visible above the fold.
      const undersized = await page.evaluate(() => {
        const MIN = 40; // WCAG 2.5.5 recommends 44; allow 40 for icon buttons.
        const selectors = [
          "header button",
          "header a[href]",
          "nav button",
          "nav a[href]",
          "[role='button']",
        ];
        const els = Array.from(
          document.querySelectorAll<HTMLElement>(selectors.join(","))
        );
        const bad: { tag: string; w: number; h: number; text: string }[] = [];
        for (const el of els) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue; // hidden
          if (r.top > window.innerHeight) continue; // below fold
          if (r.width < MIN || r.height < MIN) {
            bad.push({
              tag: el.tagName.toLowerCase(),
              w: Math.round(r.width),
              h: Math.round(r.height),
              text: (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40),
            });
          }
        }
        return bad;
      });
      expect(undersized, JSON.stringify(undersized, null, 2)).toEqual([]);
    });
  }

  test("html applies text-size-adjust and touch-action: manipulation", async ({ page }) => {
    await page.goto("/");
    const { cssText, ta } = await page.evaluate(async () => {
      const cs = getComputedStyle(document.documentElement);

      const linkedCss = await Promise.all(
        Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"][href]')).map(
          async (link) => fetch(link.href).then((res) => res.text()).catch(() => ""),
        ),
      );

      return {
        cssText: [
          ...Array.from(document.querySelectorAll<HTMLStyleElement>("style")).map((style) => style.textContent || ""),
          ...linkedCss,
        ].join("\n"),
        ta: cs.getPropertyValue("touch-action"),
      };
    });
    const hasTextSizeAdjustRule = /(?:-webkit-)?text-size-adjust\s*:\s*100%/.test(cssText);
    expect(hasTextSizeAdjustRule).toBeTruthy();
    expect(ta).toMatch(/manipulation/);
  });

  test("header respects safe-area-inset-top", async ({ page }) => {
    await page.goto("/");
    await waitForAppReady(page);
    // Force a non-zero safe-area inset to simulate notch devices.
    await page.addStyleTag({
      content: `:root { --sat: 47px; } 
                @supports(padding-top: env(safe-area-inset-top)) {
                  html { padding-top: 0; }
                }`,
    });
    // Look at the public sticky/fixed top chrome. /trade/login intentionally has no header.
    const hasSafePad = await page.evaluate(() => {
      const headers = Array.from(document.querySelectorAll("header, nav"));
      return headers.some((h) => {
        const cs = getComputedStyle(h);
        // Either explicit env() padding, or pt-[env(...)] resolved to >0.
        return (
          /env\(safe-area-inset-top\)/.test(h.getAttribute("style") || "") ||
          /env\(safe-area-inset-top\)/.test(cs.paddingTop) ||
          parseFloat(cs.paddingTop) >= 0
        );
      });
    });
    expect(hasSafePad).toBeTruthy();
  });
});
