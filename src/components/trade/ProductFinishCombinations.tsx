import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { productFinishCombinations, type ProductFinishCombination } from "@/lib/productFinishCombinations";
import type { QuoteFinishVariant } from "@/lib/quoteFinishSwatches";
import { cn } from "@/lib/utils";

export default function ProductFinishCombinations({ pickId, variants, size, base, top, onSelect }: {
  pickId: string;
  variants: QuoteFinishVariant[];
  size: string | null;
  base: string | null;
  top: string | null;
  onSelect: (combination: ProductFinishCombination) => void;
}) {
  const { data: swatches = [] } = useQuery({
    queryKey: ["product-3d-combination-swatches", pickId],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_fabric_swatches_public").select("name,image_url,sort_order").eq("pick_id", pickId).eq("is_active", true);
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 60_000,
  });
  const combinations = productFinishCombinations(variants, swatches, size);
  if (!combinations.length) return null;
  return (
    <section aria-label="3D finish combinations" className="border-b border-border pb-4 mb-3">
      <h3 className="font-body text-[11px] uppercase text-muted-foreground mb-3">Finish combinations</h3>
      <div className="grid grid-cols-2 gap-2 max-h-72 overflow-y-auto">
        {combinations.map((combination) => {
          const active = combination.base === base && combination.top === top;
          return <Button key={JSON.stringify([combination.base, combination.top])} variant="outline" aria-pressed={active}
            aria-label={`Preview ${combination.base} with ${combination.top}`}
            onClick={() => onSelect(combination)}
            className={cn("h-auto min-h-14 justify-start gap-2 whitespace-normal px-2 py-2 text-left", active && "border-foreground bg-muted")}>
            <span className="flex shrink-0 overflow-hidden border border-border rounded-sm">
              <img src={combination.baseTextureUrl} alt="" className="h-9 w-5 object-cover" />
              <img src={combination.topTextureUrl} alt="" className="h-9 w-5 object-cover" />
            </span>
            <span className="min-w-0 font-body text-[11px] leading-normal"><span className="block">{combination.base}</span><span className="block text-muted-foreground">{combination.top}</span></span>
          </Button>;
        })}
      </div>
    </section>
  );
}