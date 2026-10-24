import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1946, height: 1181 }, trace: 'off', video: 'off' });

test('product Back and browser Back reopen the exact interactive gallery photo', async ({ page }) => {
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  test.skip(!session || !key, 'Requires the requesting Trade session.');
  if (!session || !key) return;
  test.setTimeout(180_000);
  await page.goto('/');
  await page.evaluate(([k, value]) => localStorage.setItem(k, value), [key, session]);
  await page.goto('/trade/the-collection');
  const photo = page.locator('img[alt^="An Inviting Lounge Area"]').locator('..');
  await photo.click();
  const dialog = page.getByRole('dialog');
  const openProduct = async () => {
    await dialog.getByRole('button', { name: 'View details for Median 3', exact: false }).click();
    await dialog.getByRole('button', { name: 'View Full Product', exact: false }).click();
    await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible({ timeout: 60_000 });
    await expect(page).toHaveURL(/\/trade\/products\/apparatus-studio\/median-3-surface-light$/);
  };
  const verifyPhoto = async () => {
    await expect(page).toHaveURL(/\/trade\/the-collection$/);
    await expect(dialog.getByRole('heading', { level: 2 })).toHaveText('An Inviting Lounge Area');
    await expect(dialog.getByRole('button', { name: 'Go to image 1', exact: true })).toBeVisible();
  };
  await openProduct();
  await page.reload();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await verifyPhoto();
  await openProduct();
  await page.goBack();
  await verifyPhoto();
});