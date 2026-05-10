import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
  "X-Robots-Tag": "noindex, nofollow",
};

const slugify = (s: string) =>
  (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['']/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");

const esc = (s: string) =>
  (s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function buildOgImage(raw: string | null | undefined): string {
  const url = (raw || "").trim();
  if (url.includes("cloudinary.com")) {
    return url.replace(/\/upload\/[^/]*\//, "/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/");
  }
  if (url.startsWith("http")) {
    return `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1200,h_630,c_fill_pad,g_auto,b_auto,q_auto:best,f_jpg/${url}`;
  }
  return "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/maison-affluency-og";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const designerSlug = url.searchParams.get("designer");
  const productSlug = url.searchParams.get("product");

  if (!designerSlug || !productSlug) {
    return new Response("Missing designer or product parameter", { status: 400, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: designer } = await supabase
    .from("designers")
    .select("id, name, display_name, slug")
    .eq("slug", designerSlug)
    .eq("is_published", true)
    .maybeSingle();

  if (!designer) {
    return new Response("Designer not found", { status: 404, headers: corsHeaders });
  }

  const { data: picks } = await supabase
    .from("designer_curator_picks")
    .select("title, subtitle, description, image_url, gallery_images")
    .eq("designer_id", designer.id);

  const product =
    (picks || []).find((p: any) => slugify(`${p.title}-${p.subtitle || ""}`) === productSlug) ||
    (picks || []).find((p: any) => slugify(p.title) === productSlug);

  const designerDisplay = designer.display_name || designer.name;
  const canonicalUrl = `https://www.maisonaffluency.com/designers/${designer.slug}/${productSlug}`;

  if (!product) {
    // Soft fallback to designer page so social cards still preview something
    return Response.redirect(
      `https://${url.host}/functions/v1/designer-og?slug=${encodeURIComponent(designerSlug)}`,
      302
    );
  }

  const title = `${product.title}${product.subtitle ? ` — ${product.subtitle}` : ""} by ${designerDisplay} — Maison Affluency`;
  const description = (product.description || `${product.title} by ${designerDisplay}`).slice(0, 280);
  const rawImg =
    (Array.isArray(product.gallery_images) && product.gallery_images[0]) ||
    product.image_url ||
    "";
  const ogImage = buildOgImage(rawImg);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="icon" href="https://www.maisonaffluency.com/favicon.ico" sizes="any" />

    <meta property="og:type" content="product" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Maison Affluency" />
    <meta property="og:url" content="${canonicalUrl}" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:secure_url" content="${ogImage}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ogImage}" />
  </head>
  <body>
    <script>if(!/bot|crawl|spider|WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Pinterest|Googlebot/i.test(navigator.userAgent)){window.location.replace("${canonicalUrl}");}</script>
  </body>
</html>`;

  return new Response(html, { status: 200, headers: corsHeaders });
});
