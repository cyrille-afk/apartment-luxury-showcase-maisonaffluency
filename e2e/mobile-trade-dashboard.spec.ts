import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;

test.use({ isMobile: true, hasTouch: true, trace: "off", video: "off" });

for (const width of [320, 375, 430]) {
  test(`Trade dashboard navigation works at ${width}px`, async ({ page }) => {
    test.skip(!session || !storageKey, "Requires a managed Trade session.");
    if (!session || !storageKey) return;
    await page.setViewportSize({ width, height: 844 });
    await page.goto("/");
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [storageKey, session]);
    await page.goto("/trade");
    const actions = page.getByRole("navigation", { name: "Dashboard quick actions" });
    await expect(actions).toBeVisible({ timeout: 60000 });
    await expect(page.getByRole("note", { name: "Desktop onboarding tour" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    for (const action of await actions.getByRole("link").all()) {
      const bounds = await action.boundingBox();
      expect(bounds?.height).toBeGreaterThanOrEqual(44);
    }
    await page.getByRole("button", { name: "Notifications", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Notifications" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole("button", { name: "Close notifications" }).click();
    await page.getByRole("button", { name: "Toggle menu" }).click();
    const menu = page.getByRole("dialog", { name: "Trade Portal Menu" });
    await expect(menu.getByRole("button", { name: "Designers & Ateliers", exact: true })).toBeVisible();
    await expect(menu.getByRole("button", { name: "Resources", exact: true })).toBeVisible();
    await menu.getByRole("button", { name: "Full Catalogue", exact: true }).click();
    await expect(page).toHaveURL(/\/trade\/gallery/);
    await expect(menu).not.toBeVisible();
    await page.goto("/trade");
    await expect(actions).toBeVisible();
    await actions.getByRole("link", { name: "Quotes", exact: true }).click();
    await expect(page).toHaveURL(/\/trade\/quotes/);
    const bottom = page.getByRole("navigation", { name: "Trade navigation" });
    await bottom.getByRole("button", { name: "Go to Projects" }).click();
    await expect(page).toHaveURL(/\/trade\/projects/);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await expect(bottom).toBeVisible();
    await bottom.getByRole("button", { name: "Go to Home" }).click();
    await expect(page).toHaveURL(/\/trade$/);
  });
}