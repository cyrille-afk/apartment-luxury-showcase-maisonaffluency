import { supabase } from "@/integrations/supabase/client";
import { resolveStudioSelection, studioSelectedFinishes, type StudioFinishProduct } from "./studioFinishes";

export function studioDefaultBoardItem(productId: string, product: StudioFinishProduct) {
  const selected = studioSelectedFinishes(product, resolveStudioSelection(product, null));
  return {
    product_id: productId,
    wood_label: selected.find(s => s.key === "base")?.finish.name ?? null,
    fabric_label: selected.find(s => s.key === "upholstery")?.finish.name ?? null,
    variant_label: selected.filter(s => s.key !== "base" && s.key !== "upholstery").map(s => s.finish.name).join(" / ") || null,
  };
}

/** Save supplier defaults as existing board configuration labels; Studio resolves its real samples. */
export async function moodBoardStudioItems(ids: string[]) {
  const result: ReturnType<typeof studioDefaultBoardItem>[] = [];
  for (let start = 0; start < ids.length; start += 100) {
    const batch = ids.slice(start, start + 100);
    const { data: products, error } = await supabase.from("trade_products")
      .select("id,source_pick_id,product_name,size_variants,materials,base_axis_label,top_axis_label")
      .eq("is_active", true).eq("is_hidden", false).or(`id.in.(${batch.join(",")}),source_pick_id.in.(${batch.join(",")})`);
    if (error) throw error;
    const pickIds = [...new Set((products ?? []).map(p => p.source_pick_id || p.id))];
    const [picks, links] = await Promise.all([
      supabase.from("designer_curator_picks").select("id,size_variants,materials,base_axis_label,top_axis_label").in("id", pickIds),
      supabase.from("product_fabrics").select("pick_id,price_tier_label,image_indices,fabrics(id,name,supplier,category,image_url,is_active)").in("pick_id", pickIds).order("sort_order"),
    ]);
    if (picks.error || links.error) throw picks.error ?? links.error;
    for (const id of batch) {
      const product = products?.find(p => p.id === id) ?? products?.find(p => p.source_pick_id === id);
      if (!product) throw new Error("A selected piece is unavailable");
      const pickId = product.source_pick_id || product.id;
      const pick = picks.data?.find(p => p.id === pickId);
      result.push(studioDefaultBoardItem(product.id, {
        name: product.product_name, variants: (pick?.size_variants ?? product.size_variants ?? []) as StudioFinishProduct["variants"],
        materials: pick?.materials ?? product.materials,
        baseLabel: pick?.base_axis_label ?? product.base_axis_label, topLabel: pick?.top_axis_label ?? product.top_axis_label,
        finishes: (links.data ?? []).flatMap(link => {
          const finish = link.fabrics;
          return link.pick_id === pickId && finish?.is_active ? [{ id: finish.id, name: finish.name, brand_name: finish.supplier || "", category: finish.category || "Fabric", material_type: finish.category, color_family: null, image_url: finish.image_url, tier: link.price_tier_label, pictured: link.image_indices?.includes(1) }] : [];
        }),
      }));
    }
  }
  return result;
}