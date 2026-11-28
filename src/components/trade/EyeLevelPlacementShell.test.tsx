import { useState } from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import EyeLevelPlacementShell from "./EyeLevelPlacementShell";
import type { ProposalProduct } from "@/lib/proposalRenderDraft";
afterEach(cleanup);
it("clicking the room wall records the artwork centre without moving floor furniture", () => {
  const onTarget = vi.fn();
  render(<EyeLevelPlacementShell url="https://example.com/room.jpg" disabled={false} onTarget={onTarget} products={[
    { id: "art", product_name: "Wall artwork", brand_name: "Maker", image_url: "https://example.com/art.jpg", category_role: "artwork", width_m: 1.2, height_m: 0.8 },
    { id: "table", product_name: "Rift CTS", brand_name: "Maker", image_url: "https://example.com/table.jpg", target: { x: 50, y: 80, instruction: "" } },
  ]} />);
  const image = screen.getByRole("group", { name: "Furniture placement pins" });
  image.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1000, height: 500, right: 1000, bottom: 500, x: 0, y: 0, toJSON() {} });
  image.setPointerCapture = vi.fn();
  const event = new MouseEvent("pointerdown", { bubbles: true, clientX: 400, clientY: 150 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(image, event);
  expect(onTarget).toHaveBeenCalledExactlyOnceWith("art", { x: 40, y: 30, instruction: "" });
});
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