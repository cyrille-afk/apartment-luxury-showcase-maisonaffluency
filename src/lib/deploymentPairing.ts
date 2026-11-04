/** Only compare the document with its own client release, not the newest deploy. */
export function documentMatchesRelease(doc: Document, buildId: string): boolean {
  const documentId = doc.querySelector('meta[name="app-build-id"]')?.getAttribute("content");
  return !!documentId && documentId === buildId;
}

/** Never cache rendered HTML, even when its URL resembles an image directory. */
export function pairHtmlResponse(response: Response, buildId: string): Response {
  if (!response.headers.get("content-type")?.toLowerCase().includes("text/html")) return response;
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Cloudflare-CDN-Cache-Control", "no-store");
  headers.set("X-App-Build-Id", buildId);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export const RELEASE_RECOVERY_STYLE = `
:root { --release-paper: #fafafa; --release-ink: #111; --release-border: #d1d5db; }
#release-recovery { position:fixed; inset:0; z-index:2147483647; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1rem; padding:2rem; background:var(--release-paper); color:var(--release-ink); font:16px/1.5 Georgia,serif; text-align:center; }
#release-recovery a { color:inherit; border:1px solid var(--release-border); padding:.75rem 1.5rem; text-decoration:none; font:14px/1.5 system-ui,sans-serif; }
`;

/** Pre-hydration only: do not mount a mismatched app over server-rendered content. */
export function showReleaseRecovery(doc: Document): void {
  if (doc.getElementById("release-recovery")) return;
  const panel = doc.createElement("main");
  panel.id = "release-recovery";
  panel.setAttribute("role", "alert");
  const title = doc.createElement("h1");
  title.textContent = "Maison Affluency";
  const message = doc.createElement("p");
  message.textContent = "This page needs a fresh copy. Please reopen it to continue.";
  const retry = doc.createElement("a");
  retry.textContent = "Reopen page";
  const url = new URL(doc.location.href);
  url.searchParams.set("release-refresh", String(Date.now()));
  retry.href = url.href;
  const style = doc.createElement("style");
  style.textContent = RELEASE_RECOVERY_STYLE;
  panel.append(style, title, message, retry);
  doc.body.append(panel);
}