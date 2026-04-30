import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SITE = "https://www.maisonaffluency.com";

const STATIC_URLS = [
  { loc: "/", changefreq: "weekly", priority: "1.0" },
  { loc: "/designers", changefreq: "weekly", priority: "0.9" },
  { loc: "/new-in", changefreq: "weekly", priority: "0.9" },
  { loc: "/gallery", changefreq: "monthly", priority: "0.8" },
  { loc: "/collectibles", changefreq: "monthly", priority: "0.8" },
  { loc: "/contact", changefreq: "monthly", priority: "0.7" },
  { loc: "/journal", changefreq: "weekly", priority: "0.9" },
  { loc: "/studios", changefreq: "weekly", priority: "0.8" },
  { loc: "/trade-program", changefreq: "monthly", priority: "0.8" },
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

function urlEntryWithHreflang(loc: string, lastmod: string, changefreq: string, priority: string): string {
  const full = `${SITE}${loc}`;
  return `  <url>
    <loc>${full}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
    <xhtml:link rel="alternate" hreflang="en" href="${full}"/>
    <xhtml:link rel="alternate" hreflang="x-default" href="${full}"/>
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

  // Fetch published designers
  const { data: designers } = await supabase
    .from("designers")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("slug");

  // Fetch active products for individual product pages
  const { data: products } = await supabase
    .from("trade_products")
    .select("id, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  // Fetch published studios
  const { data: studios } = await supabase
    .from("featured_studios")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("slug");

  const staticEntries = STATIC_URLS.map((u) => urlEntry(u.loc, today, u.changefreq, u.priority));

  const designerEntries = (designers || []).map((d: { slug: string; updated_at: string }) =>
    urlEntry(`/designers/${d.slug}`, d.updated_at.split("T")[0], "monthly", "0.7")
  );

  const articleEntries = (articles || []).map((a: { slug: string; updated_at: string }) =>
    urlEntry(`/journal/${a.slug}`, a.updated_at.split("T")[0], "monthly", "0.7")
  );

  const productEntries = (products || []).map((p: { id: string; updated_at: string }) =>
    urlEntry(`/product/${p.id}`, p.updated_at.split("T")[0], "weekly", "0.6")
  );

  const studioEntries = (studios || []).map((s: { slug: string; updated_at: string }) =>
    urlEntry(`/studios/${s.slug}`, s.updated_at.split("T")[0], "monthly", "0.7")
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticEntries, ...designerEntries, ...articleEntries, ...productEntries, ...studioEntries].join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
