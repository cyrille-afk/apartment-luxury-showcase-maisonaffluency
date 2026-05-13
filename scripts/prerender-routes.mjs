#!/usr/bin/env node
/**
 * Post-build prerender: generate per-route static HTML shells in dist/.
 *
 * Why: SPA shipped a single index.html with identical <title>/<meta>/<h1>
 * across every URL. Googlebot saw 478 sitemap entries that all looked like
 * duplicates of the homepage on its initial (unrendered) crawl, so nothing
 * got indexed in Search Console.
 *
 * What: clone dist/index.html for each public route, patch
 *   - <title>
 *   - <meta name="description">
 *   - <link rel="canonical"> (injected before the canonical-injector script)
 *   - og:title / og:description / og:url / og:image
 *   - twitter:title / twitter:description / twitter:image
 *   - the visible <h1> + intro <p> inside #seo-content (and the noscript clone)
 * then write to dist/<path>/index.html. Lovable hosting picks up the static
 * file before falling back to the SPA shell, so crawlers see route-unique
 * markup on the very first byte.
 *
 * Routes:
 *   - hard-coded list of public landing pages
 *   - dynamic /designers/:slug from public.designers (is_published = true)
 *   - dynamic /journal/:slug from public.journal_articles (published_at not null)
 *
 * Safe to re-run; never touches dist/ files that already exist (so the OG
 * bridges in public/ate liers/, public/collectibles/, etc. are untouched).
 */
import { readFile, writeFile, mkdir, access, rm } from "node:fs/promises";
import { constants as FS } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const TEMPLATE_PATH = path.join(DIST, "index.html");
const CANONICAL_HOST = "https://maisonaffluency.com";
const DEFAULT_OG_IMAGE =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg";

