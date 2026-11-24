import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import ViewingRoomAxisFinishes from "./ViewingRoomAxisFinishes";
import { viewingRoomSelection, type ViewingRoomSlot } from "@/lib/viewingRoom";

vi.mock("@/components/ui/select", async () => {
  const { createContext, useContext } = await import("react");
  const Context = createContext<(value: string) => void>(() => {});
  return {
    Select: ({ onValueChange, children }: any) => <Context.Provider value={onValueChange}>{children}</Context.Provider>,
    SelectItem: ({ value, children }: any) => { const pick = useContext(Context); return <button onClick={() => pick(value)}>{children}</button>; },
    SelectContent: ({ children }: any) => <div>{children}</div>, SelectGroup: ({ children }: any) => <div>{children}</div>,
    SelectLabel: ({ children }: any) => <span>{children}</span>, SelectTrigger: () => null, SelectValue: () => null,
  };
});
const material = (id: string) => ({ id, name: id, category: "", brand_name: "", image_url: null, material_type: null, color_family: null });
const slot = {
  id: "gum", product_name: "GUM", retail_price: 8000, materials: {}, size_options: [], is_swappable: false, allow_finish_customization: true, alternatives: [],
  finish_options: [
    { key: "edson", label: "Edson / Tundra / Oak", retail_price: 9000, materials: {}, axes: [
      { role: "seat", label: "Seat Upholstery", value: "Edson", colours: [material("Charbon"), material("Lin")] },
      { role: "backrest", label: "Backrest Upholstery", value: "Tundra leather", colours: [material("Tundra 600"), material("Tundra 603")] },
      { role: "frame", label: "Frame Finish", value: "Oak", colours: [material("Smooth"), material("Brushed")] },
    ] },
    { key: "terell", label: "Terell / Tundra / Oak", retail_price: 9500, materials: {}, axes: [
      { role: "seat", label: "Seat Upholstery", value: "Terell", colours: [material("Siena")] },
      { role: "backrest", label: "Backrest Upholstery", value: "Tundra leather", colours: [material("Tundra 600"), material("Tundra 603")] },
      { role: "frame", label: "Frame Finish", value: "Oak", colours: [material("Smooth"), material("Brushed")] },
    ] },
  ],
} as unknown as ViewingRoomSlot;
afterEach(cleanup);
it("changing the seat range retains the selected leather and frame and uses its approved price", () => {
  const draft = viewingRoomSelection(slot, "gum", "edson", undefined, undefined, { seat: "Charbon", backrest: "Tundra 603", frame: "Brushed" });
  const onChange = vi.fn();
  render(<ViewingRoomAxisFinishes slot={slot} draft={draft} disabled={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Siena" }));
  const changed = onChange.mock.calls[0]?.[0];
  expect(changed?.materials.upholstery.id).toBe("Siena");
  expect(changed?.materials.backrest.id).toBe("Tundra 603");
  expect(changed?.materials.base.id).toBe("Brushed");
  expect(changed?.retail_price).toBe(9500);
});
it("changing the leather backrest does not change the seat or frame", () => {
  const draft = viewingRoomSelection(slot, "gum", "edson", undefined, undefined, { seat: "Charbon", backrest: "Tundra 600", frame: "Brushed" });
  const onChange = vi.fn();
  render(<ViewingRoomAxisFinishes slot={slot} draft={draft} disabled={false} onChange={onChange} />);
  fireEvent.click(screen.getByRole("button", { name: "Tundra 603" }));
  const changed = onChange.mock.calls[0]?.[0];
  expect(changed?.axis_colours).toEqual({ seat: "Charbon", backrest: "Tundra 603", frame: "Brushed" });
  expect(changed?.retail_price).toBe(9000);
});