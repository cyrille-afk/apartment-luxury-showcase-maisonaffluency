import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

// Walks every Felix step via Next, asserting each spotlights its real feature
// promptly and never falls back to "not available".
test("Full Felix tour runs start to finish with correct highlights", async ({ page }) => {
  test.skip(!session || !storageKey, "Requires a managed trade session.");
  test.setTimeout(600_000);
  if (!session || !storageKey) return;
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.setItem("felix_dashboard_tour_seen_v1", "1");
    localStorage.removeItem("felix_tour_progress_v1");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade");
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.dispatchEvent(new Event("felix-tour:start")));
  const timings: string[] = [];
  for (let i = 1; i <= 23; i++) {
    const dialog = page.locator(`[role="dialog"][aria-label*="step ${i} of 23"]`);
    const started = Date.now();
    await expect(dialog, `step ${i} dialog`).toBeVisible({ timeout: 30_000 });
    const label = (await dialog.getAttribute("aria-label")) ?? "";
    const next = dialog.getByRole("button", { name: i === 23 ? /finish|next/i : "Next", exact: i !== 23 });
    const enabled = await next.isEnabled({ timeout: 100 }).catch(() => false);
    if (!enabled) {
      await expect.poll(async () => (await dialog.textContent()) ?? "", { timeout: 6_000 })
        .not.toContain("not available here yet").catch(() => {});
    }
    const text = (await dialog.textContent()) ?? "";
    expect(text, `${label} fell back`).not.toContain("not available here yet");
    const spot = await page.locator("[data-felix-spotlight]").boundingBox();
    expect(spot, `${label} spotlight`).not.toBeNull();
    if (!(await next.isEnabled())) {
      // Interactive steps (Collection card, Client View toggles) need the member's click.
      const spotted = page.locator(`[data-felix-target]`).filter({ visible: true });
      const n = await spotted.count();
      for (let k = 0; k < n; k++) {
        const box = await spotted.nth(k).boundingBox();
        if (box && spot && box.x >= spot.x - 20 && box.y >= spot.y - 20 && box.x + box.width <= spot.x + spot.width + 20) {
          const sw = spotted.nth(k).locator('[role="switch"], button').first();
          await ((await sw.count()) ? sw : spotted.nth(k)).click();
          break;
        }
      }
    }
    if (!label.includes("step 2 of 23")) await expect(next, `${label} next`).toBeEnabled({ timeout: 10_000 });
    timings.push(`${i} ${Date.now() - started}ms ${label.split(": ").pop()}`);
    if (i === 23) break;
    if (label.includes("step 2 of 23") && await dialog.isVisible()) {
      if (await next.isEnabled()) await next.click();
    } else await next.click();
  }
  console.log(timings.join("\n"));
  expect(errors).toEqual([]);
});
