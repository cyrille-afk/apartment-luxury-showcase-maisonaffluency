/**
 * E2E: Admin CAD assets management
 *
 * Verifies that an admin can:
 *   1. Sign in via /trade/login
 *   2. Create a trade_product_cad_assets record (with variant_label) by inserting
 *      via the authenticated Supabase client (mirroring what handleAdd does in
 *      TradeAdminCadAssets.tsx — we bypass the CloudUpload step since it requires
 *      a real file upload to storage)
 *   3. Toggle is_active from the UI
 *   4. Edit file_url from the UI (via the new Pencil button)
 *   5. Confirm both the UI and the database row reflect the changes
 *
 * Skipped automatically when E2E_ADMIN_EMAIL / E2E_ADMIN_PASSWORD /
 * E2E_TEST_PRODUCT_ID are not set, so CI without secrets stays green.
 *
 * Required env:
 *   E2E_ADMIN_EMAIL          — admin user email
 *   E2E_ADMIN_PASSWORD       — admin user password
 *   E2E_TEST_PRODUCT_ID      — a trade_products.id the admin can attach assets to
 *   VITE_SUPABASE_URL        — already present in .env
 *   VITE_SUPABASE_PUBLISHABLE_KEY — already present in .env
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Lightweight .env loader — avoids adding a dotenv dep just for one test.
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

const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD;
const TEST_PRODUCT_ID = process.env.E2E_TEST_PRODUCT_ID;
const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const haveCreds = Boolean(
  ADMIN_EMAIL && ADMIN_PASSWORD && TEST_PRODUCT_ID && SUPABASE_URL && SUPABASE_KEY,
);

test.describe("Trade admin · CAD assets", () => {
  test.skip(!haveCreds, "Set E2E_ADMIN_EMAIL/PASSWORD and E2E_TEST_PRODUCT_ID to run.");

  test("create, toggle active, edit URL — persists in UI + DB", async ({ page }) => {
    const variantLabel = `e2e-variant-${Date.now()}`;
    const initialUrl = `https://example.com/e2e/${Date.now()}-initial.dwg`;
    const updatedUrl = `https://example.com/e2e/${Date.now()}-updated.dwg`;

    // --- Seed an asset via Supabase using the admin's own JWT (mirrors UI insert path) ---
    const sb = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    const { data: signIn, error: signInErr } = await sb.auth.signInWithPassword({
      email: ADMIN_EMAIL!,
      password: ADMIN_PASSWORD!,
    });
    expect(signInErr).toBeNull();
    expect(signIn.session).toBeTruthy();
    const accessToken = signIn.session!.access_token;
    const refreshToken = signIn.session!.refresh_token;

    const { data: inserted, error: insertErr } = await sb
      .from("trade_product_cad_assets")
      .insert({
        product_id: TEST_PRODUCT_ID!,
        variant_label: variantLabel,
        file_url: initialUrl,
        file_format: "dwg",
        version: "e2e-v1",
        is_active: true,
      })
      .select("id, is_active, file_url")
      .single();
    expect(insertErr).toBeNull();
    expect(inserted).toBeTruthy();
    const assetId = inserted!.id as string;

    try {
      // --- Plant the same session in the browser so the SPA boots authenticated ---
      // Storage key matches @supabase/supabase-js default: sb-<ref>-auth-token
      const projectRef = new URL(SUPABASE_URL!).hostname.split(".")[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const sessionPayload = JSON.stringify({
        access_token: accessToken,
        refresh_token: refreshToken,
        expires_at: signIn.session!.expires_at,
        expires_in: signIn.session!.expires_in,
        token_type: "bearer",
        user: signIn.session!.user,
      });

      await page.goto("/trade/login", { waitUntil: "domcontentloaded" });
      await page.evaluate(
        ([k, v]) => window.localStorage.setItem(k as string, v as string),
        [storageKey, sessionPayload],
      );

      // Open product-scoped view directly — admin page filters via product picker;
      // we navigate then use the picker to select our product.
      await page.goto("/trade/admin/cad-assets", { waitUntil: "domcontentloaded" });

      // Wait for the row we just inserted to appear in the "All uploaded assets" table.
      const rowSelector = `[data-testid="cad-asset-row-${assetId}"]`;
      // First select the product so the per-product section renders.
      // The "All uploaded assets" table renders independently; the per-product
      // list (with our testids) only renders after picking the product.
      // Easiest: click the product name in the all-assets table (it sets productId).
      await page.waitForSelector(`text=${variantLabel}`, { timeout: 20_000 });
      // Click the product cell button in the all-assets table (first match).
      // The button is the first cell of the row containing our variant label.
      const allTableRow = page.locator(`tr:has-text("${variantLabel}")`).first();
      await allTableRow.locator("button").first().click();

      await page.waitForSelector(rowSelector, { timeout: 10_000 });

      // ---- 1) Toggle active OFF ----
      const toggle = page.locator(`[data-testid="active-toggle-${assetId}"]`);
      await expect(toggle).toBeChecked();
      await toggle.click();
      await expect(toggle).not.toBeChecked({ timeout: 5_000 });

      // DB check
      const { data: afterToggle } = await sb
        .from("trade_product_cad_assets")
        .select("is_active")
        .eq("id", assetId)
        .single();
      expect(afterToggle?.is_active).toBe(false);

      // ---- 2) Edit file URL ----
      page.once("dialog", async (d) => {
        expect(d.type()).toBe("prompt");
        await d.accept(updatedUrl);
      });
      await page.locator(`[data-testid="edit-url-${assetId}"]`).click();

      // UI shows the new filename (last path segment)
      const link = page.locator(`[data-testid="file-url-link-${assetId}"]`);
      await expect(link).toHaveText(updatedUrl.split("/").pop()!, { timeout: 5_000 });
      await expect(link).toHaveAttribute("href", updatedUrl);

      // DB check
      const { data: afterEdit } = await sb
        .from("trade_product_cad_assets")
        .select("file_url")
        .eq("id", assetId)
        .single();
      expect(afterEdit?.file_url).toBe(updatedUrl);
    } finally {
      // Cleanup
      await sb.from("trade_product_cad_assets").delete().eq("id", assetId);
    }
  });
});
