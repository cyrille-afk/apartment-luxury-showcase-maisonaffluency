import { test, expect } from "@playwright/test";

const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

for (const source of ["toggle", "device"] as const) {
  test(`reduced motion from ${source} retains clear sidebar anchors without animation`, async ({ page }) => {
    test.skip(!session || !storageKey, "Requires a managed Trade session.");
    if (!session || !storageKey) return;
    test.setTimeout(120000);
    await page.emulateMedia({ reducedMotion: source === "device" ? "reduce" : "no-preference" });
    await page.goto("/");
    await page.evaluate(([key, value]) => {
      localStorage.setItem(key, value);
      localStorage.removeItem("felix_dashboard_tour_seen_v1");
      localStorage.removeItem("ma-felix-reduced-motion-v1");
      localStorage.setItem("felix_tour_progress_v1", "2");
      localStorage.setItem("trade_quick_tour_done", "1");
      localStorage.removeItem("trade_quick_tour_step");
    }, [storageKey, session]);
    await page.goto("/trade");
    const margin = page.getByRole("dialog").filter({ hasText: "Transparent Project Margins" });
    await expect(margin).toHaveCSS("opacity", "1", { timeout: 60000 });
    const toggle = margin.getByRole("switch", { name: "Reduce motion" });
    if (source === "toggle") await toggle.click();
    else await expect(toggle).toBeDisabled();
    await expect(toggle).toBeChecked();
    const verifyStatic = async (anchor: string) => {
      const card = page.locator("[data-felix-tour-card]");
      await expect(card).toHaveCSS("opacity", "1");
      await expect(card).toHaveCSS("transition-duration", "0s");
      await expect(card.locator("[data-felix-sidebar-arrow]")).toBeVisible();
      const styles = await page.locator(`[data-tour-sidebar-anchor="${anchor}"]`).evaluateAll(nodes => nodes.map(node => ({
        animation: getComputedStyle(node, "::after").animationName,
        opacity: getComputedStyle(node, "::after").opacity,
        outline: getComputedStyle(node).outlineStyle,
      })));
      for (const style of styles) expect(style).toEqual({ animation: "none", opacity: "0.65", outline: "solid" });
      const moving = await card.evaluate(node => [node, ...node.querySelectorAll("*")].some(el => {
        const s = getComputedStyle(el); return s.animationName !== "none" || s.transitionDuration.split(",").some(d => parseFloat(d) > 0);
      }));
      expect(moving).toBe(false);
      await expect(page.locator("[data-felix-spotlight]")).toHaveCSS("transition-duration", "0s");
    };
    await verifyStatic("collection");
    await margin.getByRole("button", { name: "Next", exact: true }).click();
    const folders = page.getByRole("dialog").filter({ hasText: "Client Project Folders" });
    await expect(folders).toHaveCSS("opacity", "1");
    await verifyStatic("projects");
    await folders.getByRole("button", { name: "Back", exact: true }).click();
    await expect(margin).toHaveCSS("opacity", "1");
    await verifyStatic("collection");
    await margin.getByRole("button", { name: "Close tour" }).click();
    await expect(page.locator("html[data-felix-reduced-motion]")).toHaveCount(0);
    await page.evaluate(() => localStorage.removeItem("felix_dashboard_tour_seen_v1"));
    await page.reload();
    await expect(margin).toHaveCSS("opacity", "1", { timeout: 60000 });
    await verifyStatic("collection");
    if (source === "toggle") {
      await margin.getByRole("switch", { name: "Reduce motion" }).click();
      await expect(page.locator("html[data-felix-reduced-motion]")).toHaveCount(0);
      expect(await page.locator('[data-tour-sidebar-anchor="collection"]').evaluate(el => getComputedStyle(el, "::after").animationName)).toBe("sidebar-tour-pulse");
    }
    await margin.getByRole("button", { name: "Skip tour", exact: true }).click();
    await expect(page.locator("html[data-felix-tour-step]")).toHaveCount(0);
  });
}