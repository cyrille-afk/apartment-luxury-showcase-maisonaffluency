import { beforeEach, describe, expect, it, vi } from "vitest";
import { readSharedRoomLayout, sharedRoomKey, writeSharedRoomLayout, type SharedRoomLayout } from "../sharedRoomLayout";

const layout = (n: number, updatedAt: number): SharedRoomLayout => ({
  projectId: null, room: { width: 7.2, length: 6, height: 3.2 }, source: "curated", updatedAt, wallFinish: null, floorFinish: null,
  items: Array.from({ length: n }, (_, i) => ({ productId: `p${i}`, name: "P", glbUrl: "x.glb", x: i, z: 0, rotationY: 0, priceEur: 1 })),
} as SharedRoomLayout);

describe("curated → sandbox handoff", () => {
  beforeEach(() => { vi.restoreAllMocks(); localStorage.clear(); });
  it("never loads an older layout when storage is full", () => {
    localStorage.setItem(sharedRoomKey(null), JSON.stringify(layout(2, 1)));
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new DOMException("full", "QuotaExceededError"); });
    writeSharedRoomLayout(layout(11, 500));
    expect(readSharedRoomLayout(null, 500)?.items).toHaveLength(11);
  });
  it("rejects a stale stored layout whose stamp doesn't match", () => {
    localStorage.setItem(sharedRoomKey("proj-x"), JSON.stringify({ ...layout(2, 1), projectId: "proj-x" }));
    expect(readSharedRoomLayout("proj-x", 999)).toBeNull();
  });
});
