import { test, expect } from "@playwright/test";

test.use({ viewport: { width: 1280, height: 1800 }, trace: "off", video: "off" });

test("header Search reaches searchable catalogue and Cart reaches basket", async ({ page }) => {
  await page.goto("/gallery");
  const search = page.getByRole("link", { name: "Search", exact: true });
  await expect(search).toHaveAttribute("href", "/search");
  await search.click();
  await expect(page).toHaveURL(/\/search$/);
  await page.getByRole("textbox", { name: "Search catalogue" }).fill("Jules");
  await page.getByRole("search").getByRole("button", { name: "Search", exact: true }).click();
  await expect(page).toHaveURL(/q=Jules/);
  await expect(page.locator("#product-grid")).toContainText("Jules Lamp");
  await page.getByRole("link", { name: "Cart", exact: true }).click();
  await expect(page).toHaveURL(/\/cart$/);
  await expect(page.getByText("Your cart is empty.", { exact: true })).toBeVisible();
});