import manifest from "../../public/manifest.json";

/** Only the short-lived QR credential format is accepted; redemption validates it. */
export function isLaunchToken(token: string | null): token is string {
  return token !== null && /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function mobileManifestHref(pathname: string, search: string): string {
  if (pathname !== "/auth/sync") return "/manifest.json";
  const params = new URLSearchParams(search);
  const token = params.get("t") ?? params.get("token");
  return isLaunchToken(token) ? `/mobile-manifest.json?token=${encodeURIComponent(token)}` : "/manifest.json";
}

export function launchManifestResponse(request: Request): Response {
  const token = new URL(request.url).searchParams.get("token");
  const startUrl = isLaunchToken(token)
    ? `/?source=pwa&token=${encodeURIComponent(token)}`
    : manifest.start_url;
  return Response.json({ ...manifest, start_url: startUrl }, {
    headers: {
      "Content-Type": "application/manifest+json; charset=utf-8",
      "Cache-Control": "private, no-store, max-age=0",
      "Referrer-Policy": "no-referrer",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}

/** Call only in the installed container, before route children mount. */
export function takeLaunchToken(): string | null {
  if (typeof window === "undefined") return null;
  const url = new URL(window.location.href);
  const syncRoute = url.pathname === "/auth/sync";
  if (!syncRoute && (url.pathname !== "/" || url.searchParams.get("source") !== "pwa")) return null;
  const token = syncRoute ? url.searchParams.get("t") ?? url.searchParams.get("token") : url.searchParams.get("token");
  if (token === null) return null;
  url.searchParams.delete("token");
  if (syncRoute) url.searchParams.delete("t");
  window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  return isLaunchToken(token) ? token : null;
}