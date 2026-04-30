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

const escapeXml = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");

const imageBlock = (url: string, caption?: string) =>
  `    <image:image>
      <image:loc>${escapeXml(url)}</image:loc>${caption ? `\n      <image:caption>${escapeXml(caption)}</image:caption>` : ""}
    </image:image>`;

function urlEntry(loc: string, lastmod: string, changefreq: string, priority: string): string {
  return `  <url>
    <loc>${SITE}${loc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

function urlEntryFull(opts: {
  loc: string;
  lastmod: string;
  changefreq: string;
  priority: string;
  hreflang?: boolean;
  images?: { url: string; caption?: string }[];
}): string {
  const full = `${SITE}${opts.loc}`;
  const hreflangLines = opts.hreflang
    ? `\n    <xhtml:link rel="alternate" hreflang="en" href="${full}"/>\n    <xhtml:link rel="alternate" hreflang="x-default" href="${full}"/>`
    : "";
  const imageLines = (opts.images || [])
    .filter((i) => i.url && /^https?:\/\//i.test(i.url))
    .map((i) => imageBlock(i.url, i.caption))
    .join("\n");
  return `  <url>
    <loc>${full}</loc>
    <lastmod>${opts.lastmod}</lastmod>
    <changefreq>${opts.changefreq}</changefreq>
    <priority>${opts.priority}</priority>${hreflangLines}${imageLines ? "\n" + imageLines : ""}
  </url>`;
}

serve(async () => {
  const today = new Date().toISOString().split("T")[0];

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: articles } = await supabase
    .from("journal_articles")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  const { data: designers } = await supabase
    .from("designers")
    .select("slug, updated_at")
    .eq("is_published", true)
    .order("slug");

  const { data: products } = await supabase
    .from("trade_products")
    .select("id, updated_at")
    .eq("is_active", true)
    .order("updated_at", { ascending: false });

  // Fetch published studios with media for image sitemap entries
  const { data: studios } = await supabase
    .from("featured_studios")
    .select("slug, name, updated_at, hero_image_url, gallery_images, is_featured")
    .eq("is_published", true)
    .order("slug");

  // Build image list for the /studios directory page: hero of every
  // featured studio (cap at 50 to keep XML reasonable).
  const directoryImages = (studios || [])
    .filter((s: any) => s.is_featured && s.hero_image_url)
    .slice(0, 50)
    .map((s: any) => ({ url: s.hero_image_url as string, caption: s.name as string }));

  const staticEntries = STATIC_URLS.map((u) =>
    u.loc === "/studios"
      ? urlEntryFull({
          loc: u.loc,
          lastmod: today,
          changefreq: u.changefreq,
          priority: u.priority,
          hreflang: true,
          images: directoryImages,
        })
      : urlEntry(u.loc, today, u.changefreq, u.priority)
  );

  const designerEntries = (designers || []).map((d: { slug: string; updated_at: string }) =>
    urlEntry(`/designers/${d.slug}`, d.updated_at.split("T")[0], "monthly", "0.7")
  );

  const articleEntries = (articles || []).map((a: { slug: string; updated_at: string }) =>
    urlEntry(`/journal/${a.slug}`, a.updated_at.split("T")[0], "monthly", "0.7")
  );

  const productEntries = (products || []).map((p: { id: string; updated_at: string }) =>
    urlEntry(`/product/${p.id}`, p.updated_at.split("T")[0], "weekly", "0.6")
  );

  const studioEntries = (studios || []).map((s: any) => {
    const images: { url: string; caption?: string }[] = [];
    if (s.hero_image_url) images.push({ url: s.hero_image_url, caption: s.name });
    const gallery = Array.isArray(s.gallery_images) ? s.gallery_images : [];
    for (const g of gallery.slice(0, 10)) {
      if (typeof g === "string" && g) images.push({ url: g, caption: s.name });
    }
    return urlEntryFull({
      loc: `/studios/${s.slug}`,
      lastmod: (s.updated_at as string).split("T")[0],
      changefreq: "monthly",
      priority: "0.7",
      hreflang: true,
      images,
    });
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${[...staticEntries, ...designerEntries, ...articleEntries, ...productEntries, ...studioEntries].join("\n")}
</urlset>`;

  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
});
