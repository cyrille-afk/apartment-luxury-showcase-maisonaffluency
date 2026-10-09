import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, cleanup } from "@testing-library/react";
import SpecSheetButton from "../SpecSheetButton";

const mode = vi.hoisted(() => ({ clientSafe: false }));
vi.mock("@/lib/clientSafeMode", () => ({ useClientSafeMode: () => mode }));
vi.mock("@/lib/specSheetUrl", () => ({ buildSpecSheetUrl: () => "/verified-spec-sheet" }));
afterEach(() => { cleanup(); mode.clientSafe = false; vi.restoreAllMocks(); });

describe("Specification access in display modes", () => {
  it("does not offer a specification download in Presentation Mode", () => {
    mode.clientSafe = true;
    render(<SpecSheetButton variant="button" pdfUrl="https://www.maisonaffluency.com/spec.pdf" brandName="Maker" productName="Piece" />);
    expect(screen.queryByRole("button", { name: "Spec Sheet" })).toBeNull();
  });
  it("keeps specification downloads active in Studio Mode", () => {
    const open = vi.spyOn(window, "open").mockImplementation(() => null);
    render(<SpecSheetButton variant="button" pdfUrl="https://www.maisonaffluency.com/spec.pdf" brandName="Maker" productName="Piece" />);
    fireEvent.click(screen.getByRole("button", { name: "Spec Sheet" }));
    expect(open).toHaveBeenCalledWith("/verified-spec-sheet", "_blank");
  });
});