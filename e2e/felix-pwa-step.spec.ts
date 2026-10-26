import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

test("Take your studio on site highlights the sidebar Mobile App Workspace promptly", async ({ page }) => {
  test.skip(!session || !storageKey, "Requires a managed trade session.");
  test.setTimeout(90_000);
  if (!session || !storageKey) return;
  await page.goto("/");
  await page.evaluate(([key, value]) => {
    localStorage.setItem(key, value);
    localStorage.removeItem("felix_dashboard_tour_seen_v1");
    localStorage.setItem("felix_tour_progress_v1", "20");
    localStorage.setItem("trade_quick_tour_done", "1");
    localStorage.removeItem("trade_quick_tour_step");
  }, [storageKey, session]);
  await page.goto("/trade");
  const dialog = page.getByRole("dialog").filter({ hasText: "TAKE YOUR STUDIO ON SITE" });
  await expect(dialog).toBeVisible({ timeout: 45_000 });
  const started = Date.now();
  await expect(page.getByRole("button", { name: "Next", exact: true })).toBeEnabled({ timeout: 5_000 });
  expect(Date.now() - started).toBeLessThan(5_000);
  await expect(dialog).not.toContainText("not available here yet");
  await expect(page.locator('[data-felix-target="sidebar-pwa"]')).toBeVisible();
});
