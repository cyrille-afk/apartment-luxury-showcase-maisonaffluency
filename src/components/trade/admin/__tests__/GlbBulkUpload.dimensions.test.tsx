import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ measure: vi.fn(), upload: vi.fn(), prepare: vi.fn() }));
vi.mock("@/lib/glbUpload", async importOriginal => ({
  ...await importOriginal<typeof import("@/lib/glbUpload")>(),
  measureGlbDimensions: mocks.measure,
  uploadGlbForProduct: mocks.upload,
  prepareGlbFile: mocks.prepare,
}));
vi.mock("@/integrations/supabase/client", () => ({ supabase: {
  from: (table: string) => {
    const query = {
      select: () => query, eq: () => query, not: () => query, ilike: () => query, order: () => query,
      limit: async () => ({ data: [{ id: "lamp", brand_name: "Test Designer", product_name: "Lamp" }] }),
      then: (resolve: (value: unknown) => void) => resolve({ data: table === "trade_product_glb_variants" ? [] : [] }),
    };
    return query;
  },
} }));

import { GlbBulkUpload } from "../GlbBulkUpload";

describe("bulk upload dimension integrity", () => {
  it("saves filename height unchanged even with conflicting measurement and unit settings", async () => {
    mocks.measure.mockResolvedValue({ wCm: 300, dCm: 300, hCm: 300 });
    mocks.upload.mockResolvedValue(undefined);
    const file = new File(["model"], "lamp_95x77x75.obj");
    mocks.prepare.mockResolvedValue({ file, ext: "glb", originalFormat: "obj", originalFilenames: [file.name] });
    const { container } = render(<GlbBulkUpload />);
    await screen.findByRole("option", { name: "Test Designer" });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Test Designer" } });
    fireEvent.click(await screen.findByRole("checkbox"));
    const input = container.querySelector('input[type="file"]');
    if (!input) throw new Error("Missing file input");
    fireEvent.change(input, { target: { files: [file] } });
    fireEvent.change(screen.getByRole("combobox", { name: "Model source unit" }), { target: { value: "mm" } });
    fireEvent.click(screen.getByRole("button", { name: /^in$/ }));
    fireEvent.click(screen.getByRole("button", { name: /^Upload 1 model$/ }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ productId: "lamp", label: "W 95 × D 77 × H 75" })));
    expect(mocks.measure).not.toHaveBeenCalled();
  });
});