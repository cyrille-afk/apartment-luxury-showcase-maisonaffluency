// Run explicitly with the managed admin session: bun run test:unit -- src/lib/approvedTradeDirectory.live.test.ts
// Disposable approved accounts do not invoke the application email sender.
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const token = process.env.LOVABLE_BROWSER_SUPABASE_ACCESS_TOKEN;
const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const fixtureId = process.env.E2E_DIRECTORY_ACCOUNT_ID;
const live = Boolean(token && url && key && fixtureId);
const client = createClient(url || "http://localhost", key || "unused", {
  global: { headers: { Authorization: `Bearer ${token || "unused"}` } },
  auth: { persistSession: false, autoRefreshToken: false },
});
const stamp = "cf289daf";
const accountId = fixtureId || "unused";
const email = "directory-sync-verification@example.invalid";
const studio = "8f16a389-f13c-487a-83a2-01b81639e7dd";
let profileId: string | undefined;

async function synced() {
  const { data, error } = await client.from("clients").select("*,client_contacts(*)").eq("onboarding_account_id", accountId);
  if (error) throw error;
  return data || [];
}

describe.skipIf(!live)("approved Trade User directory sync (live)", () => {
  beforeAll(async () => {
    const { data, error } = await client.from("trade_accounts").select("id,status").eq("id", accountId).single();
    if (error) throw error;
    expect(data.status).toBe("pending_review");
  });
  afterAll(async () => {
    const { error: ce } = await client.from("clients").delete().eq("onboarding_account_id", accountId);
    if (ce) throw ce;
    const { error } = await client.from("trade_accounts").delete().eq("id", accountId);
    if (error) throw error;
  });
  it("does not create a directory profile before approval", async () => {
    expect(await synced()).toHaveLength(0);
  });
  it("creates the profile and contact automatically upon approval", async () => {
    const { error } = await client.from("trade_accounts").update({ status: "approved" }).eq("id", accountId);
    if (error) throw error;
    const rows = await synced();
    expect(rows).toHaveLength(1);
    profileId = rows[0].id;
    expect(rows[0].website).toBe("https://example.invalid");
    expect(rows[0].tax_id).toBe("TEST-VAT");
    expect(rows[0].billing_country).toBe("Singapore");
    expect(rows[0].client_contacts).toHaveLength(1);
    expect(rows[0].client_contacts[0].email).toBe(email);
    expect(rows[0].client_contacts[0].role_title).toBe("Principal");
  });
  it("updates the same profile and contact without duplicates", async () => {
    const { error } = await client.from("trade_accounts").update({ studio_name: `Renamed directory verification ${stamp}`, phone_number: "+6599990001", city: "Updated City" }).eq("id", accountId);
    if (error) throw error;
    const rows = await synced();
    expect(rows).toHaveLength(1);
    expect(rows[0].id).toBe(profileId);
    expect(rows[0].name).toBe(`Renamed directory verification ${stamp}`);
    expect(rows[0].billing_city).toBe("Updated City");
    expect(rows[0].client_contacts).toHaveLength(1);
    expect(rows[0].client_contacts[0].phone).toBe("+6599990001");
  });
  it("copies only into the configured private internal studio", async () => {
    expect((await synced()).map(row => row.studio_id)).toEqual([studio]);
  });
  it("denies direct client-side sync execution", async () => {
    const { error } = await client.rpc("sync_approved_trade_directory", { p_account_id: accountId });
    expect(error?.code).toBe("42501");
  });
  it("preserves manually added notes during later sync", async () => {
    if (!profileId) throw new Error("Missing synced client");
    const { error } = await client.from("clients").update({ notes: "Keep my private notes" }).eq("id", profileId);
    if (error) throw error;
    const { error: syncError } = await client.from("trade_accounts").update({ website_or_ig: "example.invalid" }).eq("id", accountId);
    if (syncError) throw syncError;
    expect((await synced())[0].notes).toBe("Keep my private notes");
  });
  it("fills the VAT field from the registration number when no VAT number exists", async () => {
    const { error } = await client.from("trade_accounts").update({ tax_vat_id: null, business_reg_number: "TEST-REG-123" }).eq("id", accountId);
    if (error) throw error;
    expect((await synced())[0].tax_id).toBe("TEST-REG-123");
  });
  it("prefers the VAT number over the registration number when both exist", async () => {
    const { error } = await client.from("trade_accounts").update({ tax_vat_id: "TEST-VAT-2" }).eq("id", accountId);
    if (error) throw error;
    expect((await synced())[0].tax_id).toBe("TEST-VAT-2");
  });
});