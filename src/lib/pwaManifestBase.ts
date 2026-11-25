/**
 * Typed copy of public/manifest.json for server-side use.
 *
 * Importing a file from `public/` into the JavaScript graph makes Vite warn
 * and re-process the asset on every change, which triggers unnecessary
 * preview reloads. Keep this constant in sync with public/manifest.json —
 * pwaLaunchManifest.test.ts asserts the two stay identical.
 */
export const pwaManifestBase = {
  name: "Maison Affluency Singapore",
  short_name: "Maison Affluency",
  description: "Curated luxury design & collectible furniture showcase",
  start_url: "/?source=pwa",
  scope: "/",
  id: "/",
  display: "standalone",
  display_override: ["standalone"],
  orientation: "portrait",
  background_color: "#ffffff",
  theme_color: "#ffffff",
  lang: "en-SG",
  dir: "ltr",
  categories: ["lifestyle", "shopping", "design"],
  icons: [
    { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png", purpose: "any" },
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
} as const;
