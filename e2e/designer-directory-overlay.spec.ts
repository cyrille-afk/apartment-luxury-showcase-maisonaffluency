import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

test("visual directory filters live and dismisses immediately", async ({ page }) => {
  test.setTimeout(120_000);
  await page.goto("/designers");
  await page.waitForFunction(() => Array.from(document.querySelectorAll("input"))
    .some(input => Object.keys(input).some(key => key.startsWith("__reactProps"))));
  const input = page.getByPlaceholder("Search directory", { exact: true });
  await input.click();
  const dialog = page.getByRole("dialog", { name: "Browse designers A to Z" });
  const grid = page.getByTestId("directory-visual-grid");
  await expect(grid.getByRole("link").first()).toBeVisible({ timeout: 60_000 });
  await input.fill("Amelie");
  await expect(grid.getByRole("link")).toHaveCount(1);
  await expect(grid.getByRole("link", { name: "View Amélie Vermersch", exact: true })).toBeVisible();
  const letterA = dialog.getByRole("button", { name: "Show designers starting with A", exact: true });
  await letterA.click();
  await expect(input).toHaveValue("");
  await expect(letterA).toHaveAttribute("aria-pressed", "true");
  await expect.poll(async () => grid.getByRole("link").evaluateAll(links =>
    links.length > 1 && links.every(link => link.getAttribute("aria-label")?.startsWith("View A")))).toBe(true);
  await input.fill("zzz-unmatched");
  await expect(grid.getByRole("link")).toHaveCount(0);
  const letterC = dialog.getByRole("button", { name: "Show designers starting with C", exact: true });
  await expect(letterC).toBeEnabled();
  await letterC.click();
  await expect.poll(async () => grid.getByRole("link").evaluateAll(links =>
    links.length > 0 && links.every(link => link.getAttribute("aria-label")?.startsWith("View C")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0, { timeout: 500 });
  await input.click();
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  if (!bounds) throw new Error("Directory panel is not visible");
  await page.mouse.click(bounds.x - 30, bounds.y + 100);
  await expect(dialog).toHaveCount(0, { timeout: 500 });
});