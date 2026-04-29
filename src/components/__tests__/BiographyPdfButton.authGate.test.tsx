/**
 * Auth-gate regression test for the biography PDF button.
 *
 * Requirement: biographies must only be downloadable by registered
 * (authenticated) users — same gating policy as every other PDF.
 *
 * This test verifies that:
 *  1. An anonymous click does NOT trigger PDF generation and DOES open
 *     the AuthGateDialog with a sensible action label.
 *  2. An authenticated click DOES trigger PDF generation.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const generateSpy = vi.fn(async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }));

vi.mock("@/lib/generateDesignerBiographyPdf", () => ({
  generateDesignerBiographyPdf: (...args: unknown[]) =>
    (generateSpy as (...a: unknown[]) => unknown)(...args),
  downloadBlob: vi.fn(),
}));

vi.mock("@/lib/trackDownload", () => ({ trackDownload: vi.fn() }));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));

// Auth state is controlled by this mutable holder so we can flip it per test.
const authState: { user: { id: string } | null; loading: boolean } = {
  user: null,
  loading: false,
};
vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

// Replace the dialog with a marker we can query by test-id.
vi.mock("@/components/AuthGateDialog", () => ({
  default: ({ open, action }: { open: boolean; action?: string }) =>
    open ? <div data-testid="auth-gate-open" data-action={action ?? ""} /> : null,
}));

import BiographyPdfButton from "@/components/BiographyPdfButton";

const baseProps = {
  designerName: "Thierry Lemaire",
  specialty: "Interior Designer",
  philosophy: "",
  biography: "Short bio.",
  biographyImages: [] as string[],
  heroImageUrl: null,
  profileUrl: "https://www.maisonaffluency.com/designers/thierry-lemaire",
};

describe("BiographyPdfButton — auth gate", () => {
  beforeEach(() => {
    generateSpy.mockClear();
    authState.user = null;
    authState.loading = false;
  });

  it("does NOT generate a PDF when the user is anonymous, and opens the auth gate instead", async () => {
    render(<BiographyPdfButton {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: /preview .* biography pdf before downloading/i }));

    // Gate appears
    const gate = await screen.findByTestId("auth-gate-open");
    expect(gate).toBeInTheDocument();
    // Action label mentions the designer
    expect(gate.getAttribute("data-action") ?? "").toMatch(/thierry lemaire/i);

    // PDF generator must NOT have been called
    expect(generateSpy).not.toHaveBeenCalled();
  });

  it("DOES generate a PDF when the user is authenticated", async () => {
    authState.user = { id: "user-1" };
    render(<BiographyPdfButton {...baseProps} />);

    fireEvent.click(screen.getByRole("button", { name: /preview .* biography pdf before downloading/i }));

    await waitFor(() => expect(generateSpy).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId("auth-gate-open")).not.toBeInTheDocument();
  });
});
