import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

test("Collection tour remains visible without images and preserves both browsing tabs", async ({ page }) => {
  test.skip(!session || !storageKey, "Requires a managed trade session.");
  if (!session || !storageKey) return;
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.setItem("felix_tour_progress_v1", "2");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade");
  const step2 = page.getByRole("dialog").filter({ hasText: "Open The Collection to continue." });
  await expect(step2).toBeVisible({ timeout: 60_000 });
  await expect(page.locator('[data-felix-target="nav-collection"]')).toBeVisible();
  await page.route("**/*", route => route.request().resourceType() === "image" ? route.abort() : route.continue());
  await page.evaluate(() => {
    (window as Window & { darkTourFrames?: number }).darkTourFrames = 0;
    const sample = () => {
      const dark = [...document.querySelectorAll('.z-\\[130\\] .bg-foreground\\/40')].some(el => getComputedStyle(el).opacity !== "0");
      if (dark) (window as Window & { darkTourFrames?: number }).darkTourFrames = ((window as Window & { darkTourFrames?: number }).darkTourFrames ?? 0) + 1;
      if (document.documentElement.dataset.felixTourActive === "true") requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
  await page.locator('[data-felix-target="nav-collection"]').click();
  await expect(page).toHaveURL(/\/trade\/the-collection$/);
  const step3 = page.getByRole("dialog").filter({ hasText: "Transparent Project Margins" });
  await expect(step3).toHaveCSS("opacity", "1", { timeout: 15_000 });
  const verifyTargets = async () => {
    const ring = await page.locator("[data-felix-spotlight]").boundingBox();
    const card = await step3.boundingBox();
    expect(ring).not.toBeNull();
    expect(card).not.toBeNull();
    if (!ring || !card) return;
    const targets = page.locator('[data-felix-target="collection-overview"]');
    await expect(targets).toHaveCount(3);
    for (const target of await targets.all()) {
      const box = await target.boundingBox();
      expect(box).not.toBeNull();
      if (!box) continue;
      expect(box.y).toBeGreaterThan(60);
      expect(box.x).toBeGreaterThanOrEqual(ring.x);
      expect(box.y).toBeGreaterThanOrEqual(ring.y);
      expect(box.x + box.width).toBeLessThanOrEqual(ring.x + ring.width);
      expect(box.y + box.height).toBeLessThanOrEqual(ring.y + ring.height);
      expect(card.x >= box.x + box.width || card.x + card.width <= box.x || card.y >= box.y + box.height || card.y + card.height <= box.y).toBe(true);
      expect(await target.evaluate(el => {
        const r = el.getBoundingClientRect();
        const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return top === el || (top !== null && el.contains(top));
      })).toBe(true);
    }
  };
  await verifyTargets();
  await page.getByRole("button", { name: "Designers & Ateliers", exact: true }).click();
  await expect(step3).toHaveCSS("opacity", "1");
  await verifyTargets();
  expect(await page.evaluate(() => (window as Window & { darkTourFrames?: number }).darkTourFrames)).toBe(0);
  await step3.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page).toHaveURL(/\/trade\/the-collection$/);
  await expect(page.getByRole("dialog").filter({ hasText: "Client-Safe Presentations" })).toBeVisible();
  expect(errors).toEqual([]);
});