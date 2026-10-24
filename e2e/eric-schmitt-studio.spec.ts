import { test, expect } from '@playwright/test';

test('Eric Schmitt exposes all eight catalogue pieces in Studio Mode', async ({ page }) => {
  const session = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
  const key = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
  test.skip(!session || !key, 'Requires the requesting Trade session.');
  if (!session || !key) return;
  test.setTimeout(120_000);
  await page.goto('/');
  await page.evaluate(([k, value]) => localStorage.setItem(k, value), [key, session]);
  await page.goto('/trade/gallery/eric-schmitt-studio');
  const studio = page.getByRole('button', { name: 'Studio Mode', exact: true });
  await studio.waitFor({ timeout: 60_000 });
  await studio.click();
  await expect(page.getByText('8 Items Found', { exact: true })).toBeVisible({ timeout: 60_000 });
  for (const title of ['Anneau Pendant Lamp', 'Chairie Dining Chair', 'Dragée Console', 'Saturne Coffee Table', 'Frame Table Low Side Table', 'Dentelle Console', 'Floating Table', 'Rocwood Dining Table']) {
    await expect(page.getByText(title, { exact: true })).toBeVisible();
  }
  await page.reload();
  await expect(page.getByText('8 Items Found', { exact: true })).toBeVisible({ timeout: 60_000 });
});