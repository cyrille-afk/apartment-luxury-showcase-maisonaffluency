import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { viewingRoomChoiceSchema } from "./viewingRoom";
import {
  buildBlenderSceneManifest,
  type BlenderCatalogLookup,
  type BlenderProductLookup,
  type BlenderSlotRuleLookup,
  type LockedProposalItemSnapshot,
} from "./viewingRoomBlenderScene";

const lockedSnapshotItemSchema = viewingRoomChoiceSchema.extend({
  slot_id: z.string().uuid().optional(),
  label: z.string().optional(),
});

const lockedSnapshotSchema = z.object({
  package: z.string(),
  currency: z.string(),
  total: z.number(),
  items: z.array(lockedSnapshotItemSchema),
});

export const exportViewingRoomBlenderScene = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ packageId: z.string().uuid(), requestKey: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Admin access required.");

    const { data: proposal, error: proposalError } = await context.supabase
      .from("viewing_room_proposal_requests")
      .select("id, package_id, snapshot, created_at")
      .eq("package_id", data.packageId)
      .eq("request_key", data.requestKey)
      .maybeSingle();
    if (proposalError || !proposal) throw new Error("Locked proposal not found.");

    const { data: pkg, error: pkgError } = await context.supabase
      .from("furniture_packages")
      .select("id, tier_name, residence_layout_id")
      .eq("id", proposal.package_id)
      .single();
    if (pkgError || !pkg) throw new Error("Furniture package not found.");

    const { data: layout, error: layoutError } = await context.supabase
      .from("residence_layouts")
      .select("name, floorplan_url")
      .eq("id", pkg.residence_layout_id)
      .single();
    if (layoutError || !layout) throw new Error("Residence layout not found.");

    const snapshot = lockedSnapshotSchema.parse(proposal.snapshot);
    const lockedItems: LockedProposalItemSnapshot[] = snapshot.items;
    const slotIds = [...new Set(lockedItems.map((item) => item.slot_id ?? item.id))];

    const { data: boardItems } = slotIds.length
      ? await context.supabase.from("client_board_items").select("id, product_id").in("id", slotIds)
      : { data: [] as Array<{ id: string; product_id: string }> };
    const boardItemProducts = new Map((boardItems ?? []).map((row) => [row.id, row.product_id]));

    const productIds = [
      ...new Set(
        lockedItems.map((item) => {
          const slotId = item.slot_id ?? item.id;
          return item.id !== slotId ? item.id : (boardItemProducts.get(slotId) ?? item.id);
        }),
      ),
    ];

    const [catalogRes, productsRes, rulesRes] = await Promise.all([
      productIds.length
        ? context.supabase
            .from("catalog_items")
            .select("id, sku, name, category_role, width_m, depth_m, height_m, glb_url_compressed")
            .in("id", productIds)
        : Promise.resolve({ data: [] as BlenderCatalogLookup[] }),
      productIds.length
        ? context.supabase
            .from("trade_products")
            .select("id, sku, product_name, category, subcategory, dimensions, width_mm, depth_mm, height_mm, glb_url")
            .in("id", productIds)
        : Promise.resolve({ data: [] as BlenderProductLookup[] }),
      slotIds.length
        ? context.supabase
            .from("hotspot_slot_rules")
            .select("board_item_id, category_role_override, width_m_override, depth_m_override, height_m_override")
            .eq("furniture_package_id", proposal.package_id)
            .in("board_item_id", slotIds)
        : Promise.resolve({ data: [] as BlenderSlotRuleLookup[] }),
    ]);

    return buildBlenderSceneManifest({
      proposalId: proposal.id,
      lockedAt: proposal.created_at,
      packageTier: snapshot.package || pkg.tier_name,
      layout: { name: layout.name, floorplan_url: layout.floorplan_url },
      items: lockedItems,
      boardItemProducts,
      catalogById: new Map((catalogRes.data ?? []).map((row) => [row.id, row])),
      productsById: new Map((productsRes.data ?? []).map((row) => [row.id, row])),
      slotRulesByBoardItemId: new Map(
        (rulesRes.data ?? [])
          .filter((row): row is BlenderSlotRuleLookup => Boolean(row.board_item_id))
          .map((row) => [row.board_item_id, row]),
      ),
    });
  });