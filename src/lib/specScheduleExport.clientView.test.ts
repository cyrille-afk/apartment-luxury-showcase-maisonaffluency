import { afterEach, describe, expect, it, vi } from "vitest";

const data = vi.hoisted(() => ({
  picks: [{ id: "pick-1", title: "Clam Chair", dimensions: "", width_mm: 700, depth_mm: 800, height_mm: 900, materials: "Oak", lead_time: "12 weeks", currency: "USD", brand_name: "SECRET SUPPLIER", sku: "FACTORY-SECRET-49" }],
  prices: [{ pick_id: "pick-1", trade_price_cents: 864700 }],
  materials: [{ pick_id: "pick-1", role: "base", material_taxonomy: { name: "Oak" } }],
  project: { name: "Living Room", client_name: "Private Client", location: "Singapore", location_city: null, trade_multiplier: 1.25 },
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => ({
        in: async () => ({ data: table === "designer_curator_picks" ? data.picks : table === "trade_product_pricing" ? data.prices : data.materials }),
        eq: () => ({ maybeSingle: async () => ({ data: data.project }) }),
      }),
    }),
    rpc: async () => ({ data: 0.10 }),
  },
}));

import { compileSpecSchedule, renderSpecSchedulePdf } from "./specScheduleExport";

afterEach(() => vi.restoreAllMocks());

describe("client-only specification schedule", () => {
  it("exports only the marked-up client amount and approved public-facing columns", async () => {
    const dataset = await compileSpecSchedule({
      picks: [{ pickId: "pick-1", qty: 2, room: "Lounge", finish: "Oak", leadWeeks: 12 }],
      projectId: "project-1",
      studio: { name: "Studio", display_name: "Atelier Delval", logo_url: null, default_project_markup_percentage: 40 },
    });
    expect(dataset.rows[0].clientPriceCents).toBe(972788);
    expect(dataset.profile.studioName).toBe("Atelier Delval");
    expect(JSON.stringify(dataset)).not.toMatch(/SECRET SUPPLIER|FACTORY-SECRET-49|778230|864700|tier|discount|trade_price|supplier|sku/i);

    let pdfBlob: Blob | undefined;
    vi.spyOn(URL, "createObjectURL").mockImplementation((blob) => {
      pdfBlob = blob as Blob;
      return "blob:test-schedule";
    });
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    await renderSpecSchedulePdf(dataset);
    expect(pdfBlob).toBeDefined();
    const { getDocument } = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const pdf = await getDocument({ data: new Uint8Array(await pdfBlob!.arrayBuffer()), useSystemFonts: true, disableFontFace: true }).promise;
    const texts: string[] = [];
    for (let n = 1; n <= pdf.numPages; n++) {
      const page = await pdf.getPage(n);
      texts.push((await page.getTextContent()).items.map((item) => "str" in item ? item.str : "").join(" "));
    }
    const visible = texts.join(" ");
    expect(visible).toContain("CLIENT PRICE");
    expect(visible).toContain("$9,727.88");
    expect(visible).toContain("$19,455.76");
    expect(visible).toContain("Atelier Delval");
    expect(visible).not.toMatch(/SECRET SUPPLIER|FACTORY-SECRET-49|\$7,782\.30|\$8,647|trade|wholesale|tier|discount|margin|supplier|factory|sku|maison affluency/i);
    await pdf.destroy();
  });
});