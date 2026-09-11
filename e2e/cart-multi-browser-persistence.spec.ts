import { expect, test, type Page } from "@playwright/test";

const CART_KEY = "ma_cart_v1";
const CART_BACKUP_KEY = "ma_cart_v1_backup";
const SECURE_BASKET_KEY = "ma_secure_basket";
const REGION_COUNTRY_KEY = "trade.detectedCountry";
const REGION_CURRENCY_KEY = "trade.displayCurrency";
const REGION_MANUAL_KEY = "trade.shippingDestination.manual";

const region = {
  countryIso: "CH",
  countryName: "Switzerland",
  currency: "CHF",
  manual: true,
};

const item = {
  key: "ondas-sconce::tarnished-silver",
  pickId: "ondas-sconce",
  productSlug: "ondas-sconce",
  designerSlug: "alexander-lamont",
  title: "Ondas Sconce",
  designerName: "Alexander Lamont",
  finishLabel: "Tarnished Silver",
  imageUrl: null,
  leadTime: "12–14 weeks",
  unitPriceCents: 1_025_500,
  currency: "USD",
  quantity: 1,
};

const checkoutLine = {
  title: item.title,
  designer: item.designerName,
  finishLabel: item.finishLabel,
  imageUrl: item.imageUrl,
  unitCents: item.unitPriceCents,
  currency: item.currency,
  leadTime: item.leadTime,
  productPath: `/designers/${item.designerSlug}/${item.productSlug}`,
  quantity: item.quantity,
};

function envelope(lines: unknown[]) {
  return { v: 1, lines, region, savedAt: Date.now() };
}

async function addLatency(page: Page, delayMs: number) {
  await page.route("**/*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    await route.continue();
  });
}

async function seedBasket(page: Page) {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(
    ({ cartKey, backupKey, secureKey, countryKey, currencyKey, manualKey, cart, secure }) => {
      localStorage.setItem(cartKey, JSON.stringify(cart));
      localStorage.setItem(backupKey, JSON.stringify(cart));
      localStorage.setItem(secureKey, JSON.stringify(secure));
      localStorage.setItem(countryKey, "CH");
      localStorage.setItem(currencyKey, "CHF");
      localStorage.setItem(manualKey, "1");
    },
    {
      cartKey: CART_KEY,
      backupKey: CART_BACKUP_KEY,
      secureKey: SECURE_BASKET_KEY,
      countryKey: REGION_COUNTRY_KEY,
      currencyKey: REGION_CURRENCY_KEY,
      manualKey: REGION_MANUAL_KEY,
      cart: envelope([item]),
      secure: envelope([checkoutLine]),
    },
  );
}

test.describe("Maison Affluency multi-browser cart persistence under latency", () => {
  test("Chromium removes a line and immediately rewrites persistent storage", async ({ page }) => {
    await addLatency(page, 400);
    await seedBasket(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Ondas Sconce", { exact: true }).first()).toBeVisible();
    await page.getByRole("button", { name: "Remove", exact: true }).click();

    await expect(page.getByText("Your cart is empty.", { exact: true })).toBeVisible();
    const storage = await page.evaluate(
      ({ cartKey, backupKey, secureKey }) => ({
        cart: JSON.parse(localStorage.getItem(cartKey) || "null"),
        backup: localStorage.getItem(backupKey),
        secure: localStorage.getItem(secureKey),
      }),
      { cartKey: CART_KEY, backupKey: CART_BACKUP_KEY, secureKey: SECURE_BASKET_KEY },
    );

    expect(storage.cart.lines).toEqual([]);
    expect(storage.cart.region).toMatchObject(region);
    expect(storage.backup).toBeNull();
    expect(storage.secure).toBeNull();
  });

  test("WebKit restores the basket and Switzerland/CHF across navigation", async ({ page }) => {
    await addLatency(page, 500);
    await seedBasket(page);

    await page.goto("/cart", { waitUntil: "domcontentloaded" });
    await expect(page.getByText("Ondas Sconce", { exact: true }).first()).toBeVisible();
    await page.goto("/designers/thierry-lemaire", { waitUntil: "domcontentloaded" });
    await page.goto("/cart", { waitUntil: "domcontentloaded" });

    await expect(page.getByText("Ondas Sconce", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Your cart is empty.", { exact: true })).toBeHidden();

    const restored = await page.evaluate(
      ({ cartKey, secureKey, countryKey, currencyKey, manualKey }) => ({
        cart: JSON.parse(localStorage.getItem(cartKey) || "null"),
        secure: JSON.parse(localStorage.getItem(secureKey) || "null"),
        country: localStorage.getItem(countryKey),
        currency: localStorage.getItem(currencyKey),
        manual: localStorage.getItem(manualKey),
      }),
      {
        cartKey: CART_KEY,
        secureKey: SECURE_BASKET_KEY,
        countryKey: REGION_COUNTRY_KEY,
        currencyKey: REGION_CURRENCY_KEY,
        manualKey: REGION_MANUAL_KEY,
      },
    );

    expect(restored.cart.lines).toHaveLength(1);
    expect(restored.secure.lines).toHaveLength(1);
    expect(restored.cart.region).toMatchObject(region);
    expect(restored.secure.region).toMatchObject(region);
    expect(restored).toMatchObject({ country: "CH", currency: "CHF", manual: "1" });
  });
});