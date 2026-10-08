/**
 * E2E: /trade/ai-layout · "Generate with AI architect"
 *
 * Real admin session + real live catalogue + real page validation. Only the
 * model's reply is replaced, built from the intercepted request, so every run is
 * deterministic (and costs no AI credits).
 *
 *   1. Admin journey: payload holds only priced (numeric trade_cost) pieces;
 *      a valid reply renders in the 3D view with no runtime errors.
 *   2. Discount & budget: every trade_cost = RRP less one tier discount; the
 *      "AI layout · trade spend €…" note under the budget bar equals the sum.
 *   3. Stress test: 2 × 2 m room + luxury brief, reply stacks pieces →
 *      rejected with "AI rejected: … overlaps / outside the room", standard
 *      layout shown instead.
 *
 * Env: E2E_ADMIN_EMAIL, E2E_ADMIN_PASSWORD (admin account).
 * Optional: E2E_EXPECTED_DISCOUNT_PCT (e.g. 10) to pin the admin's tier.
 * Skipped without credentials so CI stays green.
 *
 *   npx playwright test e2e/trade-ai-layout-architect.spec.ts --project=desktop-chrome
 */
import { test, expect, type Page, type Route } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

function loadDotEnv(path = ".env"): Record<string, string> {
  try {
    const out: Record<string, string> = {};
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"\n#]*)"?\s*$/i);
      if (m) out[m[1]] = m[2];
    }
    return out;
  } catch {
    return {};
  }
}
const envFile = loadDotEnv();
const env = (k: string) => process.env[k] ?? envFile[k];
const ADMIN_EMAIL = env("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = env("E2E_ADMIN_PASSWORD");
const SUPABASE_URL = env("VITE_SUPABASE_URL");
const SUPABASE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");
const EXPECTED_PCT = env("E2E_EXPECTED_DISCOUNT_PCT");

type Row = { sku: string; name: string; category: string; width_m: number; depth_m: number; trade_cost: number | null };
type Payload = { room_dimensions: { width_m: number; length_m: number }; client_brief: { budget_eur: number }; available_catalog: Row[] };

const FN = "**/functions/v1/ai-architect-layout";
const TIERS = [0, 0.1, 0.12, 0.15];

async function signInAsAdmin(page: Page) {
  const sb = createClient(SUPABASE_URL!, SUPABASE_KEY!);
  const { data, error } = await sb.auth.signInWithPassword({ email: ADMIN_EMAIL!, password: ADMIN_PASSWORD! });
  expect(error).toBeNull();
  const s = data.session!;
  const key = `sb-${new URL(SUPABASE_URL!).hostname.split(".")[0]}-auth-token`;
  const value = JSON.stringify({ access_token: s.access_token, refresh_token: s.refresh_token, expires_at: s.expires_at, expires_in: s.expires_in, token_type: "bearer", user: s.user });
  await page.goto("/trade/login", { waitUntil: "domcontentloaded" });
  await page.evaluate(([k, v]) => window.localStorage.setItem(k, v), [key, value]);
}

function trackErrors(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /react|three|uncaught|render|webgl context lost/i.test(m.text())) errors.push(m.text());
  });
  return errors;
}

async function openStudio(page: Page) {
  await page.goto("/trade/ai-layout", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/trade\/ai-layout/, { timeout: 20_000 });
  // First visit shows the one-time confidentiality gate; accept it if present.
  const nda = page.getByRole("dialog", { name: "Secure Studio Access" });
  const ndaShown = await nda.waitFor({ state: "visible", timeout: 10_000 }).then(() => true).catch(() => false);
  if (ndaShown) {
    await nda.getByRole("checkbox").check();
    await nda.getByRole("button", { name: "Proceed to Secure Studio" }).click();
    await expect(nda).toBeHidden({ timeout: 15_000 });
  }
  await expect(page.getByRole("heading", { name: "Curated Room Layout" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/Live RRPs · \d+ of \d+ pieces available/)).toBeVisible({ timeout: 30_000 });
}

async function setField(page: Page, label: string, value: number) {
  const input = page.locator(`div:has(> label:text-is("${label}")) input`).first();
  await input.fill(String(value));
}

const reply = (route: Route, layout: unknown) =>
  route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ layout }) });

