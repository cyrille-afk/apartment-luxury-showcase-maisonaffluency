import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import CuratedPairings from "./CuratedPairings";

const pick = (id: string, title: string, designerName = "Other House") => ({ pick: { id, slug: id, image: `/${id}.jpg`, title }, designerName, designerId: "d" });
const catalogue = [
  pick("tassel", "Tassel 57 Pendant", "APPARATUS"),
  pick("frenchmen", "Frenchmen Street Lounge Chair", "Atelier X"),
  pick("sconce", "Dining Table", "APPARATUS"),
  pick("sconce2", "Round Dining Table"),
  pick("console", "Dining Sideboard"),
  pick("bowl", "Dining Room Rug"),
  pick("vase", "Hand-Woven Rug"),
  pick("pendant2", "Globe Pendant"),
  pick("floor", "Reading Floor Lamp"),
  pick("rug", "Living Room Rug"),
  pick("side", "Oak Side Table"),
  pick("floor2", "Brass Floor Lamp"),
  pick("rug2", "Wool Living Room Rug"),
];
const rule = (id: string, source_category: string, target_category: string, sort_order: number) => ({ id, source_category, target_category, preferred_pick_id: null, sort_order, enabled: true });
const rules = [
  rule("c1", "ceiling", "wall", 0), rule("c2", "ceiling", "tables", 1), rule("c3", "ceiling", "decor", 2),
  rule("s1", "seating", "ceiling", 0), rule("s2", "seating", "tables", 1), rule("s3", "seating", "decor", 2),
];

vi.mock("@/hooks/useDbCuratorPicks", () => ({ useDbCuratorPicks: () => ({ data: catalogue }) }));
vi.mock("@/hooks/useCuratedPairingRules", () => ({ useCuratedPairingRules: () => ({ data: rules }) }));
vi.mock("@/hooks/usePublicRrp", () => ({ usePublicRrpMap: () => ({ data: {} }), formatPublicRrpForDestination: () => null }));
vi.mock("@/lib/shippingDestination", () => ({ useShippingDestination: () => ({ currency: "USD" }) }));
vi.mock("./PairingConfigurationSheet", () => ({ default: ({ piece, onAdded, onClose }: { piece: { id: string }; onAdded: (piece: unknown) => void; onClose: () => void }) => <button onClick={() => { onAdded(piece); onClose(); }}>Confirm pairing addition</button> }));
vi.mock("framer-motion", async () => {
  const React = await import("react");
  const strip = ({ initial, animate, exit, transition, ...rest }: Record<string, unknown>) => rest;
  return { AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>, useReducedMotion: () => true,
    motion: { section: (p: Record<string, unknown>) => React.createElement("section", strip(p)) } };
});

const shown = () => within(screen.getByRole("region", { name: "Curated Pairings" })).getAllByRole("heading", { level: 3 }).map((h) => h.textContent);
const props = { open: true, onDismiss: () => {}, onExplore: () => {} };

describe("curated pairings follow the private client's first purchase", () => {
  it("a pendant first purchase gets dining furniture and a rug", () => {
    render(<CuratedPairings {...props} title="Tassel 57 Pendant" brand="APPARATUS" excludedIds={["tassel"]} />);
    expect(shown()).toEqual(["Dining Table", "Dining Sideboard", expect.stringMatching(/Dining Room Rug|Hand-Woven Rug/)]);
  });

  it("a lounge chair first purchase gets a living-room table, floor light and rug", () => {
    render(<CuratedPairings {...props} title="Frenchmen Street Lounge Chair" brand="Atelier X" excludedIds={["frenchmen"]} />);
    const chair = shown();
    expect(chair[0]).toBe("Oak Side Table");
    expect(chair[1]).toMatch(/Reading Floor Lamp|Brass Floor Lamp/);
    expect(chair[2]).toMatch(/Living Room Rug/);
    expect(chair).not.toContain("Dining Table");
  });

  it("updates when the client changes their selection", () => {
    const { rerender } = render(<CuratedPairings {...props} title="Tassel 57 Pendant" brand="APPARATUS" excludedIds={["tassel"]} />);
    const before = shown();
    rerender(<CuratedPairings {...props} title="Frenchmen Street Lounge Chair" brand="Atelier X" excludedIds={["frenchmen"]} />);
    expect(shown()).not.toEqual(before);
    expect(shown()).not.toContain("Frenchmen Street Lounge Chair");
  });

  it("drops a suggested piece once it is added to the basket and offers another", () => {
    const { rerender } = render(<CuratedPairings {...props} title="Tassel 57 Pendant" brand="APPARATUS" excludedIds={["tassel"]} />);
    expect(shown()[0]).toBe("Dining Table");
    rerender(<CuratedPairings {...props} title="Tassel 57 Pendant" brand="APPARATUS" excludedIds={["tassel", "sconce"]} />);
    expect(shown()).not.toContain("Dining Table");
    expect(shown()[0]).toBe("Round Dining Table");
  });

  it("refreshes the whole ensemble around the added pairing, excluding earlier suggestions and basket pieces", () => {
    render(<CuratedPairings {...props} title="Frenchmen Street Lounge Chair" brand="Atelier X" excludedIds={["frenchmen"]} />);
    const before = shown();
    fireEvent.click(screen.getByRole("button", { name: "Configure Oak Side Table" }));
    fireEvent.click(screen.getByRole("button", { name: "Confirm pairing addition" }));
    const after = shown();
    expect(after).toHaveLength(2);
    expect(after.every((name) => !before.includes(name))).toBe(true);
    expect(after).not.toContain("Frenchmen Street Lounge Chair");
    expect(after).not.toContain("Oak Side Table");
    expect(after[0]).toMatch(/Reading Floor Lamp|Brass Floor Lamp/);
    expect(after[1]).toMatch(/Living Room Rug/);
  });
});
