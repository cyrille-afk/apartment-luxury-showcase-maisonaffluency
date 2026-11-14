import { beforeEach, describe, expect, it } from "vitest";
import { readStudioRoomContext, saveStudioRoomContext } from "./studioRoomContext";
describe("Studio room handoff", () => {
  beforeEach(() => localStorage.clear());
  it("restores the selected room and exact target currency", () => {
    saveStudioRoomContext("user", "project", { roomType: "dining", currency: "SGD", targetCents: 2000000 });
    expect(readStudioRoomContext("user", "project", [])).toEqual({ roomType: "dining", currency: "SGD", targetCents: 2000000 });
  });
  it("recovers matching old Mood Board drafts without inventing a target", () => {
    localStorage.setItem("ma-mood-workspace-v1:user:standalone", JSON.stringify({ items: [{ id: "chair" }], settings: { roomType: "office", totalEur: null } }));
    expect(readStudioRoomContext("user", "project", ["chair"])?.targetCents).toBeNull();
    expect(readStudioRoomContext("user", "project", ["other"])).toBeNull();
  });
});