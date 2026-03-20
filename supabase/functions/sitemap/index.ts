import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://maisonaffluency.com";

const STATIC_URLS = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/#overview", changefreq: "monthly", priority: "0.8" },
  { loc: "/#gallery", changefreq: "monthly", priority: "0.8" },
  { loc: "/#product-grid", changefreq: "weekly", priority: "0.8" },
  { loc: "/#designers", changefreq: "monthly", priority: "0.9" },
  { loc: "/#collectibles", changefreq: "monthly", priority: "0.8" },
  { loc: "/#brands", changefreq: "monthly", priority: "0.8" },
  { loc: "/#curating-team", changefreq: "monthly", priority: "0.7" },
  { loc: "/#details", changefreq: "monthly", priority: "0.6" },
  { loc: "/#contact", changefreq: "monthly", priority: "0.6" },
  { loc: "/journal", changefreq: "weekly", priority: "0.9" },
  { loc: "/trade/program", changefreq: "monthly", priority: "0.8" },
  { loc: "/trade/register", changefreq: "monthly", priority: "0.6" },
  { loc: "/trade/login", changefreq: "monthly", priority: "0.5" },
];

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

serve(async () => {
  const today = new Date().toISOString().split("T")[0];

  // Fetch published journal articles
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: articles } = await supabase
    .from("journal_articles")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  // Fetch active products for individual product pages
  const { data: products } = await supabase
    .from("trade_products")
    .select("id, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  const staticEntries = STATIC_URLS.map((u) => urlEntry(u.loc, today, u.changefreq, u.priority));

  const articleEntries = (articles || []).map((a: { slug: string; updated_at: string }) =>
    urlEntry(`/journal/${a.slug}`, a.updated_at.split("T")[0], "monthly", "0.7")
  );

  const productEntries = (products || []).map((p: { id: string; updated_at: string }) =>
    urlEntry(`/product/${p.id}`, p.updated_at.split("T")[0], "weekly", "0.6")
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...articleEntries, ...productEntries].join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
