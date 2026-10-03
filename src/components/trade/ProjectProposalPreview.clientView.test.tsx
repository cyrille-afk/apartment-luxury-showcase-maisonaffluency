import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProjectProposalPreview } from "./ProjectProposalPreview";

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children, open }: { children: React.ReactNode; open: boolean }) => open ? <div>{children}</div> : null,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("client proposal and print sheet", () => {
  const props = {
    open: true,
    onOpenChange: vi.fn(),
    projectName: "Living Room",
    clientName: "Private Client",
    location: "Singapore",
    items: [{ product_id: "1", name: "Clam Chair", designer: "SECRET SUPPLIER", image_url: null, sku: "FACTORY-SECRET-49", quantity: 1, rrp_cents: 864700 }],
    isClientMode: true,
    tradeDiscount: 0.1,
    markupMultiplier: 1.25,
    studio: { name: "Atelier Delval", logo_url: null },
    currency: "USD",
  };

  it("shows only client pricing and generic attribution when Client View is active", () => {
    const { container } = render(<ProjectProposalPreview {...props} />);
    const sheet = container.querySelector(".proposal-print-sheet");
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toMatch(/Curated Collection/);
    expect(sheet?.textContent).toMatch(/\$9,727\.88/);
    expect(sheet?.textContent).not.toMatch(/SECRET SUPPLIER|FACTORY-SECRET-49|\$7,782\.30|\$8,647|Trade \/ MSRP|Total Trade|tier|discount|margin/i);
    expect(screen.getByText("Clam Chair")).toBeInTheDocument();
  });
});