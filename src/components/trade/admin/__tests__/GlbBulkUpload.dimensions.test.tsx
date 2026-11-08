import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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

beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
afterEach(cleanup);

async function openPicker() {
  const view = render(<GlbBulkUpload />);
  await screen.findByRole("option", { name: "Test Designer" });
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "Test Designer" } });
  fireEvent.click(await screen.findByRole("checkbox"));
  const input = view.container.querySelector('input[type="file"]');
  if (!input) throw new Error("Missing file input");
  return { ...view, input };
}

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

  it("fills all existing models after one batch selection and measures future drops automatically", async () => {
    mocks.measure.mockResolvedValue({ wCm: 30, dCm: 30, hCm: 30 });
    const { input } = await openPicker();
    const first = new File(["model"], "lamp.glb");
    const second = new File(["model"], "lamp_other.glb");
    fireEvent.change(input, { target: { files: [first, second] } });
    expect(mocks.measure).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("combobox", { name: "Model source units for batch" }), { target: { value: "mm" } });
    await waitFor(() => expect(screen.getAllByRole("textbox", { name: "Variant label" }).map(el => (el as HTMLInputElement).value)).toEqual(["W 30 × D 30 × H 30", "W 30 × D 30 × H 30"]));
    expect(mocks.measure).toHaveBeenCalledWith(first, "mm");
    expect(mocks.measure).toHaveBeenCalledWith(second, "mm");
    const third = new File(["model"], "lamp_third.gltf");
    fireEvent.change(input, { target: { files: [third] } });
    await waitFor(() => expect(mocks.measure).toHaveBeenCalledWith(third, "mm"));
    expect(localStorage.getItem("ma-glb-source-unit")).toBe("mm");
  });

  it("restores the confirmed batch unit for automatic measurements on a later visit", async () => {
    localStorage.setItem("ma-glb-source-unit", "cm");
    mocks.measure.mockResolvedValue({ wCm: 95, dCm: 77, hCm: 75 });
    const { input } = await openPicker();
    const file = new File(["model"], "lamp.glb");
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Variant label" })).toHaveValue("W 95 × D 77 × H 75"));
    expect(mocks.measure).toHaveBeenCalledWith(file, "cm");
  });

  it("preserves manual and filename labels when applying batch units", async () => {
    const { input } = await openPicker();
    fireEvent.change(input, { target: { files: [new File(["model"], "lamp_95x77x75.glb"), new File(["model"], "lamp.glb")] } });
    fireEvent.change(screen.getAllByRole("textbox", { name: "Variant label" })[1], { target: { value: "Custom lamp" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Model source units for batch" }), { target: { value: "mm" } });
    expect(screen.getAllByRole("textbox", { name: "Variant label" }).map(el => (el as HTMLInputElement).value)).toEqual(["W 95 × D 77 × H 75", "Custom lamp"]);
    expect(mocks.measure).not.toHaveBeenCalled();
  });

  it("measures converted OBJ using the batch source units at upload", async () => {
    mocks.measure.mockResolvedValue({ wCm: 30, dCm: 30, hCm: 30 });
    mocks.upload.mockResolvedValue(undefined);
    const prepared = new File(["converted"], "lamp.glb");
    mocks.prepare.mockResolvedValue({ file: prepared, ext: "glb", originalFormat: "obj", originalFilenames: ["lamp.obj"] });
    const { input } = await openPicker();
    fireEvent.change(screen.getByRole("combobox", { name: "Model source units for batch" }), { target: { value: "mm" } });
    fireEvent.change(input, { target: { files: [new File(["model"], "lamp.obj")] } });
    fireEvent.click(screen.getByRole("button", { name: /^Upload 1 model$/ }));
    await waitFor(() => expect(mocks.upload).toHaveBeenCalledWith(expect.objectContaining({ label: "W 30 × D 30 × H 30" })));
    expect(mocks.measure).toHaveBeenCalledWith(prepared, "mm");
  });

  it("rejects stale measurements after source units change away and back", async () => {
    let resolveOld: ((value: { wCm: number; dCm: number; hCm: number }) => void) | undefined;
    mocks.measure.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
    mocks.measure.mockResolvedValue({ wCm: 30, dCm: 30, hCm: 30 });
    const { input } = await openPicker();
    fireEvent.change(input, { target: { files: [new File(["model"], "lamp.glb")] } });
    const batch = screen.getByRole("combobox", { name: "Model source units for batch" });
    fireEvent.change(batch, { target: { value: "mm" } });
    fireEvent.change(batch, { target: { value: "cm" } });
    fireEvent.change(batch, { target: { value: "mm" } });
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Variant label" })).toHaveValue("W 30 × D 30 × H 30"));
    resolveOld?.({ wCm: 300, dCm: 300, hCm: 300 });
    await waitFor(() => expect(mocks.measure).toHaveBeenCalledTimes(3));
    expect(screen.getByRole("textbox", { name: "Variant label" })).toHaveValue("W 30 × D 30 × H 30");
  });
});