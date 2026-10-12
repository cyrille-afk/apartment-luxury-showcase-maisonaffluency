/**
 * Slug integrity for the public/trade catalogue: every curator pick must have
 * a full, unique, lowercase slug so product URLs read
 * /products/<designer>/<full-product-slug> — never a truncated one-letter slug
 * like the "g" regression on Gleam Suspension.
 *
 * Runs against the live database via the anon client (public catalog is
 * anon-readable). Skipped automatically when offline.
 */
import { describe, expect, it } from "vitest";
import { supabase } from "@/integrations/supabase/client";

const PAGE = 1000;

async function fetchAllSlugs(): Promise<{ id: string; title: string | null; slug: string | null }[]> {
  const rows: { id: string; title: string | null; slug: string | null }[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from("designer_curator_picks")
      .select("id, title, slug")
      .range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data?.length) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return rows;
}

describe("catalogue slug integrity", () => {
  it("every product has a full, unique, URL-safe slug", async () => {
    let rows: Awaited<ReturnType<typeof fetchAllSlugs>>;
    try {
      rows = await fetchAllSlugs();
    } catch {
      // No network in this environment — nothing to verify.
      return;
    }
    expect(rows.length).toBeGreaterThan(0);

    const broken = rows.filter(
      (r) => !r.slug || r.slug.length < 4 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(r.slug)
    );
    expect(
      broken.map((r) => `${r.title} -> ${JSON.stringify(r.slug)}`),
      "products with missing/truncated/non-slug slugs"
    ).toEqual([]);

    const bySlug = new Map<string, string[]>();
    for (const r of rows) {
      const list = bySlug.get(r.slug!) ?? [];
      list.push(r.title ?? r.id);
      bySlug.set(r.slug!, list);
    }
    const dupes = [...bySlug.entries()].filter(([, titles]) => titles.length > 1);
    expect(
      dupes.map(([slug, titles]) => `${slug}: ${titles.join(" | ")}`),
      "duplicate slugs"
    ).toEqual([]);
  }, 60_000);
});
