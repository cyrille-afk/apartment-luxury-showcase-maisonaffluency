import { describe, expect, it } from "vitest";
import { fitWithin, productReferenceSourceUrl } from "./productReferenceImages";
import { buildReferenceManifest, requireBrowserReferences, verifyReferenceManifest } from "../../supabase/functions/_shared/productReferenceManifest";

const jpeg = (tag: string) => `data:image/jpeg;base64,${btoa(tag)}`;

describe("product reference images", () => {
  it("resizes to at most 1024px on the long edge without upscaling", () => {
    expect(fitWithin(4000, 2000)).toEqual({ width: 1024, height: 512 });
    expect(fitWithin(600, 900)).toEqual({ width: 600, height: 900 });
  });

  it("replaces Cloudinary thumbnail sizes with a large source", () => {
    const url = productReferenceSourceUrl("https://res.cloudinary.com/x/image/upload/w_200,h_200,c_fill/v17/rift.jpg");
    expect(url).toBe("https://res.cloudinary.com/x/image/upload/c_limit,w_2048,h_2048,q_auto:best/v17/rift.jpg");
  });

  it("refuses a request where any piece lacks its prepared photo (no text-only fallback)", () => {
    expect(() => requireBrowserReferences([{ product_name: "Rift CTS", reference_image_data: jpeg("a") }, { product_name: "OUM Armchair" }])).toThrow(/OUM Armchair/);
    expect(() => requireBrowserReferences([{ product_name: "Rift CTS", reference_image_data: "https://example.com/a.jpg" }])).toThrow(/Rift CTS/);
  });

  it("numbers product references from 2 and verifies only exact matches", async () => {
    const sent = await buildReferenceManifest([{ id: "a", product_name: "Yoma CLW Console", reference_image_data: jpeg("yoma") }, { id: "b", product_name: "Rift CTS", reference_image_data: jpeg("rift") }]);
    expect(sent.map(e => e.reference)).toEqual([2, 3]);
    expect(verifyReferenceManifest(sent, sent)).toEqual([true, true]);
    expect(verifyReferenceManifest(sent, [sent[0], { ...sent[1]!, digest: "other" }])).toEqual([true, false]);
    expect(verifyReferenceManifest(sent, undefined)).toEqual([false, false]);
  });
});
