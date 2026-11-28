import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { viewingRoomSlotSchema } from "./viewingRoom";
import { visualizationChoices } from "./residenceVisualization";
import { roomSelectionKey, roomTypeSchema } from "./residenceRooms";
import { ROOM_CORNER_VIEWS } from "../../supabase/functions/_shared/roomTurntable";
import { validEyeLevelTarget } from "./proposalRenderDraft";

export const listResidenceRoomPackages = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ layoutId: z.string().uuid() })).handler(async ({ data,context }) => {
  const role = await context.supabase.rpc("has_role",{ _user_id: context.userId, _role: "admin" });
  if (role.error || !role.data) throw new Error("Admin access required.");
  const result = await context.supabase.from("furniture_packages").select("id,tier_name").eq("residence_layout_id",data.layoutId).order("sort_order");
  if (result.error) throw new Error("Packages couldn’t load.");
  return result.data;
});
const pieceSchema = z.object({ product_id: z.string().nullable().optional(), product_name: z.string(), brand_name: z.string(), target: z.object({ x: z.number(),y: z.number(),instruction: z.string() }).optional(), selected_finishes: z.array(z.object({ axis: z.string(),name: z.string() })).optional(), material_override: z.string().optional() });
export const listMatchingResidenceRooms = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ roomName: z.string().trim().min(1).max(120),pieces: z.array(pieceSchema).min(1).max(10) })).handler(async ({ data,context }) => {
  const role = await context.supabase.rpc("has_role",{ _user_id: context.userId,_role: "admin" });
  if (role.error || !role.data) throw new Error("Admin access required.");
  const rooms = await context.supabase.from("residence_room_renders").select("id,residence_layout_id,furniture_package_id,room_name,room_type,slot_ids,selection_signature").eq("room_name",data.roomName);
  if (rooms.error) throw new Error("Saved rooms couldn’t load.");
  const matches = await Promise.all(rooms.data.map(async room => {
    const [board,layout,pkg] = await Promise.all([
      context.supabase.from("client_board_items").select("id,product_id").in("id",room.slot_ids),
      context.supabase.from("residence_layouts").select("name").eq("id",room.residence_layout_id).single(),
      context.supabase.from("furniture_packages").select("tier_name").eq("id",room.furniture_package_id).single(),
    ]);
    if (board.error || layout.error || pkg.error) throw new Error("Saved room package couldn’t load.");
    const remaining = [...board.data];
    if (remaining.length !== data.pieces.length) return null;
    for (const piece of data.pieces) {
      const index = remaining.findIndex(slot => !!piece.product_id && slot.product_id === piece.product_id);
      if (index < 0) return null;
      remaining.splice(index,1);
    }
    return { ...room,residence_name: layout.data.name,tier_name: pkg.data.tier_name };
  }));
  return matches.filter((room): room is NonNullable<typeof room> => room !== null);
});
export const saveResidenceRoom = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).inputValidator(z.object({ layoutId: z.string().uuid(),packageId: z.string().uuid(),roomName: z.string().trim().min(1).max(120),roomType: roomTypeSchema,savedRoomId: z.string().uuid().optional(),expectedSignature: z.string().max(20000).optional(),shellUrl: z.string().url().startsWith("https://").max(4096).nullable(),galleryViews: z.array(z.object({ label: z.string(),url: z.string().url().startsWith("https://").max(4096) })).length(4).optional(),renderUrl: z.string().url().startsWith("https://").max(4096).nullable(),pieces: z.array(pieceSchema).min(1).max(10) })).handler(async ({ data,context }) => {
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
  const existing = await context.supabase.from("residence_room_renders").select("id,residence_layout_id,room_type,shell_url,placement_targets,slot_ids,selection_signature").eq("furniture_package_id",data.packageId).eq("room_name",data.roomName).maybeSingle();
  if (existing.error) throw new Error("The existing room could not load.");
  if (data.savedRoomId && (!existing.data || existing.data.id !== data.savedRoomId || existing.data.residence_layout_id !== data.layoutId || existing.data.room_type !== data.roomType || existing.data.selection_signature !== data.expectedSignature)) throw new Error("The saved room changed. Reload its matching package before publishing.");
  const shellUrl = data.shellUrl ?? existing.data?.shell_url;
  if (!shellUrl) throw new Error("Save an empty eye-level shell for this room first.");
  if (data.galleryViews && data.galleryViews.some((v,i) => v.label !== ROOM_CORNER_VIEWS[i]?.label)) throw new Error("Publish all four room corners in their original order.");
  const savedTargets = existing.data?.placement_targets as Record<string,{ x: number;y: number;instruction: string }> | undefined;
  const targets: Record<string,{ x: number;y: number;instruction: string }> = {};
  const slots = data.pieces.map(piece => {
    const exactId = board.data.find(row => row.product_id === piece.product_id && !targets[row.id] && (!data.savedRoomId || existing.data?.slot_ids.includes(row.id)))?.id;
    const matches = parsed.data.items.filter(slot => exactId ? slot.id === exactId : slot.product_name.toLowerCase() === piece.product_name.toLowerCase() && (!slot.brand_name || slot.brand_name.toLowerCase() === piece.brand_name.toLowerCase()));
    const slot = matches.length === 1 ? matches[0] : undefined;
    if (!slot || targets[slot.id]) throw new Error("Each room piece must match one distinct original piece in the selected package.");
    // Do not label a differently finished staged image as the package's default view.
    const approvedNames = Object.values(slot.materials).map(m => m.name.toLowerCase());
    if (data.renderUrl && (piece.material_override?.trim() || piece.selected_finishes?.some(f => !approvedNames.includes(f.name.toLowerCase())))) throw new Error("Save these finishes to the package first, or save the empty shell without a staged view.");
    const target = data.savedRoomId ? savedTargets?.[slot.id] : piece.target ?? savedTargets?.[slot.id];
    if (!validEyeLevelTarget(target)) throw new Error("Save placement pins for this room's package pieces first.");
    targets[slot.id] = target;
    return slot;
  });
  const signature = roomSelectionKey(visualizationChoices(slots,{}),slots.map(s => s.id));
  if (data.savedRoomId) {
    const room = existing.data;
    if (!room || !data.galleryViews || room.slot_ids.length !== slots.length || room.slot_ids.some(id => !targets[id]) || signature !== room.selection_signature) throw new Error("The gallery must match all saved room pieces and current package finishes. Regenerate it for this package.");
    // Updating only gallery fields preserves the saved shell, room, pins and slot order.
    const published = await context.supabase.from("residence_room_renders").update({ gallery_views: data.galleryViews,render_url: data.renderUrl,updated_at: new Date().toISOString() }).eq("id",room.id).eq("selection_signature",data.expectedSignature ?? "").select("id").single();
    if (published.error) throw new Error("The room changed or the gallery couldn’t be published. Reload and retry.");
    return { id: published.data.id };
  }
  const saved = await context.supabase.from("residence_room_renders").upsert({ residence_layout_id: data.layoutId,furniture_package_id: data.packageId,room_name: data.roomName,room_type: data.roomType,shell_url: shellUrl,render_url: data.renderUrl,gallery_views: data.galleryViews ?? [],slot_ids: slots.map(s => s.id),placement_targets: targets,selection_signature: signature,updated_at: new Date().toISOString() },{ onConflict: "furniture_package_id,room_name" }).select("id").single();
  if (saved.error) throw new Error("The room view couldn’t be saved. Please retry.");
  return { id: saved.data.id };
});