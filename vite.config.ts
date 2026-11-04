// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { emitOgManifestPlugin, emitVersionPlugin, environmentRobotsPlugin } from "./vite.plugins";

// Pin the Worker compatibility date: nitro otherwise stamps the build date into
// dist/wrangler.json, which can be newer than the workerd binary wrangler ships
// and crashes `preview`/deploy with "newest date supported by this server binary".
// Must be >= 2025-09-15: earlier dates lack the node:fs module, so every page 500s.
process.env.COMPATIBILITY_DATE ||= "2025-09-15";

const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default defineConfig({
  // The pinned date predates default Node compatibility; the built server's
  // dependencies import node:fs, so explicitly enable the supported runtime.
  nitro: { cloudflare: { nodeCompat: true } },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
    client: { entry: "client" },
  },
  vite: {
    define: { "import.meta.env.VITE_APP_BUILD_ID": JSON.stringify(buildId) },
    plugins: [mcpPlugin(), emitVersionPlugin(buildId), emitOgManifestPlugin(), environmentRobotsPlugin()],
    server: {
      watch: { ignored: ["**/src/integrations/supabase/types.ts", "**/supabase/migrations/**"] },
    },
    // Pre-bundle deps discovered lazily on first SSR-hydrated visit; late discovery
    // forces a full-page reload that wipes open admin editors mid-entry.
    optimizeDeps: {
      include: ["@tanstack/router-core", "@tanstack/router-core/isServer", "@tanstack/router-core/ssr/client", "seroval"],
    },
    build: {
      chunkSizeWarningLimit: 1500,
      // Old and new page versions can never reference the same asset address.
      rollupOptions: {
        output: {
          entryFileNames: `assets/releases/${buildId}/[name]-[hash].js`,
          chunkFileNames: `assets/releases/${buildId}/[name]-[hash].js`,
          assetFileNames: `assets/releases/${buildId}/[name]-[hash][extname]`,
        },
      },
    },
  },
});
