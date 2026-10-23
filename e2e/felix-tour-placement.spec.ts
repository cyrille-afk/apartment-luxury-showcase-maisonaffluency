import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

test("all 23 tour steps keep cards inside the viewport and outside protected features", async ({ page, isMobile }) => {
  test.skip(isMobile, "Desktop-only tour.");
  test.skip(!session || !storageKey, "Requires a managed Trade session.");
  if (!session || !storageKey) return;
  test.setTimeout(240_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.removeItem("felix_tour_progress_v1");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade");
  const card = page.locator("[data-felix-tour-card]");
  for (let number = 1; number <= 23; number++) {
    await expect(card.getByRole("progressbar")).toHaveAttribute("aria-valuenow", String(number), { timeout: 60_000 });
    await expect(card).toBeVisible();
    for (const viewport of [{ width: 1946, height: 1181 }, { width: 1024, height: 600 }]) {
      await page.setViewportSize(viewport);
      await expect.poll(() => page.evaluate(() => {
        const card = document.querySelector<HTMLElement>("[data-felix-tour-card]");
        if (!card) return false;
        const box = card.getBoundingClientRect();
        const overlap = (r: DOMRect) => box.left < r.right && box.right > r.left && box.top < r.bottom && box.bottom > r.top;
        const hits = (a: DOMRect, b: DOMRect) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        // The spotlight and the heading it contains must stay clear. An
        // unrelated section heading may be covered, but only when that is what
        // keeps the card beside the feature it is explaining.
        const spot = document.querySelector<HTMLElement>("[data-felix-spotlight]");
        const sr = spot?.getBoundingClientRect();
        const own = [...document.querySelectorAll<HTMLElement>('h1, h2, h3, [role="heading"], [role="tab"], div.border-b > button, [data-felix-target="collection-overview"]')]
          .filter(el => !el.closest("[data-felix-tour-card]") && el.offsetParent !== null && sr && hits(el.getBoundingClientRect(), sr));
        const anchorKey = document.documentElement.dataset.felixTourSidebar;
        const elements: HTMLElement[] = [
          ...(spot ? [spot] : []),
          ...own,
          ...(anchorKey ? [...document.querySelectorAll<HTMLElement>(`[data-tour-sidebar-anchor="${anchorKey}"]`)] : []),
        ];
        return getComputedStyle(card).visibility === "visible" && box.left >= 24 && box.right <= innerWidth - 24 && box.top >= 16 && box.bottom <= innerHeight - 16 && elements.every(el => !overlap(el.getBoundingClientRect()));
      })).toBe(true);
    }
    await page.setViewportSize({ width: 1946, height: 1181 });
    await expect(card).toBeVisible();
    if (number === 10) {
      // The Tools page Discover row spans nearly the full content width: the
      // card must sit directly beneath it, not strand in a band at the bottom
      // of the page where nothing on screen points back to it.
      const near = await page.evaluate(() => {
        const card = document.querySelector<HTMLElement>("[data-felix-tour-card]");
        const spot = document.querySelector<HTMLElement>("[data-felix-spotlight]");
        if (!card || !spot) return null;
        const c = card.getBoundingClientRect();
        const s = spot.getBoundingClientRect();
        return { below: c.top - s.bottom, across: c.left < s.right && c.right > s.left };
      });
      expect(near).not.toBeNull();
      expect(near!.below).toBeGreaterThanOrEqual(0);
      expect(near!.below).toBeLessThanOrEqual(60);
      expect(near!.across).toBe(true);
    }
    if (number === 2) await page.locator('[data-felix-target="nav-collection"]').click();
    else if (number === 15) {
      const toggle = page.getByRole("switch", { name: "Toggle client editorial presentation" });
      if (await toggle.isChecked()) await card.getByRole("button", { name: "Next", exact: true }).click();
      else await toggle.check();
    } else {
      if (number === 17) {
        // Intercept this test's branding write; exercise the UI without altering a saved board.
        await page.route("**/rest/v1/moodboards*", route => route.request().method() === "PATCH" ? route.fulfill({ status: 204 }) : route.continue());
        await page.locator("#hide-maison").check();
      }
      await card.getByRole("button", { name: number === 23 ? "Finish" : "Next", exact: true }).click();
    }
  }
  await expect(card).toHaveCount(0);
  expect(errors).toEqual([]);
});