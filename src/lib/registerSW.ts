/**
 * Guarded service-worker registration. Only registers in production and only
 * outside Lovable preview/iframe/dev contexts. Everywhere else it actively
 * unregisters any existing /sw.js registration so previews stay clean.
 *
 * Enables offline image caching (Cloudinary + Supabase) via the generated
 * Workbox SW from vite-plugin-pwa. Do not register any other SW here.
 */
const SW_PATH = "/sw.js";

function isPreviewOrDev(): boolean {
  if (!import.meta.env.PROD) return true;
  if (typeof window === "undefined") return true;
  try {
    if (window.top !== window.self) return true;
  } catch {
    return true;
  }
  const host = window.location.hostname;
  if (host.startsWith("id-preview--") || host.startsWith("preview--")) return true;
  if (host === "lovableproject.com" || host.endsWith(".lovableproject.com")) return true;
  if (host === "lovableproject-dev.com" || host.endsWith(".lovableproject-dev.com")) return true;
  if (host === "beta.lovable.dev" || host.endsWith(".beta.lovable.dev")) return true;
  const params = new URLSearchParams(window.location.search);
  if (params.get("sw") === "off") return true;
  return false;
}

async function unregisterMatching(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  try {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs
        .filter((r) => {
          const url = r.active?.scriptURL || r.installing?.scriptURL || r.waiting?.scriptURL || "";
          return url.endsWith(SW_PATH);
        })
        .map((r) => r.unregister())
    );
  } catch {
    /* noop */
  }
}

export async function registerAppServiceWorker(): Promise<void> {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;

  if (isPreviewOrDev()) {
    await unregisterMatching();
    return;
  }

  try {
    await navigator.serviceWorker.register(SW_PATH, { scope: "/" });
  } catch {
    /* noop */
  }
}
