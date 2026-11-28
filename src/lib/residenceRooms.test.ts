import { beforeEach,expect,it,vi } from "vitest";
const mocks = vi.hoisted(() => ({ rpc: vi.fn(),from: vi.fn() }));
vi.mock("@tanstack/react-start",() => ({ createServerFn: () => { const b = { middleware: () => b,inputValidator: () => b,handler: (fn: unknown) => fn };return b; } }));
vi.mock("@/integrations/supabase/auth-middleware",() => ({ requireSupabaseAuth: {} }));
import { saveResidenceRoom,listResidenceRoomPackages,listMatchingResidenceRooms } from "./residenceRooms.functions";
type Handler = (args: { data: unknown;context: { supabase: typeof mocks;userId: string } }) => Promise<unknown>;
beforeEach(() => vi.resetAllMocks());
it("only admins can save package-specific room renders",async () => { mocks.rpc.mockResolvedValue({ data: false,error: null });await expect((saveResidenceRoom as unknown as Handler)({ data: {},context: { supabase: mocks,userId: "buyer" } })).rejects.toThrow("Admin access required");expect(mocks.from).not.toHaveBeenCalled(); });
it("only admins can list residence packages for saving views",async () => { mocks.rpc.mockResolvedValue({ data: false,error: null });await expect((listResidenceRoomPackages as unknown as Handler)({ data: {},context: { supabase: mocks,userId: "buyer" } })).rejects.toThrow("Admin access required");expect(mocks.from).not.toHaveBeenCalled(); });
function galleryContext(savedRoom = false) {
  const slot = { id: "11111111-1111-4111-8111-111111111111",product_name: "Rift CTS",brand_name: "Kerstens",category: "Tables",subcategory: null,image_url: null,dimensions: null,width_mm: null,depth_mm: null,height_mm: null,glb_url: null,lead_time: null,materials: {},retail_price: 1000,alternatives: [] };
  mocks.rpc.mockImplementation(async (name: string) => ({ data: name === "has_role" ? true : { items: [slot] },error: null }));
  const upsert = vi.fn();
  const update = vi.fn();
  const room = { id: "saved",residence_layout_id: "layout",room_type: "living_room",shell_url: "https://example.com/original-shell.png",placement_targets: { [slot.id]: { x: 22,y: 33,instruction: "original pin" } },slot_ids: [slot.id],selection_signature: JSON.stringify([{ slot_id: slot.id,product_id: slot.id,finish_key: null,size_key: null,colourway_id: null,axis_colours: {} }]) };
  mocks.from.mockImplementation((table: string) => {
    const result = { data: table === "furniture_packages" ? { moodboard_id: "board" } : table === "residence_layouts" ? { developer_project_id: "dev" } : table === "developer_projects" ? { access_token: "private" } : table === "client_board_items" ? [{ id: slot.id,product_id: "product" }] : savedRoom ? room : null,error: null };
    const mutation = { select: () => mutation,eq: () => mutation,single: async () => ({ data: { id: "saved" },error: null }) };
    const chain = { select: () => chain,eq: () => chain,single: async () => result,maybeSingle: async () => result,then: (fn: (value: typeof result) => unknown) => Promise.resolve(result).then(fn),update: (row: unknown) => { update(row);return mutation; },upsert: (row: unknown) => { upsert(row);return mutation; } };
    return chain;
  });
  const galleryViews = ["Front-Left","Front-Right","Back-Right","Back-Left"].map((label,i) => ({ label,url: `https://example.com/angle-${i}.png` }));
  const data = { layoutId: "layout",packageId: "package",roomName: "Living Room",roomType: "living_room",shellUrl: "https://example.com/shell.png",renderUrl: "https://example.com/angle-0.png",galleryViews,pieces: [{ product_id: "product",product_name: "Rift CTS",brand_name: "Kerstens",target: { x: 50,y: 60,instruction: "" } }] };
  return { data,upsert,update,room };
}
it("saves all four labeled angles in one package-specific write",async () => {
  const { data,upsert } = galleryContext();
  await (saveResidenceRoom as unknown as Handler)({ data,context: { supabase: mocks,userId: "admin" } });
  expect(upsert).toHaveBeenCalledTimes(1);
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ gallery_views: data.galleryViews,furniture_package_id: "package",room_name: "Living Room",slot_ids: ["11111111-1111-4111-8111-111111111111"] }));
});
it("refuses publishing angles for a piece outside the chosen package",async () => {
  const { data,upsert } = galleryContext();data.pieces[0] = { product_id: "unapproved",product_name: "Different table",brand_name: "Other",target: { x: 50,y: 60,instruction: "" } };
  await expect((saveResidenceRoom as unknown as Handler)({ data,context: { supabase: mocks,userId: "admin" } })).rejects.toThrow("Each room piece must match");
  expect(upsert).not.toHaveBeenCalled();
});
it("publishes four angles to the matching saved room without rewriting its shell, slots or pins",async () => {
  const { data,room,update,upsert } = galleryContext(true);
  await (saveResidenceRoom as unknown as Handler)({ data: { ...data,savedRoomId: room.id,expectedSignature: room.selection_signature },context: { supabase: mocks,userId: "admin" } });
  expect(update).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledWith({ gallery_views: data.galleryViews,render_url: data.renderUrl,updated_at: expect.any(String) });
  expect(upsert).not.toHaveBeenCalled();
});
it("refuses gallery publishing after the saved package signature changes",async () => {
  const { data,room,update,upsert } = galleryContext(true);
  await expect((saveResidenceRoom as unknown as Handler)({ data: { ...data,savedRoomId: room.id,expectedSignature: "older-package" },context: { supabase: mocks,userId: "admin" } })).rejects.toThrow("saved room changed");
  expect(update).not.toHaveBeenCalled();expect(upsert).not.toHaveBeenCalled();
});
it("matching saved room discovery requires admin access",async () => {
  mocks.rpc.mockResolvedValue({ data: false,error: null });
  await expect((listMatchingResidenceRooms as unknown as Handler)({ data: {},context: { supabase: mocks,userId: "buyer" } })).rejects.toThrow("Admin access required");
  expect(mocks.from).not.toHaveBeenCalled();
});
it("matches all saved room instances, including two chairs with the same catalogue identity",async () => {
  mocks.rpc.mockResolvedValue({ data: true,error: null });
  const room = { id: "room",residence_layout_id: "layout",furniture_package_id: "package",room_name: "Living Room",slot_ids: ["chair-1","chair-2"],selection_signature: "signature" };
  mocks.from.mockImplementation((table: string) => {
    const result = { data: table === "residence_room_renders" ? [room] : table === "client_board_items" ? [{ id: "chair-1",product_id: "gum" },{ id: "chair-2",product_id: "gum" }] : table === "residence_layouts" ? { name: "Bayfront" } : { tier_name: "Signature" },error: null };
    const chain = { select: () => chain,eq: () => chain,in: () => chain,single: async () => result,then: (fn: (value: typeof result) => unknown) => Promise.resolve(result).then(fn) };return chain;
  });
  const piece = { product_id: "gum",product_name: "GUM",brand_name: "Delcourt" };
  const call = (pieces: typeof piece[]) => (listMatchingResidenceRooms as unknown as Handler)({ data: { roomName: "Living Room",pieces },context: { supabase: mocks,userId: "admin" } });
  expect(await call([piece,piece])).toEqual([{ ...room,residence_name: "Bayfront",tier_name: "Signature" }]);
  expect(await call([piece])).toEqual([]);
  expect(await call([piece,{ ...piece,product_id: "other-chair" }])).toEqual([]);
});