import { describe, expect, it } from "vitest";
import {
  GENERAL_ROOM,
  groupSpecItems,
  parseSpecRoomBudget,
  specRoomBudgetStatus,
  specRoomName,
  specRoomNames,
  sumSpecClientTotals,
  unpricedSpecItemCount,
  type SpecRoomItem,
} from "./specSheetRooms";

const item = (item_id: string, inherited_room: string | null, client_price_cents: number | null, quantity = 1, currency = "EUR"): SpecRoomItem => ({
  item_id, inherited_room, client_price_cents, quantity, currency,
});

describe("specification room organization", () => {
  it("inherits the project room, defaults to General, and lets an explicit assignment win", () => {
    const rooms = [{ id: "room-1", name: "Study", project_id: null, budget_cents: null, currency: "EUR", position: 0 }];
    expect(specRoomName(item("a", "Living / sofas", 100), [], [])).toBe("Living / sofas");
    expect(specRoomName(item("b", null, 100), [], [])).toBe(GENERAL_ROOM);
    expect(specRoomName(item("a", "Living / sofas", 100), [{ quote_item_id: "a", room_id: "room-1" }], rooms)).toBe("Study");
  });

  it("keeps empty custom rooms and groups items in editorial room order", () => {
    const rooms = [{ id: "room-1", name: "Library", project_id: null, budget_cents: null, currency: "EUR", position: 0 }];
    const items = [item("a", "Library", 100), item("b", "Living Room", 100)];
    const names = specRoomNames(items, rooms);
    expect(names).toEqual(["Living Room", "Library"]);
    expect(groupSpecItems(items, names, value => value.inherited_room || GENERAL_ROOM).map(group => [group.name, group.items.length])).toEqual([["Living Room", 1], ["Library", 1]]);
  });
});

describe("specification room client-price ledgers", () => {
  it("calculates room subtotal as quantity times client price", () => {
    expect(sumSpecClientTotals([item("a", null, 1250, 2), item("b", null, 500, 3)])).toEqual([{ currency: "EUR", cents: 4000 }]);
  });

  it("never adds different currencies into one subtotal", () => {
    expect(sumSpecClientTotals([item("a", null, 1250, 2), item("b", null, 700, 1, "USD")])).toEqual([
      { currency: "EUR", cents: 2500 }, { currency: "USD", cents: 700 },
    ]);
  });

  it("excludes unknown prices from money totals without treating them as zero-priced", () => {
    const items = [item("a", null, null), item("b", null, 900)];
    expect(sumSpecClientTotals(items)).toEqual([{ currency: "EUR", cents: 900 }]);
    expect(unpricedSpecItemCount(items)).toBe(1);
  });

  it("reports exact remaining and over-budget amounts", () => {
    const totals = [{ currency: "EUR", cents: 4000 }];
    expect(specRoomBudgetStatus(totals, 5500, "EUR")).toEqual({ kind: "remaining", cents: 1500 });
    expect(specRoomBudgetStatus(totals, 3000, "EUR")).toEqual({ kind: "over", cents: 1000 });
    expect(specRoomBudgetStatus(totals, 4000, "EUR")).toEqual({ kind: "remaining", cents: 0 });
  });

  it("does not compare a budget against a mixed-currency subtotal", () => {
    expect(specRoomBudgetStatus([{ currency: "EUR", cents: 4000 }, { currency: "USD", cents: 500 }], 5500, "EUR")).toBeNull();
  });
});

describe("room budget input", () => {
  it("parses decimal major units into exact cents and supports clearing", () => {
    expect(parseSpecRoomBudget("12,345.67")).toBe(1234567);
    expect(parseSpecRoomBudget(" ")).toBeNull();
    expect(parseSpecRoomBudget("not a number")).toBeUndefined();
  });
});
