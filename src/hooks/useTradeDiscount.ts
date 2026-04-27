/**
 * Returns the active trade discount for the signed-in user, based on their tier.
 *   silver → 8%, gold → 12%, platinum → 18%
 * Legacy "standard" rows are treated as silver (8%).
 * Falls back to 8% for unauthenticated users or while loading.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TradeTier = "silver" | "gold" | "platinum";
type TradeTierRaw = TradeTier | "standard";

export const TIER_DISCOUNT: Record<TradeTier, number> = {
  silver: 0.08,
  gold: 0.12,
  platinum: 0.18,
};

export const TIER_LABEL: Record<TradeTier, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const normalize = (raw: TradeTierRaw | null | undefined): TradeTier => {
  if (raw === "gold" || raw === "platinum") return raw;
  return "silver"; // standard + silver + null all map to silver/8%
};

export function useTradeDiscount() {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["trade-tier", user?.id],
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 10,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("trade_tier")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return normalize(data?.trade_tier as TradeTierRaw | null);
    },
  });

  const tier: TradeTier = data ?? "silver";
  const discountPct = TIER_DISCOUNT[tier];

  return {
    tier,
    discountPct,
    discountLabel: `${Math.round(discountPct * 100)}%`,
    tierLabel: TIER_LABEL[tier],
    apply: (cents: number) => Math.round(cents * (1 - discountPct)),
  };
}
