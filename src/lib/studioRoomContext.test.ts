import { beforeEach, describe, expect, it } from "vitest";
import { readStudioRoomContext, saveStudioRoomContext } from "./studioRoomContext";
describe("Studio room handoff", () => {
  beforeEach(() => localStorage.clear());
  it("restores the selected room and exact target currency", () => {
    saveStudioRoomContext("user", "project", { roomType: "dining", currency: "SGD", targetCents: 2000000 });
    expect(readStudioRoomContext("user", "project", [])).toEqual({ roomType: "dining", currency: "SGD", targetCents: 2000000 });
  });
  it("recovers a matching Mood Board draft and its pinned Anchor without inventing a target", () => {
    localStorage.setItem("ma-mood-workspace-v1:user:standalone", JSON.stringify({ items: [{ id: "chair" }], settings: { roomType: "office", totalEur: null, anchors: ["chair"] } }));
    expect(readStudioRoomContext("user", "project", ["chair"])).toMatchObject({ targetCents: null, anchorId: "chair" });
    expect(readStudioRoomContext("user", "project", ["other"])).toBeNull();
  });
  it("retains the exact pinned product through the Project Studio context", () => {
    saveStudioRoomContext("user", "project", { roomType: "living", currency: "EUR", targetCents: null, anchorId: "sofa" });
    expect(readStudioRoomContext("user", "project", [])?.anchorId).toBe("sofa");
  });
  it("adds an old draft's pinned Anchor to an existing budget context", () => {
    saveStudioRoomContext("user", "project", { roomType: "living", currency: "EUR", targetCents: 500000 });
    localStorage.setItem("ma-mood-workspace-v1:user:project", JSON.stringify({ items: [{ id: "sofa" }], settings: { roomType: "dining", totalEur: 10, anchors: ["sofa"] } }));
    expect(readStudioRoomContext("user", "project", ["sofa"])).toMatchObject({ roomType: "living", targetCents: 500000, anchorId: "sofa" });
  });
});