/**
 * Integration guard: `featured_studios.contact_email` MUST NEVER be readable
 * by the anonymous (unauthenticated) role through the Data API.
 *
 * Anon must use `featured_studios_public`, a safe projection table that
 * excludes contact_email. These tests hit the live Lovable Cloud endpoint
 * with the project's anon key to prove the gate holds end-to-end.
 *
 * If these tests fail, anon has regained access to PII — fix the GRANTs
 * before shipping.
 */
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as
  | string
  | undefined;

const skip = !SUPABASE_URL || !ANON_KEY;
const d = skip ? describe.skip : describe;

// Columns anon is explicitly granted SELECT on. Keep in sync with migration.
const PUBLIC_COLUMNS = [
  "id",
  "name",
  "slug",
  "is_published",
  "hero_image_url",
  "tagline",
  "location",
  "country",
] as const;

// Columns anon must NEVER be able to read.
const SENSITIVE_COLUMNS = ["contact_email"] as const;

d("featured_studios — anon column-level access", () => {
  const anon = createClient(SUPABASE_URL!, ANON_KEY!, {
    auth: { persistSession: false },
  });

  it("rejects a direct SELECT of contact_email", async () => {
    const { data, error } = await anon
      .from("featured_studios")
      .select("id, contact_email")
      .limit(1);

    // Preferred: Postgres rejects the query with permission denied.
    if (error) {
      expect(error.message.toLowerCase()).toMatch(
        /permission|denied|contact_email/,
      );
      return;
    }
    // Fallback: if the request succeeds, the column must be masked/null.
    for (const row of data ?? []) {
      expect((row as Record<string, unknown>).contact_email ?? null).toBeNull();
    }
  });

  for (const col of SENSITIVE_COLUMNS) {
    it(`rejects a direct SELECT of ${col}`, async () => {
      const { data, error } = await anon
        .from("featured_studios")
        .select(`id, ${col}`)
        .limit(1);
      if (error) {
        expect(error.message.toLowerCase()).toMatch(
          new RegExp(`permission|denied|${col}`),
        );
        return;
      }
      for (const row of data ?? []) {
        expect((row as Record<string, unknown>)[col] ?? null).toBeNull();
      }
    });
  }

  it("rejects SELECT * (which would implicitly include contact_email)", async () => {
    const { data, error } = await anon
      .from("featured_studios")
      .select("*")
      .limit(1);
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|denied/);
      return;
    }
    for (const row of data ?? []) {
      for (const col of SENSITIVE_COLUMNS) {
        expect((row as Record<string, unknown>)[col] ?? null).toBeNull();
      }
    }
  });

  it("allows SELECT of every documented public column through the safe public projection", async () => {
    const { data, error } = await anon
      .from("featured_studios_public")
      .select(PUBLIC_COLUMNS.join(", "))
      .eq("is_published", true)
      .limit(1);

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    const rows = (data ?? []) as unknown as Array<Record<string, unknown>>;
    if (rows.length > 0) {
      const row = rows[0];
      for (const col of PUBLIC_COLUMNS) {
        expect(col in row).toBe(true);
      }
      // And critically: sensitive columns must not have leaked in.
      for (const col of SENSITIVE_COLUMNS) {
        expect(col in row).toBe(false);
      }
    }
  });
});
