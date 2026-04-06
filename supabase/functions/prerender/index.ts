import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const SITE = "https://www.maisonaffluency.com";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const path = url.searchParams.get("path") || "/";

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  let title = "Maison Affluency — Curated Luxury Design & Collectible Furniture";
  let description = "From Couture Furniture and Collectible Designs in situ, to the world's most distinguished Furniture Houses and Artisan Workshops. Based in Singapore's District 9.";
  let canonical = SITE + path;
  let ogImage = "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/maison-affluency-og";
  let bodyContent = "";
  let jsonLd = "";

  // --- Designer profile ---
  const designerMatch = path.match(/^\/designers\/([a-z0-9-]+)$/);
  if (designerMatch) {
    const slug = designerMatch[1];
    const { data: designer } = await supabase
      .from("designers")
      .select("name, display_name, specialty, slug, image_url, hero_image_url, biography, philosophy, notable_works, source")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (designer) {
      const displayName = designer.display_name || designer.name;
      title = `${displayName} — Designer | Maison Affluency`;
      description = designer.specialty || "Design";
      canonical = `${SITE}/designers/${designer.slug}`;
      ogImage = buildOgImage(designer.image_url, designer.hero_image_url);

      // Fetch curator picks for this designer
      const { data: picks } = await supabase
        .from("designer_curator_picks")
        .select("title, category, subcategory, materials, dimensions")
        .eq("designer_id", designer.id || "")
        .order("sort_order");

      // If we don't have designer.id from the select, fetch picks by slug
      const { data: designerFull } = !picks?.length ? await supabase
        .from("designers")
        .select("id")
        .eq("slug", slug)
        .single() : { data: null };

      let picksData = picks;
      if (!picksData?.length && designerFull?.id) {
        const { data: p2 } = await supabase
          .from("designer_curator_picks")
          .select("title, category, subcategory, materials, dimensions")
          .eq("designer_id", designerFull.id)
          .order("sort_order");
        picksData = p2;
      }

      bodyContent = `
        <h1>${esc(displayName)}</h1>
        <p><strong>${esc(designer.specialty || "")}</strong></p>
        ${designer.biography ? `<h2>Biography</h2><p>${esc(designer.biography.substring(0, 500))}...</p>` : ""}
        ${designer.philosophy ? `<h2>Design Philosophy</h2><p>${esc(designer.philosophy.substring(0, 500))}...</p>` : ""}
        ${designer.notable_works ? `<h2>Notable Works</h2><p>${esc(designer.notable_works.substring(0, 500))}</p>` : ""}
        ${picksData?.length ? `
          <h2>Curators' Picks</h2>
          <ul>
            ${picksData.map(p => `<li>${esc(p.title)}${p.category ? ` — ${esc(p.category)}` : ""}${p.materials ? `, ${esc(p.materials)}` : ""}${p.dimensions ? `, ${esc(p.dimensions)}` : ""}</li>`).join("\n            ")}
          </ul>
        ` : ""}
        <p><a href="${SITE}/trade/program">Join Our Trade Program</a> for exclusive pricing and access.</p>`;

      jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Person",
        "name": displayName,
        "jobTitle": designer.specialty,
        "description": designer.biography?.substring(0, 300),
        "url": canonical,
        "image": ogImage,
        "worksFor": {
          "@type": "Organization",
          "name": "Maison Affluency"
        }
      });
    }
  }

  // --- Designer index ---
  if (path === "/designers") {
    title = "Designers & Makers | Maison Affluency";
    description = "Explore our curated roster of world-class designers and artisan makers.";

    const { data: designers } = await supabase
      .from("designers")
      .select("name, display_name, specialty, slug")
      .eq("is_published", true)
      .order("sort_order");

    bodyContent = `
      <h1>Featured Designers &amp; Makers</h1>
      <p>Maison Affluency represents a curated roster of the world's most distinguished furniture houses and artisan workshops.</p>
      <ul>
        ${(designers || []).map(d => `<li><a href="${SITE}/designers/${d.slug}">${esc(d.display_name || d.name)}</a> — ${esc(d.specialty || "Design")}</li>`).join("\n        ")}
      </ul>
      <p><a href="${SITE}/trade/program">Join Our Trade Program</a></p>`;
  }

  // --- Journal article ---
  const journalMatch = path.match(/^\/journal\/([a-z0-9-]+)$/);
  if (journalMatch) {
    const slug = journalMatch[1];
    const { data: article } = await supabase
      .from("journal_articles")
      .select("title, excerpt, content, author, category, cover_image_url, published_at, tags")
      .eq("slug", slug)
      .eq("is_published", true)
      .single();

    if (article) {
      title = `${article.title} | Maison Affluency Journal`;
      description = article.excerpt || article.title;
      if (article.cover_image_url) {
        ogImage = article.cover_image_url.includes("cloudinary.com")
          ? article.cover_image_url.replace(/\/upload\/[^/]*\//, "/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/")
          : `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1200,h_630,c_fill_pad,g_auto,b_auto,q_auto:best,f_jpg/${article.cover_image_url}`;
      }

      // Strip HTML/markdown for plain text
      const plainContent = article.content
        .replace(/<[^>]*>/g, "")
        .replace(/[#*_`]/g, "")
        .substring(0, 1000);

      bodyContent = `
        <article>
          <h1>${esc(article.title)}</h1>
          <p><em>By ${esc(article.author)} | ${article.category?.replace(/_/g, " ")}</em></p>
          <p>${esc(article.excerpt)}</p>
          <div>${esc(plainContent)}...</div>
          ${article.tags?.length ? `<p>Tags: ${article.tags.map((t: string) => esc(t)).join(", ")}</p>` : ""}
        </article>`;

      jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Article",
        "headline": article.title,
        "description": article.excerpt,
        "author": { "@type": "Organization", "name": article.author },
        "publisher": { "@type": "Organization", "name": "Maison Affluency" },
        "datePublished": article.published_at,
        "image": ogImage,
        "url": canonical,
      });
    }
  }

  // --- Journal index ---
  if (path === "/journal") {
    title = "Journal | Maison Affluency";
    description = "Design insights, trend reports, and stories from the world of collectible furniture and luxury interiors.";

    const { data: articles } = await supabase
      .from("journal_articles")
      .select("title, slug, excerpt, category, published_at")
      .eq("is_published", true)
      .order("published_at", { ascending: false })
      .limit(50);

    bodyContent = `
      <h1>Maison Affluency Journal</h1>
      <p>Design insights, trend reports, and stories from the world of collectible furniture and luxury interiors.</p>
      <ul>
        ${(articles || []).map(a => `<li><a href="${SITE}/journal/${a.slug}">${esc(a.title)}</a> — ${esc(a.excerpt?.substring(0, 120) || "")}</li>`).join("\n        ")}
      </ul>`;
  }

  // --- Product page ---
  const productMatch = path.match(/^\/product\/([a-f0-9-]+)$/);
  if (productMatch) {
    const id = productMatch[1];
    const { data: product } = await supabase
      .from("trade_products")
      .select("product_name, brand_name, category, subcategory, description, dimensions, materials, image_url")
      .eq("id", id)
      .eq("is_active", true)
      .single();

    if (product) {
      title = `${product.product_name} by ${product.brand_name} | Maison Affluency`;
      description = product.description || `${product.product_name} — ${product.category}`;
      if (product.image_url) {
        ogImage = product.image_url.includes("cloudinary.com")
          ? product.image_url.replace(/\/upload\/[^/]*\//, "/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/")
          : `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1200,h_630,c_fill_pad,g_auto,b_auto,q_auto:best,f_jpg/${product.image_url}`;
      }

      bodyContent = `
        <h1>${esc(product.product_name)}</h1>
        <p><strong>${esc(product.brand_name)}</strong> — ${esc(product.category || "")}${product.subcategory ? ` / ${esc(product.subcategory)}` : ""}</p>
        ${product.description ? `<p>${esc(product.description.substring(0, 500))}</p>` : ""}
        ${product.materials ? `<p>Materials: ${esc(product.materials)}</p>` : ""}
        ${product.dimensions ? `<p>Dimensions: ${esc(product.dimensions)}</p>` : ""}
        <p><a href="${SITE}/trade/program">Join Our Trade Program</a> for pricing and availability.</p>`;

      jsonLd = JSON.stringify({
        "@context": "https://schema.org",
        "@type": "Product",
        "name": product.product_name,
        "brand": { "@type": "Brand", "name": product.brand_name },
        "description": product.description,
        "category": product.category,
        "material": product.materials,
        "image": ogImage,
        "url": canonical,
        "offers": {
          "@type": "Offer",
          "availability": "https://schema.org/InStock",
          "priceCurrency": "USD",
          "price": "0",
          "priceValidUntil": "2027-12-31",
          "url": `${SITE}/trade/program`
        }
      });
    }
  }

  // --- Homepage fallback ---
  if (!bodyContent) {
    const { data: designers } = await supabase
      .from("designers")
      .select("name, display_name, slug, specialty")
      .eq("is_published", true)
      .order("sort_order")
      .limit(30);

    bodyContent = `
      <h1>Maison Affluency — Curated Luxury Design &amp; Collectible Furniture</h1>
      <p>From Couture Furniture and Collectible Designs in situ, to the world's most distinguished Furniture Houses and Artisan Workshops. Based in Singapore's District 9.</p>

      <h2>Explore</h2>
      <nav>
        <ul>
          <li><a href="${SITE}/#gallery">Gallery — Curated interiors &amp; showroom</a></li>
          <li><a href="${SITE}/designers">Featured Designers &amp; Makers</a></li>
          <li><a href="${SITE}/journal">Journal — Design Insights</a></li>
          <li><a href="${SITE}/#collectibles">Collectible Design Pieces</a></li>
          <li><a href="${SITE}/#brands">Brands &amp; Ateliers</a></li>
          <li><a href="${SITE}/#contact">Contact &amp; Private Viewing</a></li>
        </ul>
      </nav>

      ${designers?.length ? `
        <h2>Featured Designers</h2>
        <ul>
          ${designers.map(d => `<li><a href="${SITE}/designers/${d.slug}">${esc(d.display_name || d.name)}</a> — ${esc(d.specialty || "")}</li>`).join("\n          ")}
        </ul>
      ` : ""}

      <h2>Contact</h2>
      <p>
        Email: <a href="mailto:concierge@myaffluency.com">concierge@myaffluency.com</a><br/>
        Phone: <a href="tel:+6591393850">+65 9139 3850</a><br/>
        Open Monday–Saturday, 10 AM – 7 PM
      </p>

      <p>&copy; 2026 Maison Affluency Pte Ltd. All rights reserved. Singapore.</p>`;

    jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "FurnitureStore",
      "name": "Maison Affluency",
      "description": description,
      "url": SITE,
      "telephone": "+6591393850",
      "email": "concierge@myaffluency.com",
      "address": {
        "@type": "PostalAddress",
        "addressCountry": "SG",
        "addressLocality": "Singapore"
      }
    });
  }

  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${esc(title)}</title>
    <meta name="description" content="${esc(description)}" />
    <link rel="canonical" href="${canonical}" />
    <link rel="icon" href="${SITE}/favicon.ico" sizes="any" />

    <meta property="og:type" content="website" />
    <meta property="og:locale" content="en_US" />
    <meta property="og:site_name" content="Maison Affluency" />
    <meta property="og:title" content="${esc(title)}" />
    <meta property="og:description" content="${esc(description)}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${ogImage}" />
    <meta property="og:image:secure_url" content="${ogImage}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${esc(title)}" />
    <meta name="twitter:description" content="${esc(description)}" />
    <meta name="twitter:image" content="${ogImage}" />

    ${jsonLd ? `<script type="application/ld+json">${jsonLd}</script>` : ""}
  </head>
  <body>
    <div style="max-width:960px;margin:0 auto;padding:40px 20px;font-family:'Lora',Georgia,serif;color:#222;line-height:1.6;">
      ${bodyContent}
    </div>
    <script>
      // Redirect human visitors to the SPA
      if(!/bot|crawl|spider|WhatsApp|facebookexternalhit|Twitterbot|LinkedInBot|Slackbot|TelegramBot|Pinterest|Googlebot|Bingbot|YandexBot|Baiduspider|DuckDuckBot/i.test(navigator.userAgent)){
        window.location.replace("${canonical}");
      }
    </script>
  </body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=86400",
      "X-Robots-Tag": "all",
    },
  });
});

function buildOgImage(imageUrl?: string, heroUrl?: string): string {
  const mainImg = imageUrl || "";
  const heroImg = heroUrl || "";
  const rawImage = mainImg.includes("cloudinary.com") ? mainImg
    : heroImg.includes("cloudinary.com") ? heroImg
    : heroImg || mainImg;

  if (rawImage.includes("cloudinary.com")) {
    return rawImage.replace(/\/upload\/[^/]*\//, "/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/");
  } else if (rawImage.startsWith("http")) {
    return `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1200,h_630,c_fill_pad,g_auto,b_auto,q_auto:best,f_jpg/${rawImage}`;
  }
  return "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,g_auto,q_auto:best,f_jpg/maison-affluency-og";
}