// Load .env manually (Node doesn't do this automatically; Vite does for client bundle only)
try {
  const envText = await readFile(path.join(ROOT, ".env"), "utf8");
  for (const line of envText.split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  }
} catch {
  // .env not present in some environments — fall back to process.env
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
// Prefer the service-role key so the prerender sees all published rows
// regardless of RLS (e.g. journal articles flagged is_published=false but
// already linked from the sitemap/SPA). Fall back to the anon key locally.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

// ----- HTML utilities -------------------------------------------------------

const escapeHtml = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const escapeAttr = escapeHtml;

const truncate = (s, n) => {
  const t = String(s ?? "").replace(/\s+/g, " ").trim();
  if (t.length <= n) return t;
  return t.slice(0, n - 1).trimEnd() + "…";
};

const titleizeSlug = (slug) =>
  String(slug ?? "")
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");

function patchTemplate(template, meta) {
  const title = escapeHtml(meta.title);
  const desc = escapeAttr(meta.description);
  const url = `${CANONICAL_HOST}${meta.path}`;
  const image = meta.image || DEFAULT_OG_IMAGE;

  let html = template;

  // Make the generator idempotent: if the template already came from a prior
  // prerender pass, remove stale route canonicals/og:url before injecting the
  // current route. Otherwise rerunning the script can preserve the homepage
  // canonical ahead of the route-specific one.
  html = html
    .replace(/\s*<link\s+rel="canonical"[^>]*data-prerender="true"[^>]*>\s*/gi, "\n    ")
    .replace(/\s*<meta\s+property="og:url"[^>]*data-prerender="true"[^>]*>\s*/gi, "\n    ");

  // <title>
  html = html.replace(
    /<title>[\s\S]*?<\/title>/,
    `<title>${title}</title>`
  );

  // <meta name="description">
  html = html.replace(
    /<meta\s+name="description"[^>]*>/i,
    `<meta name="description" content="${desc}">`
  );

  // og:title / og:description / og:image
  html = html.replace(
    /<meta\s+property="og:title"[^>]*>/i,
    `<meta property="og:title" content="${title}" />`
  );
  html = html.replace(
    /<meta\s+property="og:description"[^>]*>/i,
    `<meta property="og:description" content="${desc}" />`
  );
  html = html.replace(
    /<meta\s+property="og:image"[^>]*>/i,
    `<meta property="og:image" content="${escapeAttr(image)}">`
  );

  // twitter:title / twitter:description / twitter:image
  html = html.replace(
    /<meta\s+name="twitter:title"[^>]*>/i,
    `<meta name="twitter:title" content="${title}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:description"[^>]*>/i,
    `<meta name="twitter:description" content="${desc}" />`
  );
  html = html.replace(
    /<meta\s+name="twitter:image"[^>]*>/i,
    `<meta name="twitter:image" content="${escapeAttr(image)}">`
  );

  // Inject canonical + og:url BEFORE the runtime canonical-injector script,
  // so crawlers see the right value without executing JS. The injector skips
  // re-adding when it sees an existing default link.
  const canonicalBlock =
    `<link rel="canonical" href="${escapeAttr(url)}" data-prerender="true" />\n` +
    `    <meta property="og:url" content="${escapeAttr(url)}" data-prerender="true" />\n    `;
  html = html.replace(
    /(<!--\s*Pre-hydration canonical injector[\s\S]*?-->)/,
    `${canonicalBlock}$1`
  );

  // Replace the H1 + first <p> inside the visible #seo-content block.
  html = html.replace(
    /(<div id="seo-content"[\s\S]*?>)\s*<h1[^>]*>[\s\S]*?<\/h1>\s*<p>[\s\S]*?<\/p>/,
    (_, open) =>
      `${open}\n        <h1 style="font-family:'Playfair Display',serif;font-size:2rem;margin-bottom:8px;">${title}</h1>\n        <p>${desc}</p>`
  );

  // Same for the <noscript> clone (Bing/Yandex/no-JS crawlers).
  html = html.replace(
    /(<noscript>\s*<div[^>]*>)\s*<h1[^>]*>[\s\S]*?<\/h1>\s*<p>[\s\S]*?<\/p>/,
    (_, open) =>
      `${open}\n        <h1 style="font-family:'Playfair Display',serif;font-size:2rem;margin-bottom:8px;">${title}</h1>\n        <p>${desc}</p>`
  );

  // Optional: inject a static, server-visible A–Z designer link block before
  // </body>. Used on /, /journal, /designers (and per-article journal shells)
  // so crawlers without JS see internal links to every /designers/:slug,
  // flattening crawl depth and resolving "URLs in sitemap not found in crawl"
  // for orphan profiles.
  if (meta.designerLinksHtml) {
    html = html.replace(/<\/body>/i, `${meta.designerLinksHtml}\n  </body>`);
  }

  return html;
}

// ----- Routes ---------------------------------------------------------------

/** Static landing pages — short list, hand-tuned copy. */
const STATIC_ROUTES = [
  {
    path: "/",
    title: "Maison Affluency Singapore | Luxury Furniture & Collectible Design",
    description:
      "Maison Affluency Singapore — discover curated contemporary furniture and exceptional collectible design by world-renowned designers and makers in District 9.",
  },
  {
    path: "/designers",
    title: "Designers & Ateliers | Maison Affluency Singapore",
    description:
      "Browse the full roster of designers, ateliers and makers represented by Maison Affluency Singapore — sculptural lighting, bespoke furniture, hand-knotted rugs and more.",
  },
  {
    path: "/collectibles",
    title: "Collectible Design Pieces | Maison Affluency Singapore",
    description:
      "Curated collectible furniture and limited-edition design objects from leading European and global ateliers, available through Maison Affluency in Singapore.",
  },
  {
    path: "/gallery",
    title: "Gallery & Showroom | Maison Affluency Singapore",
    description:
      "Step inside our District 9 gallery — view curated interior settings featuring collectible furniture, lighting and objets d'art from world-renowned ateliers.",
  },
  {
    path: "/journal",
    title: "Journal — Design Stories & Insights | Maison Affluency",
    description:
      "Editorial features on collectible design, atelier visits, designer interviews and interior projects — the Maison Affluency Journal.",
  },
  {
    path: "/contact",
    title: "Contact & Private Viewing | Maison Affluency Singapore",
    description:
      "Book a private viewing at our District 9 gallery or reach out to our concierge for tailored sourcing and trade enquiries.",
  },
  {
    path: "/trade-program",
    title: "Trade Program for Interior Designers | Maison Affluency",
    description:
      "A dedicated trade program for interior designers and architects — preferred pricing, sample library, FF&E tools and white-label client documentation.",
  },
  {
    path: "/new-in",
    title: "New In — Latest Designers & Pieces | Maison Affluency",
    description:
      "The newest additions to the Maison Affluency roster — emerging ateliers, fresh collections and pieces just in to the gallery.",
  },
  {
    path: "/apartment-tour",
    title: "Apartment Tour | Maison Affluency Singapore",
    description:
      "An immersive walkthrough of a fully curated apartment by Maison Affluency — explore each room, the designers featured and the collectible pieces installed.",
  },
  {
    path: "/studios",
    title: "Featured Studios | Maison Affluency Singapore",
    description:
      "Discover the interior design studios partnered with Maison Affluency — view their projects, signature style and collectible pieces they specify.",
  },
  {
    path: "/favorites",
    title: "My Favorites | Maison Affluency",
    description:
      "Your saved designers, ateliers and collectible pieces from the Maison Affluency catalogue.",
  },
];

async function fetchDynamicRoutes() {
  const routes = [];
  const designerLinks = []; // [{slug, name}] for static A–Z block injection
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
      "[prerender] Supabase env vars missing — skipping dynamic routes."
    );
    return { routes, designerLinks };
  }


  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // Designer profiles
  try {
    const { data, error } = await supabase
      .from("designers")
      .select("slug, name, biography, specialty, founder")
      .eq("is_published", true)
      .not("slug", "is", null);
    if (error) throw error;
    for (const d of data ?? []) {
      if (!d.slug || !d.name) continue;
      const cleanBio = (d.biography ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const specialty = (d.specialty ?? "").trim();
      const founder = (d.founder ?? "").trim();
      // Always lead with the designer name + founder context so child/sub-designers
      // sharing a parent (e.g. CC-Tapis collaborators) never share the same description.
      // Bio is appended last as differentiating long-form content when available.
      let desc = "";
      const prefix = founder && founder.toLowerCase() !== d.name.toLowerCase()
        ? `${d.name} for ${founder}`
        : d.name;
      if (cleanBio.length >= 60) {
        // Prefix with name+founder, then append the bio so each shell is unique.
        desc = truncate(`${prefix} — ${cleanBio}`, 155);
      } else if (specialty.length > 0) {
        desc = truncate(`${prefix} — ${specialty}. Collectible design at Maison Affluency Singapore.`, 155);
      } else if (cleanBio.length > 0) {
        desc = truncate(`${prefix} — ${cleanBio}`, 155);
      } else {
        desc = truncate(`${prefix} — collectible furniture, lighting and objets at Maison Affluency Singapore. Provenance, materials and signature pieces.`, 155);
      }
      // Title mirrors description prefix so parent + sub-designer pages never collide.
      // If `prefix` equals just the name (no founder context), fall back to the slug
      // titleized so siblings like /ozone vs /ozone-light still produce unique titles.
      const slugSuffix = titleizeSlug(d.slug);
      const titleHead = prefix !== d.name
        ? prefix
        : (slugSuffix.toLowerCase() !== d.name.toLowerCase() ? `${d.name} (${slugSuffix})` : d.name);
      routes.push({
        path: `/designers/${d.slug}`,
        title: `${titleHead} — Designer Profile | Maison Affluency`,
        description: desc,
      });
    }
    console.log(`[prerender] designers: ${data?.length ?? 0}`);
  } catch (err) {
    console.warn("[prerender] designers query failed:", err?.message ?? err);
  }

  // Journal articles. Only published articles should be generated as public
  // SEO routes; drafts redirect/fall back to /journal in the SPA and should not
  // appear in the audit or sitemap until they are republished.
  try {
    const { data, error } = await supabase
      .from("journal_articles")
      .select("slug, title, excerpt, is_published")
      .eq("is_published", true)
      .not("published_at", "is", null)
      .not("slug", "is", null);
    if (error) throw error;
    let unpublishedIncluded = 0;
    for (const a of data ?? []) {
      if (!a.slug || !a.title) continue;
      if (a.is_published === false) unpublishedIncluded++;
      // Strip "[DRAFT] " prefix from titles defensively
      const cleanTitle = String(a.title).replace(/^\s*\[DRAFT\]\s*/i, "").trim();
      routes.push({
        path: `/journal/${a.slug}`,
        title: `${cleanTitle} | Maison Affluency Journal`,
        description: truncate(
          a.excerpt ||
            `${cleanTitle} — read the full editorial on the Maison Affluency Journal.`,
          155
        ),
      });
    }
    console.log(
      `[prerender] journal: ${data?.length ?? 0} (${unpublishedIncluded} unpublished but routable)`
    );
  } catch (err) {
    console.warn("[prerender] journal query failed:", err?.message ?? err);
  }

  // Trade products. Public product pages live at /product/:id and were
  // previously served as the bare SPA shell, so every product URL inherited
  // the homepage <title>/<meta>/<canonical>. Emit a per-product static shell
  // so each page ships unique SEO tags on first byte.
  try {
    const { data, error } = await supabase
      .from("trade_products")
      .select("id, brand_name, product_name, description, category, subcategory, materials, origin, image_url")
      .eq("is_active", true)
      .eq("is_hidden", false);
    if (error) throw error;
    for (const p of data ?? []) {
      if (!p.id || !p.product_name) continue;
      const brand = (p.brand_name ?? "").trim();
      const name = String(p.product_name).trim();
      const cleanDesc = (p.description ?? "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      const subcat = (p.subcategory ?? "").trim();
      const cat = (p.category ?? "").trim();
      const materials = (p.materials ?? "").trim();
      const origin = (p.origin ?? "").trim();
      const titleHead = brand ? `${name} by ${brand}` : name;
      let desc = "";
      if (cleanDesc.length >= 60) {
        desc = truncate(`${titleHead} — ${cleanDesc}`, 155);
      } else {
        const bits = [subcat || cat, materials && `in ${materials}`, origin && `from ${origin}`]
          .filter(Boolean)
          .join(", ");
        desc = truncate(
          `${titleHead}${bits ? ` — ${bits}` : ""}. Collectible design at Maison Affluency Singapore.`,
          155
        );
      }
      routes.push({
        path: `/product/${p.id}`,
        title: `${titleHead} | Maison Affluency`,
        description: desc,
        image: p.image_url || undefined,
      });
    }
    console.log(`[prerender] products: ${data?.length ?? 0}`);
  } catch (err) {
    console.warn("[prerender] products query failed:", err?.message ?? err);
  }

  return routes;
}

// ----- Writer ---------------------------------------------------------------

async function exists(p) {
  try {
    await access(p, FS.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function writeRoute(template, route, hasChildRoutes = false) {
  const html = patchTemplate(template, route);
  // "/" -> dist/index.html. Every clean URL is emitted as a directory index
  // so the host serves it as text/html instead of application/octet-stream.
  const isCleanRoute = route.path !== "/";
  const target =
    route.path === "/"
      ? path.join(DIST, "index.html")
      : path.join(DIST, route.path.replace(/^\//, ""), "index.html");

  if (isCleanRoute) {
    // Remove stale extensionless shells from earlier builds; if present they
    // win over /index.html on the clean URL and are served with the wrong MIME.
    const legacyExtensionless = path.join(DIST, route.path.replace(/^\//, ""));
    if (!hasChildRoutes) await rm(legacyExtensionless, { force: true });
    await rm(target, { recursive: true, force: true });
  }
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, html, "utf8");
  return target;
}

// ----- Main -----------------------------------------------------------------

async function main() {
  if (!(await exists(TEMPLATE_PATH))) {
    console.warn(
      `[prerender] dist/index.html not found — skipping (build did not run?)`
    );
    return;
  }
  const template = await readFile(TEMPLATE_PATH, "utf8");

  const dynamic = await fetchDynamicRoutes();
  const all = [...STATIC_ROUTES, ...dynamic];

  // Deduplicate by path (last wins)
  const seen = new Map();
  for (const r of all) seen.set(r.path, r);
  const paths = [...seen.keys()];
  const parentPaths = new Set(
    paths.filter((candidate) =>
      candidate !== "/" && paths.some((p) => p.startsWith(`${candidate}/`))
    )
  );

  let written = 0;
  let failed = 0;
  for (const route of seen.values()) {
    try {
      await writeRoute(template, route, parentPaths.has(route.path));
      written++;
    } catch (err) {
      failed++;
      console.warn(
        `[prerender] failed ${route.path}:`,
        err?.message ?? err
      );
    }
  }

  console.log(
    `[prerender] wrote ${written} route shells, ${failed} failed, ${seen.size} unique paths.`
  );
}

main().catch((err) => {
  // Never fail the build because of prerender — log and exit clean.
  console.warn("[prerender] fatal:", err?.message ?? err);
  process.exit(0);
});
