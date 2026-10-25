import { describe, expect, it } from "vitest";
import { auditAssetUrl, currentContentCheck, detectAuditMedia, type ContentTarget } from "./priceListContentPolicy";

const target: ContentTarget = { key: "public:assets/random.bin", kind: "public_file", bucket: "assets", path: "random.bin", url: null, label: "random.bin", revision: "new" };
describe("price list content audit", () => {
  it("inspects a PDF with an unrelated filename by its bytes", () => {
    expect(detectAuditMedia(new TextEncoder().encode("%PDF-1.7\nrandom content"))).toBe("application/pdf");
    expect(auditAssetUrl(target, "https://storage.example").pathname).toBe("/storage/v1/object/public/assets/random.bin");
  });
  it("recognizes cover image bytes regardless of filename", () => {
    expect(detectAuditMedia(new Uint8Array([255, 216, 255, 224]))).toBe("image/jpeg");
  });
  it("never treats unsupported bytes as a clean scan", () => {
    expect(detectAuditMedia(new TextEncoder().encode("unrecognized data"))).toBeNull();
  });
  it("invalidates a scan when the source changes", () => {
    expect(currentContentCheck(target, [{ target_key: target.key, revision: "old", kind: "public_file", verdict: "no_prices_detected", evidence: "", checked_at: "" }])).toBeUndefined();
  });
  it("refuses private or arbitrary cover hosts", () => {
    expect(() => auditAssetUrl({ ...target, kind: "cover", url: "https://127.0.0.1/private" }, "https://storage.example")).toThrow();
  });
});