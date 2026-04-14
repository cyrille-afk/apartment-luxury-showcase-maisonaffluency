import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { componentTagger } from "lovable-tagger";

/**
 * Convert render-blocking CSS <link> tags to non-blocking preloads.
 * The inline <style> block in index.html already covers critical styles,
 * so the full CSS bundle can load async without visible FOUC.
 */
function optimizeHtmlPlugin(): Plugin {
  return {
    name: "optimize-html",
    enforce: "post",
    transformIndexHtml(html) {
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

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    optimizeHtmlPlugin(),
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
}));
