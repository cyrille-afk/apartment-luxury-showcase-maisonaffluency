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
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { constants as FS } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const TEMPLATE_PATH = path.join(DIST, "index.html");
const CANONICAL_HOST = "https://www.maisonaffluency.com";
const DEFAULT_OG_IMAGE =
  "https://res.cloudinary.com/dif1oamtj/image/upload/w_1200,h_630,c_fill,q_auto:best,f_jpg/v1772516480/WhatsApp_Image_2026-03-03_at_1.40.10_PM_cs23b7.jpg";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY =
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

function patchTemplate(template, meta) {
  const title = escapeHtml(meta.title);
  const desc = escapeAttr(meta.description);
  const url = `${CANONICAL_HOST}${meta.path}`;
  const image = meta.image || DEFAULT_OG_IMAGE;

  let html = template;

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
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.warn(
      "[prerender] Supabase env vars missing — skipping dynamic routes."
    );
    return routes;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false },
  });

  // Designer profiles
  try {
    const { data, error } = await supabase
      .from("designers")
      .select("slug, name")
      .eq("is_published", true)
      .not("slug", "is", null);
    if (error) throw error;
    for (const d of data ?? []) {
      if (!d.slug || !d.name) continue;
      routes.push({
        path: `/designers/${d.slug}`,
        title: `${d.name} — Designer Profile | Maison Affluency`,
        description: truncate(
          `Discover ${d.name}'s collectible furniture, lighting and objets at Maison Affluency Singapore. View signature pieces, materials and provenance.`,
          155
        ),
      });
    }
    console.log(`[prerender] designers: ${data?.length ?? 0}`);
  } catch (err) {
    console.warn("[prerender] designers query failed:", err?.message ?? err);
  }

  // Journal articles
  try {
    const { data, error } = await supabase
      .from("journal_articles")
      .select("slug, title, excerpt")
      .not("published_at", "is", null)
      .not("slug", "is", null);
    if (error) throw error;
    for (const a of data ?? []) {
      if (!a.slug || !a.title) continue;
      routes.push({
        path: `/journal/${a.slug}`,
        title: `${a.title} | Maison Affluency Journal`,
        description: truncate(
          a.excerpt ||
            `${a.title} — read the full editorial on the Maison Affluency Journal.`,
          155
        ),
      });
    }
    console.log(`[prerender] journal: ${data?.length ?? 0}`);
  } catch (err) {
    console.warn("[prerender] journal query failed:", err?.message ?? err);
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

async function writeRoute(template, route) {
  const html = patchTemplate(template, route);
  // "/" -> dist/index.html (overwrite the template itself with the patched
  // homepage version). Other routes -> dist/<path>/index.html.
  const target =
    route.path === "/"
      ? path.join(DIST, "index.html")
      : path.join(DIST, route.path.replace(/^\//, ""), "index.html");

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

  let written = 0;
  let failed = 0;
  for (const route of seen.values()) {
    try {
      await writeRoute(template, route);
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