test.describe("Trade AI layout · AI architect", () => {
  test.skip(!(ADMIN_EMAIL && ADMIN_PASSWORD && SUPABASE_URL && SUPABASE_KEY), "Set E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD to run.");
  test.setTimeout(120_000);

  test("admin journey, priced-only catalogue, trade spend = RRP less tier discount", async ({ page }) => {
    const errors = trackErrors(page);
    await signInAsAdmin(page);
    await openStudio(page);
    await setField(page, "width (m)", 8);
    await setField(page, "length (m)", 8);
    await setField(page, "Total budget (EUR)", 1_000_000);

    let payload: Payload | null = null;
    let expectedSpend = 0;
    let placedSkus: string[] = [];
    await page.route(FN, async (route) => {
      payload = route.request().postDataJSON() as Payload;
      const cat = payload.available_catalog;
      const sofa = cat.find((r) => r.category === "sofa");
      const table = cat.find((r) => r.category === "coffee_table");
      expect(sofa, "catalogue has a priced sofa").toBeTruthy();
      expect(table, "catalogue has a priced coffee table").toBeTruthy();
      // Sofa centred, facing north; table exactly 0.6 m in front of its front edge.
      const sy = 2.5;
      const ty = sy + sofa!.depth_m / 2 + 0.6 + table!.depth_m / 2;
      const placements = [
        { sku: sofa!.sku, category: "sofa", position: [4, sy, 0], rotation: 0, layout_logic_justification: "e2e" },
        { sku: table!.sku, category: "coffee_table", position: [4, ty, 0], rotation: 0, layout_logic_justification: "e2e" },
      ];
      placedSkus = [sofa!.sku, table!.sku];
      expectedSpend = sofa!.trade_cost! + table!.trade_cost!;
      await reply(route, { layout_metadata: { total_items_placed: 2, total_spend_eur: expectedSpend, budget_buffer_remaining: 1_000_000 - expectedSpend }, placements });
    });

    await page.getByRole("button", { name: "Generate with AI architect" }).click();
    await expect(page.getByText(/AI layout · trade spend €/)).toBeVisible({ timeout: 30_000 });

    // 1. Payload: only active, numerically priced pieces.
    expect(payload).not.toBeNull();
    const cat = payload!.available_catalog;
    expect(cat.length).toBeGreaterThan(0);
    for (const r of cat) {
      expect(typeof r.trade_cost, `${r.name} trade_cost`).toBe("number");
      expect(Number.isFinite(r.trade_cost) && r.trade_cost! > 0, `${r.name} priced`).toBe(true);
    }

    // 1. Rendered: canvas present, both pieces in the ledger, no runtime errors.
    await expect(page.locator("canvas").first()).toBeVisible();
    for (const sku of placedSkus) {
      const name = cat.find((r) => r.sku === sku)!.name;
      await expect(page.getByLabel(`Compare ${name}`)).toBeVisible();
    }

    // 2. trade_cost = RRP less one consistent tier discount.
    const ratios: number[] = [];
    for (const sku of placedSkus) {
      const row = cat.find((r) => r.sku === sku)!;
      const li = page.locator("li", { has: page.getByLabel(`Compare ${row.name}`) }).first();
      const rrpText = (await li.textContent()) ?? "";
      const m = rrpText.match(/€\s?([\d,]+(?:\.\d+)?)/);
      expect(m, `RRP shown for ${row.name}`).toBeTruthy();
      const rrp = Number(m![1].replace(/,/g, ""));
      ratios.push(1 - row.trade_cost! / rrp);
    }
    const pct = ratios[0];
    for (const r of ratios) expect(Math.abs(r - pct)).toBeLessThan(0.002);
    const tier = TIERS.reduce((a, b) => (Math.abs(b - pct) < Math.abs(a - pct) ? b : a));
    expect(Math.abs(tier - pct)).toBeLessThan(0.002);
    if (EXPECTED_PCT) expect(Math.abs(pct * 100 - Number(EXPECTED_PCT))).toBeLessThan(0.2);

    // 2. Trade spend note under the RRP budget bar matches the sum exactly.
    const spendStr = expectedSpend.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    await expect(page.getByText(`AI layout · trade spend €${spendStr} of €1,000,000`)).toBeVisible();

    expect(errors, errors.join("\n")).toEqual([]);
  });

  test("tiny 2 × 2 m room with luxury brief: AI result rejected, standard layout shown", async ({ page }) => {
    const errors = trackErrors(page);
    await signInAsAdmin(page);
    await openStudio(page);
    await setField(page, "width (m)", 2);
    await setField(page, "length (m)", 2);
    await setField(page, "Total budget (EUR)", 2_000_000);

    await page.route(FN, async (route) => {
      const p = route.request().postDataJSON() as Payload;
      // A greedy "luxury" answer: every major piece stacked at the room centre.
      const picks = ["sofa", "coffee_table", "accent_chair", "floor_lamp", "side_table"]
        .map((c) => p.available_catalog.find((r) => r.category === c))
        .filter(Boolean) as Row[];
      expect(picks.length).toBeGreaterThan(1);
      await reply(route, {
        layout_metadata: { total_items_placed: picks.length, total_spend_eur: 0, budget_buffer_remaining: 0 },
        placements: picks.map((r) => ({ sku: r.sku, category: r.category, position: [1, 1, 0], rotation: 0, layout_logic_justification: "e2e luxury brief" })),
      });
    });

    await page.getByRole("button", { name: "Generate with AI architect" }).click();
    const notes = page.getByText(/Skipped: .*AI rejected:/);
    await expect(notes).toBeVisible({ timeout: 30_000 });
    await expect(notes).toContainText(/overlaps|outside the room/);
    await expect(page.getByText(/AI layout broke a room rule/)).toBeVisible();
    await expect(page.getByText(/AI layout · trade spend/)).toHaveCount(0);
    // Fallback scene is the deterministic standard layout, still rendering.
    await expect(page.locator("canvas").first()).toBeVisible();
    expect(errors, errors.join("\n")).toEqual([]);
  });
});
