import { expect, test, type Page } from "@playwright/test";

const PRODUCT_URL = "/designers/dagmar-london/clam-chair";
const DARK_CANVAS = "rgb(26, 26, 26)";

async function expectDarkProductCanvas(page: Page, state: string) {
  const colors = await page.evaluate(() => {
    const color = (selector: string) => {
      const element = document.querySelector(selector);
      return element ? getComputedStyle(element).backgroundColor : null;
    };

    return {
      htmlClass: document.documentElement.className,
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
      root: color("#root"),
      canvas: color(".product-configurator-canvas"),
      product: color(".product-page-root"),
    };
  });

  expect(colors.htmlClass, `${state}: product canvas route class`).toContain("public-product-canvas");
  for (const layer of ["html", "body", "root", "canvas"] as const) {
    expect(colors[layer], `${state}: ${layer} must retain the dark elastic-scroll canvas`).toBe(
      DARK_CANVAS,
    );
  }
  expect(colors.product, `${state}: product information must remain on its light surface`).not.toBe(
    DARK_CANVAS,
  );
}

async function expectStableMobileCommerceDock(page: Page, state: string) {
  const geometry = await page.locator("[data-mobile-commerce-dock]").evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      position: style.position,
      bottom: style.bottom,
      zIndex: Number(style.zIndex),
      transform: style.transform,
      rectBottom: Math.round(rect.bottom),
      viewportBottom: window.innerHeight,
      paddingBottom: Number.parseFloat(style.paddingBottom),
    };
  });

  expect(geometry.position, `${state}: dock positioning`).toBe("fixed");
  expect(geometry.bottom, `${state}: dock bottom anchor`).toBe("0px");
  expect(geometry.zIndex, `${state}: dock stacking layer`).toBeGreaterThanOrEqual(50);
  expect(geometry.transform, `${state}: dock must not use scroll-sensitive transforms`).toBe("none");
  expect(geometry.rectBottom, `${state}: dock must end at the dynamic viewport edge`).toBe(
    geometry.viewportBottom,
  );
  expect(geometry.paddingBottom, `${state}: dock must reserve a safe bottom gutter`).toBeGreaterThanOrEqual(16);
}

test.describe("Public product iOS canvas", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => window.localStorage.setItem("cookie_consent", "declined"));
    await page.goto(PRODUCT_URL, { waitUntil: "domcontentloaded" });
    await expect(page.locator(".product-page-root")).toBeVisible({ timeout: 15_000 });
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation-duration:0s!important;animation-delay:0s!important;transition-duration:0s!important;transition-delay:0s!important}",
    });
  });

  test("keeps the outer canvas dark through scroll and purchasing panel open/close", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "mobile-only canvas guard");

    await expectDarkProductCanvas(page, "initial");

    await page.evaluate(() => window.scrollTo(0, Math.max(1, document.documentElement.scrollHeight / 2)));
    await page.waitForTimeout(100);
    await expectDarkProductCanvas(page, "scrolled");

    await page.evaluate(() => window.dispatchEvent(new Event("ma:open-intake")));
    const panel = page.getByRole("dialog", { name: "Order intake" });
    await expect(panel).toBeVisible();
    await expectDarkProductCanvas(page, "panel open");

    await panel.getByRole("button", { name: "Close" }).click();
    await expect(panel).toBeHidden();
    await expectDarkProductCanvas(page, "panel closed");
  });

  test("keeps the commerce dock fixed through scroll and dynamic viewport changes", async ({
    page,
  }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "mobile-only dock guard");

    const dock = page.locator("[data-mobile-commerce-dock]");
    await expect(dock).toBeVisible();
    await expectStableMobileCommerceDock(page, "initial");

    await page.evaluate(() => window.scrollTo(0, Math.max(1, document.documentElement.scrollHeight / 2)));
    await page.waitForTimeout(100);
    await expectStableMobileCommerceDock(page, "scrolled");

    await page.setViewportSize({ width: 390, height: 700 });
    await expectStableMobileCommerceDock(page, "collapsed viewport");

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(100);
    await expectStableMobileCommerceDock(page, "page bottom");
  });

  test("@pixel product and purchasing panel retain their intended surfaces", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "mobile-chrome", "mobile-only visual guard");

    await page.evaluate(() => window.scrollTo(0, Math.max(1, document.documentElement.scrollHeight / 2)));
    await page.waitForTimeout(100);
    await expect(page).toHaveScreenshot("product-dark-canvas-scrolled.png", {
      fullPage: false,
      mask: [page.locator("img")],
      maskColor: "#EDEBE8",
    });

    await page.evaluate(() => window.dispatchEvent(new Event("ma:open-intake")));
    await expect(page.getByRole("dialog", { name: "Order intake" })).toBeVisible();
    await expect(page).toHaveScreenshot("product-dark-canvas-panel-open.png", {
      fullPage: false,
      mask: [page.locator("img")],
      maskColor: "#EDEBE8",
    });
  });
});