import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import EyeLevelPlacementShell from "./EyeLevelPlacementShell";
import type { ProposalProduct } from "@/lib/proposalRenderDraft";
afterEach(cleanup);
it("keyboard movement and spatial instructions update only the selected product target", () => {
  function Fixture() {
    const [products, setProducts] = useState<ProposalProduct[]>([
      { id: "console", product_name: "Yoma CLW Console", brand_name: "Kerstens", image_url: "https://example.com/console.jpg", target: { x: 20, y: 65, instruction: "against solid left wall" } },
      { id: "table", product_name: "Coffee table", brand_name: "Man of Parts", image_url: "https://example.com/table.jpg", target: { x: 50, y: 75, instruction: "center living floor" } },
    ]);
    return <><EyeLevelPlacementShell url="https://example.com/empty.jpg" products={products} disabled={false} onTarget={(id, target) => { if (target) setProducts(previous => previous.map(piece => piece.id === id ? { ...piece, target } : piece)); }} /><output>{JSON.stringify(products.map(p => p.target))}</output></>;
  }
  render(<Fixture />);
  fireEvent.keyDown(screen.getByRole("slider", { name: "Pin 1: Yoma CLW Console" }), { key: "ArrowRight" });
  fireEvent.change(screen.getByRole("textbox", { name: "Pin 1: Yoma CLW Console" }), { target: { value: "flush against solid left wall, clear of kitchen" } });
  expect(JSON.parse(screen.getByRole("status").textContent ?? "[]")).toEqual([{ x: 21, y: 65, instruction: "flush against solid left wall, clear of kitchen" }, { x: 50, y: 75, instruction: "center living floor" }]);
});