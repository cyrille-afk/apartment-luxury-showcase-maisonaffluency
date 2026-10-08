import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";
import type { LayoutBrief, LiveCatalogueItem } from "@/lib/mockAiLayoutService";

/** Client-safe product snapshot frozen at save time (public RRP only, never net trade). */
export interface LayoutProductSnapshot {
  componentId: string;
  name: string;
  price: number | null;
  availability: string;
  dimensions?: string | null;
}

export interface SavedLayout {
  id: string;
  title: string;
  brief: LayoutBrief;
  scene: AICuratedSceneSchema;
  share_token: string;
  is_shared: boolean;
  updated_at: string;
}

const statusLabel = (c?: LiveCatalogueItem) => {
  if (!c) return "Availability on request";
  if (!c.available) return "No longer available";
  const s = c.stockStatus ? c.stockStatus.replace(/_/g, " ").replace(/^./, (x) => x.toUpperCase()) : "Available";
  return c.leadWeeks ? `${s} · ${c.leadWeeks[0]}–${c.leadWeeks[1]} weeks` : s;
};

export const snapshotProducts = (scene: AICuratedSceneSchema, catalogue: LiveCatalogueItem[]): LayoutProductSnapshot[] => {
  const byId = new Map(catalogue.map((c) => [c.componentId, c]));
  return scene.curatedAssets.map((a) => {
    const c = byId.get(a.componentId);
    return { componentId: a.componentId, name: c?.name ?? a.sku, price: c?.price ?? (a.priceAtCuration || null), availability: statusLabel(c), dimensions: c?.dimensions ?? null };
  });
};

const COLS = "id, title, brief, scene, share_token, is_shared, updated_at";

export async function listLayouts(): Promise<SavedLayout[]> {
  const { data, error } = await supabase.from("ai_curated_layouts").select(COLS).order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as SavedLayout[];
}

export async function saveLayout(input: { id?: string; title: string; brief: LayoutBrief; scene: AICuratedSceneSchema; products: LayoutProductSnapshot[] }): Promise<SavedLayout> {
  const row = { title: input.title.trim().slice(0, 120) || "Untitled layout", brief: input.brief as unknown as Json, scene: input.scene as unknown as Json, products: input.products as unknown as Json };
  const q = input.id
    ? supabase.from("ai_curated_layouts").update(row).eq("id", input.id).select(COLS).single()
    : supabase.from("ai_curated_layouts").insert(row).select(COLS).single();
  const { data, error } = await q;
  if (error) throw error;
  return data as unknown as SavedLayout;
}

export async function setShared(id: string, isShared: boolean) {
  const { error } = await supabase.from("ai_curated_layouts").update({ is_shared: isShared }).eq("id", id);
  if (error) throw error;
}

export async function deleteLayout(id: string) {
  const { error } = await supabase.from("ai_curated_layouts").delete().eq("id", id);
  if (error) throw error;
}

export const shareUrl = (token: string) => `https://maisonaffluency.com/layout/${token}`;
