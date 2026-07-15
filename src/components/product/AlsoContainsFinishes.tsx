import React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const FAMILY_LABEL: Record<string, string> = {
  metal: "Metal",
  wood: "Wood",
  fabric: "Fabric",
  glass: "Glass",
  stone: "Stone",
  leather: "Leather",
  composite: "Composite",
  ceramic: "Ceramic",
  other: "Other",
};

interface Props {
  pickId?: string | null;
  productId?: string | null;
  className?: string;
}

/**
 * Renders a compact "Also contains: Wood, Brass" line listing non-primary
 * material families linked to a pick or trade product. Used on product pages
 * so substrate / accent finishes are still surfaced without inflating the
 * primary-finish facet filter.
 */
const AlsoContainsFinishes: React.FC<Props> = ({ pickId, productId, className }) => {
  const { data } = useQuery({
    queryKey: ["also-contains-finishes", pickId || null, productId || null],
    enabled: !!(pickId || productId),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      let query = supabase
        .from("product_material_links")
        .select("role, material_taxonomy:material_id(family, is_active)")
        .neq("role", "primary");
      if (pickId && productId) {
        query = query.or(`pick_id.eq.${pickId},product_id.eq.${productId}`);
      } else if (pickId) {
        query = query.eq("pick_id", pickId);
      } else if (productId) {
        query = query.eq("product_id", productId);
      }
      const { data, error } = await query;
      if (error) throw error;
      const families = new Set<string>();
      for (const row of (data || []) as any[]) {
        const family: string | null = row?.material_taxonomy?.family ?? null;
        const active: boolean = row?.material_taxonomy?.is_active ?? false;
        if (family && active) families.add(family);
      }
      return Array.from(families);
    },
  });

  if (!data || data.length === 0) return null;

  const labels = data
    .map((f) => FAMILY_LABEL[f] || f)
    .sort((a, b) => a.localeCompare(b));

  return (
    <p className={`text-[11px] tracking-[0.05em] text-muted-foreground/80 ${className || ""}`}>
      <span className="uppercase tracking-[0.15em] text-[10px] text-muted-foreground/60 mr-1.5">
        Also contains
      </span>
      {labels.join(" · ")}
    </p>
  );
};

export default AlsoContainsFinishes;
