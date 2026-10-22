// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";
import { mcpPlugin } from "@lovable.dev/mcp-js/stacks/supabase/vite";
import { emitOgManifestPlugin, emitVersionPlugin, environmentRobotsPlugin } from "./vite.plugins";

const buildId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export default defineConfig({
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
    build: { chunkSizeWarningLimit: 1500 },
  },
});
