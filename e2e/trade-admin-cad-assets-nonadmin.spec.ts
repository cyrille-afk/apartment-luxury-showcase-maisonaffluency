/**
 * E2E: Non-admin cannot access CAD assets admin or mutate trade_product_cad_assets.
 *
 * Verifies:
 *   1. A signed-in non-admin user visiting /trade/admin/cad-assets is redirected
 *      away (the page short-circuits with <Navigate to="/trade" />).
 *   2. The same user cannot UPDATE is_active or file_url on an existing
 *      trade_product_cad_assets row — RLS must reject the write.
 *
 * Skipped automatically when required env vars are missing so CI stays green.
 *
 * Required env:
 *   E2E_NONADMIN_EMAIL     — a trade_user (NOT admin) email
 *   E2E_NONADMIN_PASSWORD  — that user's password
 *   E2E_TEST_PRODUCT_ID    — a trade_products.id (used to seed a row via admin)
 *   E2E_ADMIN_EMAIL        — admin to seed/cleanup the asset row
 *   E2E_ADMIN_PASSWORD     — admin password
 *   VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY — already in .env
 */

import { test, expect } from "@playwright/test";
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

const NONADMIN_EMAIL = env("E2E_NONADMIN_EMAIL");
const NONADMIN_PASSWORD = env("E2E_NONADMIN_PASSWORD");
const ADMIN_EMAIL = env("E2E_ADMIN_EMAIL");
const ADMIN_PASSWORD = env("E2E_ADMIN_PASSWORD");
const TEST_PRODUCT_ID = env("E2E_TEST_PRODUCT_ID");
const SUPABASE_URL = env("VITE_SUPABASE_URL");
const SUPABASE_KEY = env("VITE_SUPABASE_PUBLISHABLE_KEY");

const haveCreds = Boolean(
  NONADMIN_EMAIL &&
    NONADMIN_PASSWORD &&
    ADMIN_EMAIL &&
    ADMIN_PASSWORD &&
    TEST_PRODUCT_ID &&
    SUPABASE_URL &&
    SUPABASE_KEY,
);

test.describe("Trade admin · CAD assets · non-admin access denied", () => {
  test.skip(
    !haveCreds,
    "Set E2E_NONADMIN_EMAIL/PASSWORD, E2E_ADMIN_EMAIL/PASSWORD, E2E_TEST_PRODUCT_ID to run.",
  );

  test("UI redirects away and RLS blocks is_active / file_url updates", async ({ page }) => {
    const variantLabel = `e2e-nonadmin-${Date.now()}`;
    const seedUrl = `https://example.com/e2e/${Date.now()}-seed.dwg`;
    const attemptedUrl = `https://example.com/e2e/${Date.now()}-attack.dwg`;

    // --- Seed a row as admin so we have a real target to attack. ---
    const admin = createClient(SUPABASE_URL!, SUPABASE_KEY!);
    {
      const { error: signInErr } = await admin.auth.signInWithPassword({
        email: ADMIN_EMAIL!,
        password: ADMIN_PASSWORD!,
      });
      expect(signInErr).toBeNull();
    }
    const { data: inserted, error: insertErr } = await admin
      .from("trade_product_cad_assets")
      .insert({
        product_id: TEST_PRODUCT_ID!,
        variant_label: variantLabel,
        file_url: seedUrl,
        file_format: "dwg",
        version: "e2e-seed",
        is_active: true,
      })
      .select("id, is_active, file_url")
      .single();
    expect(insertErr).toBeNull();
    const assetId = inserted!.id as string;
    await admin.auth.signOut();

    try {
      // --- Sign in as non-admin via a separate client (don't share storage) ---
      const nonAdmin = createClient(SUPABASE_URL!, SUPABASE_KEY!, {
        auth: { storageKey: "sb-e2e-nonadmin-auth" },
      });
      const { data: signIn, error: signInErr } =
        await nonAdmin.auth.signInWithPassword({
          email: NONADMIN_EMAIL!,
          password: NONADMIN_PASSWORD!,
        });
      expect(signInErr).toBeNull();
      expect(signIn.session).toBeTruthy();

      // ---- 1) UI gate: visiting /trade/admin/cad-assets must redirect away ----
      const projectRef = new URL(SUPABASE_URL!).hostname.split(".")[0];
      const storageKey = `sb-${projectRef}-auth-token`;
      const sessionPayload = JSON.stringify({
        access_token: signIn.session!.access_token,
        refresh_token: signIn.session!.refresh_token,
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

      await page.goto("/trade/admin/cad-assets", { waitUntil: "networkidle" });
      // Should NOT remain on the admin route.
      await expect.poll(() => new URL(page.url()).pathname, {
        timeout: 10_000,
      }).not.toBe("/trade/admin/cad-assets");

      // ---- 2) RLS gate: direct PATCH must fail (or update zero rows) ----
      // is_active
      {
        const { data, error } = await nonAdmin
          .from("trade_product_cad_assets")
          .update({ is_active: false })
          .eq("id", assetId)
          .select("id");
        // Either an error is returned, or RLS silently filters → empty array.
        const blocked = Boolean(error) || !data || data.length === 0;
        expect(blocked).toBe(true);
      }
      // file_url
      {
        const { data, error } = await nonAdmin
          .from("trade_product_cad_assets")
          .update({ file_url: attemptedUrl })
          .eq("id", assetId)
          .select("id");
        const blocked = Boolean(error) || !data || data.length === 0;
        expect(blocked).toBe(true);
      }

      // ---- 3) Confirm DB row is unchanged (re-read via admin) ----
      await admin.auth.signInWithPassword({
        email: ADMIN_EMAIL!,
        password: ADMIN_PASSWORD!,
      });
      const { data: after } = await admin
        .from("trade_product_cad_assets")
        .select("is_active, file_url")
        .eq("id", assetId)
        .single();
      expect(after?.is_active).toBe(true);
      expect(after?.file_url).toBe(seedUrl);
    } finally {
      await admin.auth.signInWithPassword({
        email: ADMIN_EMAIL!,
        password: ADMIN_PASSWORD!,
      });
      await admin.from("trade_product_cad_assets").delete().eq("id", assetId);
      await admin.auth.signOut();
    }
  });
});
