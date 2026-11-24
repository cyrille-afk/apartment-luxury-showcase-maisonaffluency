import { createServerFn } from "@tanstack/react-start";
import { setResponseHeader } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { viewingRoomChoiceSchema } from "./viewingRoom";
import {
  sharedViewingRoomProposalSchema,
  type VisualiserProposalItem,
  type VisualiserProposalPayload,
} from "./viewingRoomVisualiser";

const lockedSnapshotSchema = z.object({
  package: z.string(),
  currency: z.string(),
  total: z.number(),
  items: z.array(viewingRoomChoiceSchema.extend({ slot_id: z.string().uuid().optional() })),
});

const httpOrAssetUrl = z.string().trim().min(1).max(2048).refine(
  (v) => v.startsWith("https://") || v.startsWith("http://") || v.startsWith("/__l5e/"),
  "Invalid media URL",
);

function publicClient() {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  if (!key || !url) throw new Error("Viewing room proposal is temporarily unavailable.");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

export const getViewingRoomProposalForVisualiser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ proposalId: z.string().uuid() }))
  .handler(async ({ data, context }): Promise<VisualiserProposalPayload> => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Admin access required.");

    const { data: proposal, error: proposalError } = await context.supabase
      .from("viewing_room_proposal_requests")
      .select("id, package_id, snapshot, created_at, share_token, axonometric_render_url, walkthrough_url, walkthrough_layout_id, visualiser_published_at")
      .eq("id", data.proposalId)
      .maybeSingle();
    if (proposalError || !proposal) throw new Error("Locked proposal not found.");

    const { data: pkg, error: pkgError } = await context.supabase
      .from("furniture_packages")
      .select("id, tier_name, currency, residence_layout_id")
      .eq("id", proposal.package_id)
      .single();
    if (pkgError || !pkg) throw new Error("Furniture package not found.");

    const { data: layout, error: layoutError } = await context.supabase
      .from("residence_layouts")
      .select("id, name, floorplan_url, specs_label, developer_project_id")
      .eq("id", pkg.residence_layout_id)
      .single();
    if (layoutError || !layout) throw new Error("Residence layout not found.");

    const { data: developer, error: devError } = await context.supabase
      .from("developer_projects")
      .select("project_id, developer_name")
      .eq("id", layout.developer_project_id)
      .single();
    if (devError || !developer) throw new Error("Developer project not found.");

    const snapshot = lockedSnapshotSchema.parse(proposal.snapshot);
    const slotIds = [...new Set(snapshot.items.map((item) => item.slot_id ?? item.id))];
    const { data: boardItems } = slotIds.length
      ? await context.supabase.from("client_board_items").select("id, product_id").in("id", slotIds)
      : { data: [] as Array<{ id: string; product_id: string }> };
    const boardItemProducts = new Map((boardItems ?? []).map((row) => [row.id, row.product_id]));

    const productIds = [
      ...new Set(
        snapshot.items.map((item) => {
          const slotId = item.slot_id ?? item.id;
          return item.id !== slotId ? item.id : (boardItemProducts.get(slotId) ?? item.id);
        }),
      ),
    ];

    const [productsRes, catalogRes, glbRes] = await Promise.all([
      productIds.length
        ? context.supabase
            .from("trade_products")
            .select("id, brand_name, image_url, glb_url, dimensions, width_mm, depth_mm, height_mm")
            .in("id", productIds)
        : Promise.resolve({ data: [] as Array<{ id: string; brand_name: string | null; image_url: string | null; glb_url: string | null; dimensions: string | null; width_mm: number | null; depth_mm: number | null; height_mm: number | null }> }),
      productIds.length
        ? context.supabase
            .from("catalog_items")
            .select("id, width_m, depth_m, height_m, glb_url_compressed")
            .in("id", productIds)
        : Promise.resolve({ data: [] as Array<{ id: string; width_m: number; depth_m: number; height_m: number; glb_url_compressed: string }> }),
      productIds.length
        ? context.supabase
            .from("trade_product_glb_variants")
            .select("product_id, glb_url, material_roles, is_default")
            .in("product_id", productIds)
        : Promise.resolve({ data: [] as Array<{ product_id: string; glb_url: string; material_roles: unknown; is_default: boolean | null }> }),
    ]);

    const productById = new Map((productsRes.data ?? []).map((r) => [r.id, r]));
    const catalogById = new Map((catalogRes.data ?? []).map((r) => [r.id, r]));
    const rolesByProduct = new Map<string, Record<string, "fabric" | "backrest" | "base" | "top" | "ignore">>();
    for (const row of glbRes.data ?? []) {
      if (!row.material_roles || typeof row.material_roles !== "object") continue;
      if (row.is_default || !rolesByProduct.has(row.product_id)) {
        rolesByProduct.set(row.product_id, row.material_roles as Record<string, "fabric" | "backrest" | "base" | "top" | "ignore">);
      }
    }

    const items: VisualiserProposalItem[] = snapshot.items.map((item) => {
      const slotId = item.slot_id ?? item.id;
      const productId = item.id !== slotId ? item.id : (boardItemProducts.get(slotId) ?? item.id);
      const prod = productById.get(productId);
      const cat = catalogById.get(productId);
      const materialRoles = item.material_roles ?? rolesByProduct.get(productId);
      return {
        ...item,
        slot_id: slotId,
        product_id: productId,
        brand_name: item.brand_name ?? prod?.brand_name ?? null,
        image_url: item.image_url ?? prod?.image_url ?? null,
        glb_url: item.glb_url ?? cat?.glb_url_compressed ?? prod?.glb_url ?? null,
        dimensions: item.dimensions ?? prod?.dimensions ?? null,
        width_mm: item.width_mm ?? prod?.width_mm ?? (cat?.width_m ? Math.round(Number(cat.width_m) * 1000) : null),
        depth_mm: item.depth_mm ?? prod?.depth_mm ?? (cat?.depth_m ? Math.round(Number(cat.depth_m) * 1000) : null),
        height_mm: item.height_mm ?? prod?.height_mm ?? (cat?.height_m ? Math.round(Number(cat.height_m) * 1000) : null),
        ...(materialRoles ? { material_roles: materialRoles } : {}),
      };
    });

    return {
      proposalId: proposal.id,
      projectId: developer.project_id,
      developerName: developer.developer_name,
      tierName: snapshot.package || pkg.tier_name,
      currency: snapshot.currency || pkg.currency,
      total: snapshot.total,
      lockedAt: proposal.created_at,
      shareToken: proposal.share_token,
      axonometricRenderUrl: proposal.axonometric_render_url,
      walkthroughUrl: proposal.walkthrough_url,
      walkthroughLayoutId: proposal.walkthrough_layout_id,
      visualiserPublishedAt: proposal.visualiser_published_at,
      layout: {
        id: layout.id,
        name: layout.name,
        floorplan_url: layout.floorplan_url,
        specs_label: layout.specs_label,
      },
      items,
    };
  });

