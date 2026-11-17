import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StudioFinishControls } from "./StudioFinishControls";
import type { StudioFinishProduct } from "@/lib/studioFinishes";

const product: StudioFinishProduct = {
  name: "GUM armchair",
  variants: [],
  finishes: [{ id: "tundra", name: "Tundra 601", category: "Fabric", brand_name: "", material_type: null, color_family: null, image_url: null }],
};
const selection = { ids: { upholstery: "tundra" }, locked: false };

describe("Studio finish picker dismissal", () => {
  it("locks the selected finishes and closes the picker", async () => {
    const onChange = vi.fn();
    render(<StudioFinishControls compact product={product} selection={selection} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit finishes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Lock finish" }));
    expect(onChange).toHaveBeenCalledExactlyOnceWith({ ids: { upholstery: "tundra" }, locked: true });
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("closes with X without changing or locking finishes", async () => {
    const onChange = vi.fn();
    render(<StudioFinishControls compact product={product} selection={selection} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /Edit finishes/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close finish options" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(onChange).not.toHaveBeenCalled();
  });
});