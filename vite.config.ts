import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";

/**
 * Convert render-blocking CSS <link> tags to non-blocking preloads.
 * The inline <style> block in index.html already covers critical styles,
 * so the full CSS bundle can load async without visible FOUC.
 */
function optimizeHtmlPlugin(buildId: string): Plugin {
  return {
    name: "optimize-html",
    enforce: "post",
    transformIndexHtml(html) {
      // 0. Inject cache-busting meta tags + build id so the browser always
      //    revalidates index.html and the app can detect new deployments.
      const metaInject =
        '<meta charset="UTF-8" />\n' +
        '    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate" />\n' +
        '    <meta http-equiv="Pragma" content="no-cache" />\n' +
        '    <meta http-equiv="Expires" content="0" />\n' +
        `    <meta name="app-build-id" content="${buildId}" />`;
      html = html.replace('<meta charset="UTF-8" />', metaInject);

      // 1. Normalise the CSS <link> so the critical-CSS pass (Beasties, see
      //    inlineCriticalCssPlugin below) can find it. Beasties inlines the
      //    above-the-fold rules into a <style> block and rewrites this tag
      //    into a non-blocking preload+swap, so no manual media="print"
      //    hack is needed any more.
      html = html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        '<link rel="stylesheet" href="$1">'
      );


      // 2. Promote modulepreload hints to the <head> top (before any scripts)
      //    so the browser starts fetching vendor chunks immediately
      const modulepreloads: string[] = [];
      html = html.replace(
        /<link rel="modulepreload" crossorigin href="(\/assets\/[^"]+)">/g,
        (_match, href) => {
          modulepreloads.push(href);
          return ''; // remove from original position
        }
      );
      if (modulepreloads.length > 0) {
        // Only modulepreload chunks required for first paint. Demote heavy
        // vendor chunks that are only reached from lazy routes/components
        // (motion, radix) to low-priority <link rel="prefetch"> so they
        // don't compete with the hero image or block the main thread
        // during boot. This is the single biggest mobile TBT win.
        // Demote ALL vendor chunks to prefetch. The homepage LCP element is
        // the static <picture> in index.html — it paints from pure HTML +
        // inline styles and does NOT need React to be loaded. Letting the
        // hero image win the bandwidth race on throttled PSI mobile runs
        // is worth ~200-400ms of LCP. React still loads (main entry imports
        // it) — just at lower priority so it doesn't compete with the LCP image.
        const DEFER = /(vendor-motion|vendor-radix|vendor-react|vendor-query)/;
        const eager = modulepreloads.filter(h => !DEFER.test(h));
        const deferred = modulepreloads.filter(h => DEFER.test(h));
        const hints = [
          ...eager.map(href => `<link rel="modulepreload" href="${href}">`),
          ...deferred.map(href => `<link rel="prefetch" as="script" href="${href}">`),
        ].join('\n    ');
        html = html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${hints}`);
      }

      return html;
    },
  };
}

/**
 * Inlines the above-the-fold CSS into dist/index.html and turns the full
 * stylesheet into a non-blocking preload+swap.
 *
 * Why: the Tailwind bundle is ~250KB raw (~38KB gz) and >90% unused on first
 * paint. On throttled mobile it cost ~1.1s on the critical path, which
 * delayed FCP/LCP. Beasties extracts only the rules whose selectors actually
 * match the server-sent HTML (hero <picture>, static SEO copy, layout shell)
 * and inlines them, so first paint needs zero CSS round-trips.
 *
 * Runs in closeBundle (after Vite has written dist/) so the emitted CSS file
 * is on disk for Beasties to read.
 */
function inlineCriticalCssPlugin(): Plugin {
  return {
    name: "inline-critical-css",
    apply: "build",
    enforce: "post",
    async closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const htmlPath = path.join(outDir, "index.html");
      if (!fs.existsSync(htmlPath)) return;

      const { default: Beasties } = await import("beasties");
      const beasties = new Beasties({
        path: outDir,
        publicPath: "/",
        // Inline rules matching the static HTML; everything else is deferred.
        pruneSource: false,
        // Keep the full sheet as a swap-on-load preload (non render-blocking).
        preload: "swap",
        inlineFonts: false,
        preloadFonts: false,
        // @font-face + keyframes already live in the inline <style> in index.html
        fonts: false,
        keyframes: "critical",
        compress: true,
        logLevel: "silent",
      });

      const html = fs.readFileSync(htmlPath, "utf-8");
      let out = await beasties.process(html);

      // Beasties' swap handler replaces rel=preload with rel=stylesheet on
      // load. Piggyback the app's `css-ready` flag onto the same handler so
      // components gated on it un-gate as soon as the real sheet applies.
      out = out.replace(
        /this\.rel=['"]stylesheet['"]/g,
        "this.rel='stylesheet';document.documentElement.classList.add('css-ready')"
      );

      fs.writeFileSync(htmlPath, out);
    },
  };
}



/**
 * Emits /version.json at the build root so the running app can poll it
 * and auto-reload when a fresh build is deployed.
 */
function emitVersionPlugin(buildId: string): Plugin {
  return {
    name: "emit-version",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "version.json",
        source: JSON.stringify({ buildId, builtAt: new Date().toISOString() }),
      });
    },
  };
}

/**
 * Regenerates public/og-manifest.json at build time so the post-deploy
 * Meta rescraper always knows about every OG bridge file (otherwise newly
 * added bridges would be invisible to it until someone bumps a baked list).
 *
 * The manifest is the list of every .html file under public/ that contains
 * a <meta property="og:image"> tag.
 */
function emitOgManifestPlugin(): Plugin {
  return {
    name: "emit-og-manifest",
    apply: "build",
    buildStart() {
      const publicDir = path.resolve(__dirname, "public");
      const ogTag = /<meta\s+property="og:image"\s+content=/i;
      const excludeNames = new Set(["index.html", "404.html"]);

      const out: string[] = [];
      const walk = (dir: string) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          const abs = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            walk(abs);
          } else if (entry.isFile() && entry.name.endsWith(".html") && !excludeNames.has(entry.name)) {
            const html = fs.readFileSync(abs, "utf-8");
            if (ogTag.test(html)) {
              out.push(path.relative(publicDir, abs).split(path.sep).join("/"));
            }
          }
        }
      };
      walk(publicDir);
      out.sort();
      fs.writeFileSync(
        path.join(publicDir, "og-manifest.json"),
        JSON.stringify(out, null, 2) + "\n",
      );
    },
  };
}

/**
 * Emit a real `/trade-program/index.html` app shell with Trade Program OG tags.
 * Social crawlers do not execute React/Helmet, so the generic SPA fallback can
 * only expose homepage metadata unless this route has its own static shell.
 */
function emitTradeProgramShellPlugin(): Plugin {
  return {
    name: "emit-trade-program-shell",
    apply: "build",
    enforce: "post",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const indexPath = path.join(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;

      const title = "Trade Program — Maison Affluency";
      const description = "Exclusive benefits for architects, interior designers, and luxury hospitality professionals.";
      const canonical = "https://www.maisonaffluency.com/trade-program";
      const image = "https://www.maisonaffluency.com/trade-program-hero-whatsapp.jpg";
      let html = fs.readFileSync(indexPath, "utf-8");

      html = html
        .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
        .replace("</title>", `</title>\n    <meta name="description" content="${description}">`)
        .replace(/<meta property="og:title" content="[^"]*">/i, `<meta property="og:title" content="${title}">`)
        .replace(/<meta property="og:description" content="[^"]*">/i, `<meta property="og:description" content="${description}">`)
        .replace(/<meta property="og:url" content="[^"]*">/i, `<meta property="og:url" content="${canonical}">`)
        .replace(
          /<meta property="og:image" content="[^"]*">/i,
          `<meta property="og:image" content="${image}">\n    <meta property="og:image:secure_url" content="${image}">\n    <meta property="og:image:type" content="image/jpeg">`,
        )
        .replace(/<meta name="twitter:title" content="[^"]*">/i, `<meta name="twitter:title" content="${title}">`)
        .replace(/<meta name="twitter:description" content="[^"]*">/i, `<meta name="twitter:description" content="${description}">`)
        .replace(/<meta name="twitter:image" content="[^"]*">/i, `<meta name="twitter:image" content="${image}">`)
        .replace("</head>", `    <link rel="canonical" href="${canonical}">\n  </head>`);

      const routeDir = path.join(outDir, "trade-program");
      fs.mkdirSync(routeDir, { recursive: true });
      fs.writeFileSync(path.join(routeDir, "index.html"), html);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    server: {
      host: "::",
      port: 8080,
      hmr: false,
      watch: {
        ignored: [
          "**/src/integrations/supabase/types.ts",
          "**/supabase/migrations/**",
        ],
      },
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      mcpPlugin(),
      optimizeHtmlPlugin(buildId),
      emitVersionPlugin(buildId),
      emitOgManifestPlugin(),
      inlineCriticalCssPlugin(),
      emitTradeProgramShellPlugin(),

    ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Bundle every lucide icon into one chunk. Otherwise each icon
          // ships as its own 500-1500 byte file and a mobile page opens
          // 15+ additional HTTP round-trips just for icons — the single
          // biggest source of "takes forever to load" on 4G/PWA.
          if (id.includes('node_modules/lucide-react/')) return 'vendor-icons';
          if (id.includes('node_modules/react-router')) return 'vendor-react';
          if (id.includes('node_modules/react-dom')) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
          if (id.includes('node_modules/framer-motion')) return 'vendor-motion';
          if (id.includes('node_modules/@tanstack/react-query')) return 'vendor-query';
          // Split @radix-ui per primitive so pages that don't use Dialog,
          // Popover, Select, etc. don't drag in the entire 170KB radix
          // bundle on first paint. Each primitive becomes its own small
          // chunk (~5-20KB) loaded on demand with the component that
          // consumes it. Directly cuts Lighthouse "Reduce unused JS".
          if (id.includes('node_modules/@radix-ui/')) {
            const m = id.match(/node_modules\/@radix-ui\/([^/]+)/);
            return m ? `vendor-radix-${m[1].replace(/^react-/, '')}` : 'vendor-radix';
          }
        },

      },
    },
    assetsInlineLimit: 1024,
    chunkSizeWarningLimit: 1500,
  },
  };
});
