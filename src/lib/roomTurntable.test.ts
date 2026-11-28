import { expect,it } from "vitest";
import { ROOM_MASTER_VIEWS,moveRoomRig,requireRoomTurntable,roomFurnitureCounts } from "../../supabase/functions/_shared/roomTurntable";
const zone = { x: 48,y: 60,width: 38,height: 38,room_type: "living_room" as const,room_name: "Living Room" };
it("uses exactly master, -25 and +25 degree shifts",() => { expect(ROOM_MASTER_VIEWS.map(v => v.azimuth)).toEqual([0,-25,25]); });
it("requires a verified master render",() => { expect(() => requireRoomTurntable(zone,ROOM_MASTER_VIEWS)).toThrow();expect(() => requireRoomTurntable(zone,ROOM_MASTER_VIEWS,"https://example.com/master.png",false)).toThrow();expect(() => requireRoomTurntable(zone,ROOM_MASTER_VIEWS,"https://example.com/master.png",true)).not.toThrow(); });
it("rejects reverse cameras",() => { expect(() => requireRoomTurntable(zone,ROOM_MASTER_VIEWS.map(v => ({ ...v,azimuth: 180 })),"master",true)).toThrow(); });
it("counts two armchair instances rather than adding a third",() => { expect(roomFurnitureCounts([{ product_name: "OUM Armchair" },{ product_name: "OUM Armchair" },{ product_name: "Rift CTS" },{ product_name: "Moco STS" },{ product_name: "Yoma CLW Console" }])).toEqual([{ name: "OUM Armchair",count: 2 },{ name: "Rift CTS",count: 1 },{ name: "Moco STS",count: 1 },{ name: "Yoma CLW Console",count: 1 }]); });
it("keeps crop movement bounded",() => { expect(moveRoomRig(zone,98,98)).toEqual({ ...zone,x: 62,y: 62 }); });
