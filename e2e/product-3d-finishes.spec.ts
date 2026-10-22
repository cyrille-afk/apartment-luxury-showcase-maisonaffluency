import { test, expect, type Page } from "@playwright/test";
import { env, signIn, plantSession } from "../tests/support/e2eEnv";

const sessionJson = process.env.LOVABLE_BROWSER_SUPABASE_SESSION_JSON;
const storageKey = process.env.LOVABLE_BROWSER_SUPABASE_STORAGE_KEY;
const email = env("E2E_ADMIN_EMAIL");
const password = env("E2E_ADMIN_PASSWORD");
const productPath = "/trade/products/sebastian-herkner-man-of-parts/praia-da-granja-coffee-table";
// Never capture session restoration in trace/video artifacts.
test.use({ viewport: { width: 1946, height: 1181 }, trace: "off", video: "off" });

async function materialMaps(page: Page) {
  return page.locator("model-viewer").evaluate((element) => {
    const viewer = element as HTMLElement & { model: { materials: Array<{ pbrMetallicRoughness: { baseColorTexture: { texture?: { source?: { uri?: string } } } } }> } };
    return viewer.model.materials.map(m => m.pbrMetallicRoughness.baseColorTexture.texture?.source?.uri ?? null);
  });
}

async function expectActive(page: Page) {
  await expect(page.getByRole("button", { name: "Exit 3D", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Show 3D model", exact: true })).toHaveAttribute("aria-pressed", "true");
  expect(await page.evaluate(() => {
    const state = window as unknown as { regressionViewer: HTMLElement; regressionModel: unknown };
    const viewer = document.querySelector("model-viewer") as (HTMLElement & { model: unknown }) | null;
    return viewer === state.regressionViewer && viewer?.model === state.regressionModel;
  })).toBe(true);
  await expect(page.locator("model-viewer")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Locked", exact: true })).toHaveAttribute("aria-pressed", "true");
}

test.describe("active product 3D finish interactions", () => {
  test.skip(!(sessionJson && storageKey) && !(email && password), "Requires a managed session or E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD.");
  test.setTimeout(180_000);
  test.beforeEach(async ({ page }) => {
    if (sessionJson && storageKey) {
      await page.goto("/");
      await page.evaluate(([key, value]) => localStorage.setItem(key, value), [storageKey, sessionJson]);
    } else if (email && password) {
      await plantSession(page, await signIn(email, password));
    }
    await page.goto(productPath);
    await page.getByRole("button", { name: "Show 3D model", exact: true }).click();
    await page.getByRole("button", { name: "Load interactive 3D model", exact: true }).click();
    await page.waitForFunction(() => {
      const viewer = document.querySelector("model-viewer") as (HTMLElement & { loaded?: boolean; model?: { materials: unknown[] } }) | null;
      return viewer?.loaded && Boolean(viewer.model?.materials.length);
    }, undefined, { timeout: 90_000 });
    await page.getByRole("button", { name: "Lock", exact: true }).click();
    await page.evaluate(() => {
      const state = window as unknown as { regressionViewer: Element | null; regressionModel: unknown };
      const viewer = document.querySelector("model-viewer") as (HTMLElement & { model: unknown }) | null;
      state.regressionViewer = viewer;
      state.regressionModel = viewer?.model;
    });
  });

  test("base and top selectors remain clickable and swap live maps without resetting 3D", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.getByRole("button", { name: /^Select Your Base/ }).click();
    const base = page.getByRole("button", { name: "Select Black Pepper Oak", exact: true });
    await expect(base).toBeEnabled();
    const baseUrl = await base.locator("img").first().getAttribute("src");
    expect(baseUrl).toBeTruthy();
    await base.click();
    await page.getByRole("button", { name: /^Select Your Top/ }).click();
    const top = page.getByRole("button", { name: "Select Nero Marquina Marble", exact: true });
    await expect(top).toBeEnabled();
    const topUrl = await top.locator("img").first().getAttribute("src");
    expect(topUrl).toBeTruthy();
    await top.click();
    await page.mouse.move(0, 0);
    await expect.poll(() => materialMaps(page)).toEqual(expect.arrayContaining([baseUrl, topUrl]));
    const before = await materialMaps(page);
    await expectActive(page);
    await page.getByRole("button", { name: /^Select Your Top/ }).click();
    const nextTop = page.getByRole("button", { name: "Select Pall Stone", exact: true });
    await expect(nextTop).toBeEnabled();
    const nextTopUrl = await nextTop.locator("img").first().getAttribute("src");
    expect(nextTopUrl).toBeTruthy();
    await nextTop.click();
    await page.mouse.move(0, 0);
    await expect.poll(() => materialMaps(page)).toEqual(expect.arrayContaining([baseUrl, nextTopUrl]));
    expect(await materialMaps(page)).not.toEqual(before);
    await expectActive(page);
    expect(errors).toEqual([]);
  });

  test("thumbnail hover previews and clicks commit mapped finishes on the same active model", async ({ page }) => {
    await page.getByRole("button", { name: "Preview Black Pepper Oak with Nero Marquina Marble", exact: true }).click();
    await page.mouse.move(0, 0);
    await expect.poll(async () => (await materialMaps(page)).filter(Boolean).length).toBeGreaterThanOrEqual(2);
    const before = await materialMaps(page);
    const photos = page.getByRole("button", { name: /^Show photo \d+$/ });
    const count = await photos.count();
    expect(count).toBeGreaterThan(1);
    let committed = false;
    for (let index = 0; index < count; index++) {
      const photo = photos.nth(index);
      await expect(photo).toBeEnabled();
      await photo.hover();
      const status = page.getByRole("status").filter({ hasText: "Previewing" });
      if (!/Natural Walnut.*Pall Stone/i.test(await status.textContent() ?? "")) continue;
      await expect.poll(() => materialMaps(page)).not.toEqual(before);
      const preview = await materialMaps(page);
      await expectActive(page);
      await photo.click();
      await expect(photo).toHaveAttribute("aria-pressed", "true");
      await page.mouse.move(0, 0);
      await photo.blur();
      await expect(status).toHaveCount(0);
      await expect.poll(() => materialMaps(page)).toEqual(preview);
      await expectActive(page);
      committed = true;
      break;
    }
    expect(committed, "Catalogue contains a Natural Walnut/Pall Stone mapped photo").toBe(true);
  });
});