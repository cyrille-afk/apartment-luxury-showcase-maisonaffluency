import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import fs from "fs";
import { componentTagger } from "lovable-tagger";

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

      // 1. Convert render-blocking CSS to async preload
      html = html.replace(
        /<link rel="stylesheet" crossorigin href="(\/assets\/[^"]+\.css)">/g,
        '<link rel="preload" as="style" href="$1" onload="this.onload=null;this.rel=\'stylesheet\';document.documentElement.classList.add(\'css-ready\')">' +
        '<noscript><link rel="stylesheet" href="$1"></noscript>'
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
        const hints = modulepreloads
          .map(href => `<link rel="modulepreload" href="${href}">`)
          .join('\n    ');
        html = html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    ${hints}`);
      }

      return html;
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      optimizeHtmlPlugin(buildId),
      emitVersionPlugin(buildId),
      emitOgManifestPlugin(),
    ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-motion': ['framer-motion'],
          'vendor-query': ['@tanstack/react-query'],
          'vendor-radix': [
            '@radix-ui/react-accordion',
            '@radix-ui/react-dialog',
            '@radix-ui/react-popover',
          ],
        },
      },
    },
    assetsInlineLimit: 1024,
    chunkSizeWarningLimit: 1500,
  },
  };
});
