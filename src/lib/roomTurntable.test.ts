import { expect,it } from "vitest";
import { ROOM_CORNER_VIEWS,moveRoomRig,requireRoomTurntable,roomTurntablePrompt } from "../../supabase/functions/_shared/roomTurntable";
const zone = { x: 48,y: 60,width: 38,height: 38,room_type: "living_room" as const,room_name: "Living Room" };
it("defaults every one of the four corners to 8 degrees",() => { expect(ROOM_CORNER_VIEWS).toHaveLength(4);expect(ROOM_CORNER_VIEWS.map(v => v.elevation)).toEqual([8,8,8,8]); });
it("dragging moves only the room crop and keeps it inside the plan",() => { expect(moveRoomRig(zone,98,98)).toEqual({ ...zone,x: 62,y: 62 }); });
it("rejects full-apartment and non-four-corner requests",() => { expect(() => requireRoomTurntable({ ...zone,x: 0,y: 0,width: 100,height: 100 },ROOM_CORNER_VIEWS)).toThrow();expect(() => requireRoomTurntable(zone,ROOM_CORNER_VIEWS.slice(0,3))).toThrow(); });
it("accepts a living room crop with four eye-level cameras",() => { expect(() => requireRoomTurntable(zone,ROOM_CORNER_VIEWS)).not.toThrow(); });
it("rejects aerial cameras",() => { expect(() => roomTurntablePrompt(zone,ROOM_CORNER_VIEWS.map(v => ({ ...v,elevation: 30 })))).toThrow(); });