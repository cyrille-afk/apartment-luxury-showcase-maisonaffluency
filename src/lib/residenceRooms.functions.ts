import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { viewingRoomSlotSchema } from "./viewingRoom";
import { visualizationChoices } from "./residenceVisualization";
import { roomSelectionKey, roomTypeSchema } from "./residenceRooms";
import { validEyeLevelTarget } from "./proposalRenderDraft";

export const listResidenceRoomPackages = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ layoutId: z.string().uuid() })).handler(async ({ data,context }) => {
  const role = await context.supabase.rpc("has_role",{ _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("Admin access required.");
  const result = await context.supabase.from("furniture_packages").select("id,tier_name").eq("residence_layout_id",data.layoutId).order("sort_order");
  if (result.error) throw new Error("Packages couldn’t load.");
  return result.data;
});
const pieceSchema = z.object({ product_id: z.string().nullable().optional(), product_name: z.string(), brand_name: z.string(), target: z.object({ x: z.number(),y: z.number(),instruction: z.string() }), selected_finishes: z.array(z.object({ axis: z.string(),name: z.string() })).optional(), material_override: z.string().optional() });
export const saveResidenceRoom = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ layoutId: z.string().uuid(),packageId: z.string().uuid(),roomName: z.string().trim().min(1).max(120),roomType: roomTypeSchema,shellUrl: z.string().url().startsWith("https://").max(4096),renderUrl: z.string().url().startsWith("https://").max(4096).nullable(),pieces: z.array(pieceSchema).min(1).max(10) })).handler(async ({ data,context }) => {
  const role = await context.supabase.rpc("has_role",{ _user_id: context.userId,_role: "admin" });
  if (role.error || !role.data) throw new Error("Admin access required.");
  const pkg = await context.supabase.from("furniture_packages").select("moodboard_id,residence_layout_id").eq("id",data.packageId).eq("residence_layout_id",data.layoutId).single();
  const layout = await context.supabase.from("residence_layouts").select("developer_project_id").eq("id",data.layoutId).single();
  if (pkg.error || layout.error) throw new Error("Choose a package from this residence.");
  const developer = await context.supabase.from("developer_projects").select("access_token").eq("id",layout.data.developer_project_id).single();
  if (developer.error || !developer.data.access_token) throw new Error("This residence is unavailable.");
  const personalization = await context.supabase.rpc("get_viewing_room_personalization",{ _token: developer.data.access_token,_package_id: data.packageId });
  const parsed = z.object({ items: z.array(viewingRoomSlotSchema) }).safeParse(personalization.data);
  if (personalization.error || !parsed.success) throw new Error("Package pieces couldn’t load.");
  const board = await context.supabase.from("client_board_items").select("id,product_id").eq("board_id",pkg.data.moodboard_id);
  if (board.error) throw new Error("Package pieces couldn’t load.");
  const targets: Record<string,{ x: number;y: number;instruction: string }> = {};
  const slots = data.pieces.map(piece => {
    if (!validEyeLevelTarget(piece.target)) throw new Error("Assign a valid placement pin to every room piece.");
    const exactId = board.data.find(row => row.product_id === piece.product_id)?.id;
    const matches = parsed.data.items.filter(slot => exactId ? slot.id === exactId : slot.product_name.toLowerCase() === piece.product_name.toLowerCase() && (!slot.brand_name || slot.brand_name.toLowerCase() === piece.brand_name.toLowerCase()));
    const slot = matches.length === 1 ? matches[0] : undefined;
    if (!slot || targets[slot.id]) throw new Error("Each room piece must match one distinct original piece in the selected package.");
    // Do not label a differently finished staged image as the package's default view.
    const approvedNames = Object.values(slot.materials).map(m => m.name.toLowerCase());
    if (data.renderUrl && (piece.material_override?.trim() || piece.selected_finishes?.some(f => !approvedNames.includes(f.name.toLowerCase())))) throw new Error("Save these finishes to the package first, or save the empty shell without a staged view.");
    targets[slot.id] = piece.target;
    return slot;
  });
  const signature = roomSelectionKey(visualizationChoices(slots,{}),slots.map(s => s.id));
  const saved = await context.supabase.from("residence_room_renders").upsert({ residence_layout_id: data.layoutId,furniture_package_id: data.packageId,room_name: data.roomName,room_type: data.roomType,shell_url: data.shellUrl,render_url: data.renderUrl,slot_ids: slots.map(s => s.id),placement_targets: targets,selection_signature: signature,updated_at: new Date().toISOString() },{ onConflict: "furniture_package_id,room_name" }).select("id").single();
  if (saved.error) throw new Error("The room view couldn’t be saved. Please retry.");
  return { id: saved.data.id };
});