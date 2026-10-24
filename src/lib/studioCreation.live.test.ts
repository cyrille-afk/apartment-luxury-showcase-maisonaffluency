import { describe, expect, it } from "vitest";
import { createClient } from "@supabase/supabase-js";

const url = process.env.STUDIO_TEST_URL;
const key = process.env.STUDIO_TEST_KEY;
const token = process.env.STUDIO_TEST_TOKEN;
describe.skipIf(!url || !key || !token)("studio creation ownership (live)", () => {
  it("returns the creator's new studio, grants owner membership and rejects another owner", async () => {
    const client = createClient(url || "http://localhost", key || "unused", {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: auth, error: authError } = await client.auth.getUser();
    expect(authError).toBeNull();
    if (!auth.user) throw new Error("Signed-in test user required");
    const name = `Studio creation regression ${crypto.randomUUID()}`;
    const { data, error } = await client.from("studios").insert({ name, created_by: auth.user.id }).select("id,name,created_by").single();
    expect(error).toBeNull();
    if (!data) throw new Error("Studio was not returned");
    try {
      expect(data.created_by).toBe(auth.user.id);
      const { data: owner, error: ownerError } = await client.from("studio_members").select("user_id,role").eq("studio_id", data.id).single();
      expect(ownerError).toBeNull();
      expect(owner).toEqual({ user_id: auth.user.id, role: "owner" });
      const { error: spoofError } = await client.from("studios").insert({ name, created_by: "00000000-0000-4000-8000-000000000001" });
      expect(spoofError?.code).toBe("42501");
    } finally {
      const { error: deleteError } = await client.from("studios").delete().eq("id", data.id);
      expect(deleteError).toBeNull();
    }
  });
});