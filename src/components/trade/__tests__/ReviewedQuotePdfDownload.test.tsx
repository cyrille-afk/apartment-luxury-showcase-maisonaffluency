import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ReviewedQuotePdfDownload from "../ReviewedQuotePdfDownload";
import type { QuotePdfArgs } from "@/lib/quotePdf";

const { build } = vi.hoisted(() => ({ build: vi.fn() }));
vi.mock("@/lib/quotePdf", () => ({ buildQuotePdf: build }));
const args = { quoteNumber: "QU-123", currency: "SGD", lines: [{ productName: "Ondas", quantity: 2, unitPriceCents: 1331493, lineTotalCents: 2662986 }] } as QuotePdfArgs;
afterEach(() => { cleanup(); vi.restoreAllMocks(); build.mockReset(); });

describe("Reviewed quote PDF export", () => {
  it("exports the exact reviewed prices and quantities without rebuilding editor data", async () => {
    const blob = new Blob(["%PDF-reviewed"], { type: "application/pdf" });
    build.mockResolvedValue({ output: () => blob });
    const validate = vi.fn().mockResolvedValue(true);
    const create = vi.fn().mockReturnValue("blob:reviewed");
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    Object.defineProperty(URL, "createObjectURL", { configurable: true, value: create });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ReviewedQuotePdfDownload args={args} validate={validate} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download client PDF" })).toBeEnabled());
    expect(validate).toHaveBeenCalledWith(args);
    expect(build).toHaveBeenCalledWith(args);
    expect(build.mock.calls[0][0].lines[0]).toMatchObject({ quantity: 2, unitPriceCents: 1331493, lineTotalCents: 2662986 });
    fireEvent.click(screen.getByRole("button", { name: "Download client PDF" }));
    expect(create).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
  });
  it("does not generate a document when the existing quote checks block export", async () => {
    render(<ReviewedQuotePdfDownload args={args} validate={async () => false} />);
    await screen.findByRole("alert");
    expect(build).not.toHaveBeenCalled();
  });
  it("discards an older prepared document when the reviewed snapshot changes", async () => {
    const oldBlob = new Blob(["old"]);
    build.mockResolvedValueOnce({ output: () => oldBlob }).mockImplementationOnce(() => new Promise(() => {}));
    const validate = async () => true;
    const { rerender } = render(<ReviewedQuotePdfDownload args={args} validate={validate} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Download client PDF" })).toBeEnabled());
    rerender(<ReviewedQuotePdfDownload args={{ ...args, currency: "EUR" }} validate={validate} />);
    expect(screen.getByRole("button", { name: "Preparing client PDF…" })).toBeDisabled();
  });
});