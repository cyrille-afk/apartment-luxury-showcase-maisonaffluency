import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { SpecScheduleBlock } from "./SpecScheduleBlock";

const mockPdfInstance = {
  internal: {
    pageSize: {
      getWidth: () => 595,
      getHeight: () => 842,
    },
  },
  setFont: vi.fn(),
  setFontSize: vi.fn(),
  setTextColor: vi.fn(),
  setDrawColor: vi.fn(),
  text: vi.fn(),
  splitTextToSize: vi.fn((text: string) => [text]),
  line: vi.fn(),
  addPage: vi.fn(),
  output: vi.fn(() => new Blob([""], { type: "application/pdf" })),
  save: vi.fn(),
};

vi.mock("jspdf", () => ({
  jsPDF: vi.fn(() => mockPdfInstance),
}));

const markdown = `### SPECIFICATION SCHEDULE: Test Zone

**01 | Armchair**
- Designer: Test Designer
- Dimensions: 800 × 800 × 900 mm
`;

const STORAGE_KEY = "maison:spec-schedule:cover-prefs:v1";

describe("SpecScheduleBlock page size persistence", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob://mock-preview"),
      revokeObjectURL: vi.fn(),
    });
    vi.stubGlobal("open", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("restores saved page size from localStorage", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectName: "Project X", designerName: "Studio Y", coverDate: "2026-07-05", includeCover: true, pageSize: "letter" }),
    );

    render(<SpecScheduleBlock zone="Salon" markdown={markdown} />);
    fireEvent.click(screen.getByRole("button", { name: /preview pdf/i }));

    const letterButton = screen.getByRole("button", { name: /letter/i });
    expect(letterButton).toHaveAttribute("aria-pressed", "true");
  });

  it("saves page size changes to localStorage", async () => {
    render(<SpecScheduleBlock zone="Salon" markdown={markdown} />);
    fireEvent.click(screen.getByRole("button", { name: /preview pdf/i }));

    const a4Button = screen.getByRole("button", { name: /a4/i });
    fireEvent.click(a4Button);

    await waitFor(() => {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      expect(saved.pageSize).toBe("a4");
    });
  });

  it("reset button clears localStorage and restores defaults", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ projectName: "Project X", designerName: "Studio Y", coverDate: "2026-07-05", includeCover: false, pageSize: "letter" }),
    );

    render(<SpecScheduleBlock zone="Salon" markdown={markdown} />);
    fireEvent.click(screen.getByRole("button", { name: /preview pdf/i }));

    const letterButton = screen.getByRole("button", { name: /letter/i });
    expect(letterButton).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: /^reset$/i }));

    await waitFor(() => {
      expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    const a4Button = screen.getByRole("button", { name: /a4/i });
    expect(a4Button).toHaveAttribute("aria-pressed", "true");
  });

});
