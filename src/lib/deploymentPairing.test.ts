import { afterEach, describe, expect, it } from "vitest";
import { documentMatchesRelease, pairHtmlResponse, showReleaseRecovery } from "./deploymentPairing";

afterEach(() => {
  document.querySelector('meta[name="app-build-id"]')?.remove();
  document.getElementById("release-recovery")?.remove();
});
describe("deployment pairing", () => {
  it("accepts the page's matching client version even when a newer release exists", () => {
    const meta = document.createElement("meta");
    meta.name = "app-build-id"; meta.content = "release-A"; document.head.append(meta);
    expect(documentMatchesRelease(document, "release-A")).toBe(true);
    expect(documentMatchesRelease(document, "release-B")).toBe(false);
  });
  it("refuses missing document identity", () => {
    expect(documentMatchesRelease(document, "release-A")).toBe(false);
  });
  it("makes gallery HTML non-cacheable and stamps its own server release", async () => {
    const original = new Response("<html>release-A</html>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "public, max-age=31536000, immutable" } });
    const result = pairHtmlResponse(original, "release-A");
    expect(result.headers.get("cache-control")).toBe("no-store, no-cache, must-revalidate, max-age=0");
    expect(result.headers.get("cdn-cache-control")).toBe("no-store");
    expect(result.headers.get("cloudflare-cdn-cache-control")).toBe("no-store");
    expect(result.headers.get("x-app-build-id")).toBe("release-A");
    expect(await result.text()).toBe("<html>release-A</html>");
  });
  it("does not alter matching immutable image or javascript responses", () => {
    for (const type of ["image/jpeg", "text/javascript", "text/css", "application/json"]) {
      const original = new Response("asset", { headers: { "content-type": type, "cache-control": "public, max-age=31536000, immutable" } });
      expect(pairHtmlResponse(original, "release-A")).toBe(original);
    }
  });
  it("offers one manual recovery without replacing the document or triggering a reload", () => {
    const content = document.createElement("div");
    content.id = "saved-content"; document.body.append(content);
    showReleaseRecovery(document); showReleaseRecovery(document);
    expect(document.querySelectorAll("#release-recovery")).toHaveLength(1);
    expect(document.getElementById("saved-content")).toBe(content);
    const href = document.querySelector<HTMLAnchorElement>("#release-recovery a")?.href;
    expect(href && new URL(href).searchParams.has("release-refresh")).toBe(true);
    content.remove();
  });
});