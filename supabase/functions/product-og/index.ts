const SITE_URL = "https://www.maisonaffluency.com";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Cache-Control": "public, max-age=3600, s-maxage=86400",
  "X-Robots-Tag": "noindex, nofollow",
};

const sanitizeSlug = (value: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

Deno.serve((req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  const url = new URL(req.url);
  const designerSlug = sanitizeSlug(url.searchParams.get("designer"));
  const productSlug = sanitizeSlug(url.searchParams.get("product"));

  const target = designerSlug && productSlug
    ? `${SITE_URL}/share/og/${designerSlug}-${productSlug}-og.html`
    : `${SITE_URL}/collectibles-og.html`;


  return new Response(null, {
    status: 301,
    headers: {
      ...headers,
      Location: target,
    },
  });
});
