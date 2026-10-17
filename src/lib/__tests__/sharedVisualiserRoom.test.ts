import { describe, expect, it } from "vitest";
import { sharedVisualiserRoom } from "../sharedVisualiserRoom";
const piece = { id: "11111111-1111-4111-8111-111111111111", instanceId: "one", product_name: "Chair", brand_name: "Maker", image_url: null, glb_url: null, dimensions: null, position: [1,0,2], rotation: [0,1,0], scale: 1 };
describe("Complete room sharing", () => {
  it("preserves every instance, its placement and the room finishes", () => {
    const room = sharedVisualiserRoom({ objects: [piece, {...piece,instanceId:"two",position:[3,0,4]}], rugWidth: 4, rugRotation: 90, featureWallFinish: "travertine" });
    expect(room.objects.map(o=>o.position)).toEqual([[1,0,2],[3,0,4]]);
    expect(room.rugWidth).toBe(4); expect(room.rugRotation).toBe(90); expect(room.featureWallFinish).toBe("travertine");
  });
  it("never includes prices, owner data or nested arbitrary material fields", () => {
    const room = sharedVisualiserRoom({ objects: [{...piece,trade_price_cents:123,topMaterial:{id:"oak",name:"Oak",brand_name:"Maker",category:"Wood",material_type:null,color_family:null,image_url:null,discount:15}}], user_id:"private",budget:10000 });
    expect(room).not.toHaveProperty("user_id");expect(room).not.toHaveProperty("budget");expect(room.objects[0]).not.toHaveProperty("trade_price_cents");expect(room.objects[0].topMaterial).not.toHaveProperty("discount");
  });
  it("rejects nonportable models and invalid placements",()=>{
    expect(()=>sharedVisualiserRoom({objects:[{...piece,glb_url:"blob:local"}]})).toThrow();
    expect(()=>sharedVisualiserRoom({objects:[{...piece,position:[Infinity,0,0]}]})).toThrow();
  });
  it("preserves model orientation and explicitly cleared part finishes",()=>{
    const room=sharedVisualiserRoom({objects:[{...piece,modelOrientation:[0,0,0,1],partMaterials:{frame:null,legacy:{}}}]});
    expect(room.objects[0].modelOrientation).toEqual([0,0,0,1]);
    expect(room.objects[0].partMaterials).toEqual({frame:null,legacy:null});
  });
  it("rejects unknown versions and duplicate instances",()=>{
    expect(()=>sharedVisualiserRoom({version:2,objects:[piece]})).toThrow();
    expect(()=>sharedVisualiserRoom({objects:[piece,piece]})).toThrow();
  });
});