import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 1800 }, reducedMotion: "reduce", trace: "off", video: "off" });

test("account menu supports hover travel, dismissal and keyboard activation", async ({ page }) => {
  await page.goto("/designers");
  const trigger = page.getByRole("button", { name: "Account menu", exact: true });
  const signup = page.getByRole("menuitem", { name: "Sign Up", exact: true });
  await trigger.hover();
  await expect(signup).toBeVisible();
  const box = await trigger.boundingBox();
  if (!box) throw new Error("Account trigger is not visible");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height + 50);
  await page.waitForTimeout(500);
  await expect(signup).toBeVisible();
  await signup.hover();
  await expect(signup).toBeVisible();
  await page.mouse.move(20, 500);
  await expect(signup).toBeHidden();
  await trigger.focus();
  await page.keyboard.press("ArrowDown");
  await expect(signup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(signup).toBeHidden();
  await trigger.click();
  await expect(signup).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(signup).toBeHidden();
});