import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
  "X-Robots-Tag": "noindex, nofollow",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const slug = url.searchParams.get("slug");

  if (!slug) {
    return new Response("Missing slug parameter", { status: 400 });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: designer, error } = await supabase
    .from("designers")
    .select("name, display_name, specialty, slug, image_url, hero_image_url, source")
    .eq("slug", slug)
    .eq("is_published", true)
    .single();

  if (error || !designer) {
    return new Response("Designer not found", { status: 404 });
  }

  const displayName = designer.display_name || designer.name;
  const description = designer.specialty || "Design";
  const canonicalUrl = `https://www.maisonaffluency.com/designers/${designer.slug}`;

  // Build OG image URL from Cloudinary — prefer Cloudinary-hosted images
  // to avoid hotlink blocks from external domains
  let ogImage = "";
  const heroImg = designer.hero_image_url || "";
  const mainImg = designer.image_url || "";
  // Prefer whichever is Cloudinary-hosted; fall back to either
  const rawImage = mainImg.includes("cloudinary.com") ? mainImg
    : heroImg.includes("cloudinary.com") ? heroImg
    : heroImg || mainImg;

  if (rawImage.includes("cloudinary.com")) {
    // Already a Cloudinary URL – apply OG transform
    const parts = rawImage.replace(/\/upload\/[^/]*\//, "/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/");
    ogImage = parts;
  } else if (rawImage.startsWith("http")) {
    // External URL – use Cloudinary fetch
    ogImage = `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1200,h_630,c_fill_pad,g_auto,b_auto,q_auto:best,f_jpg/${rawImage}`;
  } else {
    // Fallback
    ogImage = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/maison-affluency-og";
  }

  // Escape HTML entities
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  const title = `${esc(displayName)} — Maison Affluency`;
  const desc = esc(description);

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${title}</title>
    <meta name="description" content="${desc}" />
    <meta name="robots" content="noindex, nofollow" />
    <link rel="canonical" href="${canonicalUrl}" />
    <link rel="icon" href="https://www.maisonaffluency.com/favicon.ico" sizes="any" />

    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Maison Affluency" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${desc}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:secure_url" content="${ogImage}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${desc}" />
    <meta name="twitter:image" content="${ogImage}" />
  </head>
  <body>
    <script>if(!/bot|crawl|spider|WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Pinterest|Googlebot/i.test(navigator.userAgent)){window.location.replace("${canonicalUrl}");}</script>
  </body>
</html>`;

  return new Response(html, { status: 200, headers: corsHeaders });
});
