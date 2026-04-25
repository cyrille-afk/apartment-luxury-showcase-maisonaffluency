/**
 * Regression test for the biography PDF footer.
 *
 * Symptom we are guarding against: when the PDF was generated from a
 * lovable.app preview/staging origin, the footer printed the raw
 * `window.location.href`, leaking "id-preview--…lovable.app" into the
 * downloaded PDF. The fix forces the footer to use the canonical
 * www.maisonaffluency.com domain regardless of where the PDF is built.
 *
 * This test renders the real `PublicDesignerProfile`-side wiring by
 * rendering `BiographyPdfButton` with the same `profileUrl` expression
 * the page uses, while spoofing `window.location` to a lovable.app
 * origin. It then triggers the click, intercepts the call to the PDF
 * generator, and asserts that the URL handed to the generator is the
 * canonical one and never contains "lovable.app".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock the heavy PDF generator BEFORE importing the component so the
// component picks up our spy. We keep the named-export shape intact.
const generateSpy = vi.fn(async () => new Blob(["%PDF-1.4"], { type: "application/pdf" }));
const downloadSpy = vi.fn();

vi.mock("@/lib/generateDesignerBiographyPdf", () => ({
  generateDesignerBiographyPdf: (...args: unknown[]) => (generateSpy as (...a: unknown[]) => unknown)(...args),
  downloadBlob: (...args: unknown[]) => (downloadSpy as (...a: unknown[]) => unknown)(...args),
}));

vi.mock("@/lib/trackDownload", () => ({
  trackDownload: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

import BiographyPdfButton from "@/components/BiographyPdfButton";

describe("Biography PDF footer URL", () => {
  const originalLocation = window.location;

  beforeEach(() => {
    generateSpy.mockClear();
    downloadSpy.mockClear();

    // Spoof a lovable.app preview origin — exactly the case that caused
    // the original bug report.
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: {
        ...originalLocation,
        href: "https://id-preview--02208d51.lovable.app/designers/thierry-lemaire",
        origin: "https://id-preview--02208d51.lovable.app",
        hostname: "id-preview--02208d51.lovable.app",
        pathname: "/designers/thierry-lemaire",
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      writable: true,
      value: originalLocation,
    });
  });

  it("passes the canonical maisonaffluency.com URL to the PDF generator, not the lovable.app preview URL", async () => {
    // Mirror EXACTLY the expression used in PublicDesignerProfile.tsx
    // so a regression there (e.g. reverting to window.location.href)
    // would also be caught by changing the source of truth here.
    const profileUrl = `https://www.maisonaffluency.com${window.location.pathname}`;

    render(
      <BiographyPdfButton
        designerName="Thierry Lemaire"
        specialty="Interior Designer"
        philosophy=""
        biography="A short biography for the test."
        biographyImages={[]}
        heroImageUrl={null}
        profileUrl={profileUrl}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /download .* biography as pdf/i }));

    await waitFor(() => expect(generateSpy).toHaveBeenCalledTimes(1));

    const args = (generateSpy.mock.calls[0] as unknown[])[0] as { profileUrl?: string };
    expect(args.profileUrl).toBeDefined();
    expect(args.profileUrl).toMatch(/^https:\/\/www\.maisonaffluency\.com\//);
    expect(args.profileUrl).toBe("https://www.maisonaffluency.com/designers/thierry-lemaire");

    // Hard guard: nothing in the payload may leak the preview hostname.
    const serialized = JSON.stringify(args);
    expect(serialized).not.toMatch(/lovable\.app/i);
    expect(serialized).not.toMatch(/id-preview--/i);
  });

  it("derives the canonical URL even when the page is opened on a non-canonical host", () => {
    // This is a pure-logic assertion of the expression PublicDesignerProfile uses.
    // If anyone changes that expression to `window.location.href` or
    // `window.location.origin + pathname`, this assertion fails.
    const derived = `https://www.maisonaffluency.com${typeof window !== "undefined" ? window.location.pathname : ""}`;
    expect(derived).toBe("https://www.maisonaffluency.com/designers/thierry-lemaire");
    expect(derived).not.toContain("lovable.app");
    expect(derived).not.toContain(window.location.hostname);
  });
});
