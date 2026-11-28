import { describe,expect,it } from "vitest";
import { validRoomZone,roomCropCamera } from "../../supabase/functions/_shared/roomZone";
import { roomSelectionKey,roomChoices } from "./residenceRooms";
import { restoreProposalRenderDraft } from "./proposalRenderDraft";
const zone = { x: 20,y: 30,width: 40,height: 50,room_type: "living_room" as const,room_name: "Living Room" };
describe("room-by-room rules",() => {
  it("passes camera coordinates relative only to the selected crop",() => { expect(roomCropCamera({ position: { x: 40,y: 65 },target: { x: 50,y: 40 } },zone)).toEqual({ position: { x: 50,y: 70 },target: { x: 75,y: 20 } }); });
  it("rejects camera or sightline outside the selected room",() => { expect(() => roomCropCamera({ position: { x: 10,y: 65 },target: { x: 50,y: 40 } },zone)).toThrow("inside the selected room"); });
  it("rejects out-of-image and empty room crops",() => { expect(validRoomZone({ ...zone,width: 90 })).toBe(false);expect(validRoomZone({ ...zone,height: 0 })).toBe(false);expect(validRoomZone({ ...zone,room_name: " " })).toBe(false); });
  it("restores the room crop without raw image bytes",() => { expect(restoreProposalRenderDraft({ sourceKey: "plan",roomZone: zone },"plan")?.roomZone).toEqual(zone); });
  it("filters exactly the assigned pieces without inferring room from product type",() => { expect(roomChoices([{ slot_id: "living",product_id: "console" },{ slot_id: "dining",product_id: "table" }],["living"])).toEqual([{ slot_id: "living",product_id: "console" }]); });
  it("a finish change in another room never invalidates this room",() => { const original = [{ slot_id: "living",product_id: "console" },{ slot_id: "dining",product_id: "table" }];expect(roomSelectionKey(original,["living"])).toBe(roomSelectionKey([original[0] ?? { slot_id: "living",product_id: "console" },{ slot_id: "dining",product_id: "table",finish_key: "new" }],["living"])); });
  it("a swap in this room invalidates its view",() => { expect(roomSelectionKey([{ slot_id: "living",product_id: "console" }],["living"])).not.toBe(roomSelectionKey([{ slot_id: "living",product_id: "alternative" }],["living"])); });
  it("a finish change in this room invalidates its view",() => { expect(roomSelectionKey([{ slot_id: "living",product_id: "console" }],["living"])).not.toBe(roomSelectionKey([{ slot_id: "living",product_id: "console",finish_key: "oak" }],["living"])); });
});