export const publishVisualiserToProposal = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z
      .object({
        proposalId: z.string().uuid(),
        axonometricRenderUrl: httpOrAssetUrl.optional(),
        walkthroughUrl: z.string().trim().url().max(2048).optional(),
        walkthroughLayoutId: z.string().uuid().optional(),
      })
      .refine((v) => Boolean(v.axonometricRenderUrl || v.walkthroughUrl), "Provide an axonometric render or walkthrough URL."),
  )
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Admin access required.");

    const now = new Date().toISOString();
    const patch: Database["public"]["Tables"]["viewing_room_proposal_requests"]["Update"] = {
      visualiser_published_at: now,
      visualiser_published_by: context.userId,
    };
    if (data.axonometricRenderUrl) patch.axonometric_render_url = data.axonometricRenderUrl;
    if (data.walkthroughUrl) patch.walkthrough_url = data.walkthroughUrl;
    if (data.walkthroughLayoutId) patch.walkthrough_layout_id = data.walkthroughLayoutId;

    const { data: updated, error } = await context.supabase
      .from("viewing_room_proposal_requests")
      .update(patch)
      .eq("id", data.proposalId)
      .select("id, share_token, axonometric_render_url, walkthrough_url, walkthrough_layout_id, visualiser_published_at")
      .single();
    if (error || !updated) throw new Error("Could not publish visuals to this proposal.");

    return {
      proposalId: updated.id,
      shareToken: updated.share_token,
      axonometricRenderUrl: updated.axonometric_render_url,
      walkthroughUrl: updated.walkthrough_url,
      walkthroughLayoutId: updated.walkthrough_layout_id,
      visualiserPublishedAt: updated.visualiser_published_at,
    };
  });

export const listLockedProposalsForDeveloper = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ developerProjectId: z.string().uuid() }))
  .handler(async ({ data, context }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { data: isAdmin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !isAdmin) throw new Error("Admin access required.");

    const { data: layouts } = await context.supabase
      .from("residence_layouts")
      .select("id, name")
      .eq("developer_project_id", data.developerProjectId);
    if (!layouts?.length) return [];
    const layoutNames = new Map(layouts.map((l) => [l.id, l.name]));

    const { data: packages } = await context.supabase
      .from("furniture_packages")
      .select("id, tier_name, currency, residence_layout_id")
      .in("residence_layout_id", layouts.map((l) => l.id));
    if (!packages?.length) return [];
    const pkgMap = new Map(packages.map((p) => [p.id, p]));

    const { data: rows, error } = await context.supabase
      .from("viewing_room_proposal_requests")
      .select("id, package_id, snapshot, created_at, share_token, axonometric_render_url, walkthrough_url, visualiser_published_at")
      .in("package_id", packages.map((p) => p.id))
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) throw new Error("Could not load locked proposals.");

    return (rows ?? []).map((row) => {
      const pkg = pkgMap.get(row.package_id);
      const snap = row.snapshot as { package?: string; currency?: string; total?: number; items?: unknown[] } | null;
      return {
        id: row.id,
        residenceName: (pkg ? layoutNames.get(pkg.residence_layout_id) : null) ?? "Residence",
        tierName: snap?.package ?? pkg?.tier_name ?? "Collection",
        currency: snap?.currency ?? pkg?.currency ?? "USD",
        total: Number(snap?.total ?? 0),
        itemCount: Array.isArray(snap?.items) ? snap.items.length : 0,
        createdAt: row.created_at,
        shareToken: row.share_token,
        axonometricRenderUrl: row.axonometric_render_url,
        walkthroughUrl: row.walkthrough_url,
        visualiserPublishedAt: row.visualiser_published_at,
      };
    });
  });

export const getSharedViewingRoomProposal = createServerFn({ method: "POST" })
  .inputValidator(z.object({ shareToken: z.string().min(16).max(128).regex(/^[a-zA-Z0-9_-]+$/) }))
  .handler(async ({ data }) => {
    setResponseHeader("Cache-Control", "private, no-store");
    const { data: result, error } = await publicClient().rpc("get_shared_viewing_room_proposal", {
      _share_token: data.shareToken,
    });
    if (error) throw new Error("Proposal could not be loaded.");
    return result ? sharedViewingRoomProposalSchema.parse(result) : null;
  });