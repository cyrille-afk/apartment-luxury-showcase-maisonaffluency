import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ProposalPresentationSettings, type ProposalPresentation } from "./ProposalPresentationSettings";

const base: ProposalPresentation = {
  clientName: "Private Client",
  residenceName: "Residence 04 · Levels 62–78",
  packageName: "",
  roomLabel: "Living room",
  targetCents: 20000000,
  heroImage: null,
  floorPlanImage: null,
  roomImage: null,
  highlight: null,
};

describe("proposal presentation target allocation", () => {
  it("names the currency the figure is entered in", () => {
    render(<ProposalPresentationSettings value={base} onChange={vi.fn()} currency="SGD" />);
    expect(screen.getByText("Target allocation (SGD)")).toBeInTheDocument();
    expect(screen.getByLabelText("Target allocation in SGD")).toHaveValue(200000);
    expect(screen.getByText("S$")).toBeInTheDocument();
  });

  it("follows the euro base currency without inventing a symbol", () => {
    render(<ProposalPresentationSettings value={base} onChange={vi.fn()} currency="EUR" />);
    expect(screen.getByText("Target allocation (EUR)")).toBeInTheDocument();
    expect(screen.getByText("€")).toBeInTheDocument();
  });

  it("shows an unknown code rather than a blank prefix", () => {
    render(<ProposalPresentationSettings value={base} onChange={vi.fn()} currency="MYR" />);
    expect(screen.getByText("Target allocation (MYR)")).toBeInTheDocument();
    expect(screen.getByText("MYR")).toBeInTheDocument();
  });
});
