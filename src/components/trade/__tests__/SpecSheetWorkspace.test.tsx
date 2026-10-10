import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import SpecSheetWorkspace from "../SpecSheetWorkspace";
vi.mock("../InlineSpecSheetDocument", () => ({ default: () => null }));
const copy = vi.hoisted(() => vi.fn().mockResolvedValue(true));
vi.mock("@/lib/clipboard", () => ({ copyTextToClipboard: copy }));
const props = { brand: "Entrelacs", product: "BEAM Wall Lamp", sheetLabel: "Small", sheetIndex: 1, pdfUrl: "https://example.test/private.pdf?token=secret", loading: false, signedIn: true, isMobile: false, onSignIn: vi.fn(), onDownload: vi.fn().mockResolvedValue(undefined) };
describe("spec-sheet workspace actions", () => {
  it("shares the gated public address, never a signed PDF or development port", async () => {
    render(<MemoryRouter><SpecSheetWorkspace {...props} /></MemoryRouter>);
    fireEvent.click(screen.getByTitle("Share Spec Sheet Link"));
    await waitFor(() => expect(copy).toHaveBeenCalledWith("https://www.maisonaffluency.com/trade/spec-sheet?brand=Entrelacs&product=BEAM+Wall+Lamp&sheet=Small&sheetIndex=1&view=client"));
  });
  it("does not permit document actions without a signed-in user", () => {
    render(<MemoryRouter><SpecSheetWorkspace {...props} signedIn={false} /></MemoryRouter>);
    expect(screen.getByTitle("Download Document").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTitle("Print").hasAttribute("disabled")).toBe(true);
    expect(screen.getByTitle("Share Spec Sheet Link").hasAttribute("disabled")).toBe(true);
  });
});