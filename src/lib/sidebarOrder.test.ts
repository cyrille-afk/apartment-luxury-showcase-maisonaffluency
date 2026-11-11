import { describe, expect, it } from "vitest";
import { orderedSidebarItems, parseSidebarOrder, sidebarOrderKey, resetSidebarOrder, SIDEBAR_ORDER_EVENT } from "./sidebarOrder";

describe("sidebar ordering", () => {
  it("uses the saved section order and appends new sections without stale or duplicate IDs", () => {
    expect(orderedSidebarItems([{ id: "core" }, { id: "tools" }, { id: "projects" }], ["projects", "core", "core", "deleted"])).toEqual([{ id: "projects" }, { id: "core" }, { id: "tools" }]);
  });
  it("retains project and folder orders independently across serialization", () => {
    const value = { sections: ["projects", "core"], projects: ["hamptons", "singapore"], folders: { singapore: ["selection", "curated"] } };
    expect(parseSidebarOrder(JSON.stringify(value))).toEqual(value);
  });
  it("isolates users and safely rejects malformed saved orders", () => {
    expect(sidebarOrderKey("a")).not.toBe(sidebarOrderKey("b"));
    expect(parseSidebarOrder('{"projects":[1,"a","a"],"folders":{"p":[null,"b"]}}')).toEqual({ sections: [], projects: ["a"], folders: { p: ["b"] } });
    expect(parseSidebarOrder("broken").sections).toEqual(["core", "tools", "quotes", "projects"]);
  });
  it("resets only the requesting user's layout and announces it", () => {
    localStorage.setItem(sidebarOrderKey("a"), "custom");
    localStorage.setItem(sidebarOrderKey("b"), "other");
    let detail: unknown;
    const listener = (event: Event) => { detail = (event as CustomEvent).detail; };
    window.addEventListener(SIDEBAR_ORDER_EVENT, listener);
    resetSidebarOrder("a");
    expect(localStorage.getItem(sidebarOrderKey("a"))).toBeNull();
    expect(localStorage.getItem(sidebarOrderKey("b"))).toBe("other");
    expect(detail).toBe(sidebarOrderKey("a"));
    window.removeEventListener(SIDEBAR_ORDER_EVENT, listener);
    localStorage.removeItem(sidebarOrderKey("b"));
  });
});