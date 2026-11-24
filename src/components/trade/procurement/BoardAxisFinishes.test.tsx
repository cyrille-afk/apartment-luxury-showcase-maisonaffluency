import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import BoardAxisFinishes, { boardAxisSelection, resolveBoardAxisSelection, type BoardAxisVariant } from "./BoardAxisFinishes";

const variants: BoardAxisVariant[] = [{ top: "Edson range", base: "Edson range", label: "Oak", price_cents: 825600, axes: [
  { role: "seat", label: "Seat Upholstery", value: "Edson range", colours: [{ name: "Edson Charbon", image_url: "seat.jpg" }, { name: "Edson Gris", image_url: "grey.jpg" }] },
  { role: "backrest", label: "Backrest Upholstery", value: "Edson range", colours: [{ name: "Edson Charbon", image_url: "seat.jpg" }, { name: "Edson Gris", image_url: "grey.jpg" }] },
  { role: "frame", label: "Frame Finish", value: "Oak", colours: [{ name: "Smooth Oak", image_url: "oak.jpg" }] },
] }];
afterEach(cleanup);
describe("independent client board finishes", () => {
  it("keeps seat, backrest and frame in the persisted request and restores their exact crops", () => {
    const variant = variants[0];
    if (!variant) throw new Error("Missing fixture");
    const result = boardAxisSelection(variant, { seat: { name: "Edson Charbon", image_url: "seat.jpg" }, backrest: { name: "Edson Gris", image_url: "grey.jpg" }, frame: { name: "Smooth Oak", image_url: "oak.jpg" } }, null);
    expect(result.label).toBe("Seat Upholstery: Edson Charbon · Backrest Upholstery: Edson Gris · Frame Finish: Smooth Oak");
    expect(resolveBoardAxisSelection(result.label, variants)).toEqual(result);
    expect(result.price_cents).toBe(825600);
  });
  it("shows each finish once: one dropdown per axis, no repeated swatch row", () => {
    render(<BoardAxisFinishes variants={variants} initial={null} onChange={vi.fn()} />);
    expect(screen.getAllByRole("combobox").map(c => c.getAttribute("aria-label"))).toEqual(["Seat Upholstery", "Backrest Upholstery", "Frame Finish"]);
    expect(screen.queryAllByRole("radiogroup")).toHaveLength(0);
    expect(screen.getAllByText("Edson Charbon")).toHaveLength(2);
  });
  it("never borrows a confirmed price for an unavailable three-part combination", () => {
    const result = resolveBoardAxisSelection("Seat Upholstery: Unknown · Backrest Upholstery: Edson Gris · Frame Finish: Smooth Oak", variants);
    expect(result?.price_cents).toBeNull();
  });
});