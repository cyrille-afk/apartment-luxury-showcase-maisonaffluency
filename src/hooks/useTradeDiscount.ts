/**
 * Returns the active trade discount for the signed-in user, based on their tier.
 *   standard → 8%, silver → 12%, gold → 18%
 * Falls back to 8% (standard) for unauthenticated users or while loading.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TradeTier = "standard" | "silver" | "gold";

export const TIER_DISCOUNT: Record<TradeTier, number> = {
  standard: 0.08,
  silver: 0.12,
  gold: 0.18,
};

export const TIER_LABEL: Record<TradeTier, string> = {
  standard: "Standard",
  silver: "Silver",
  gold: "Gold",
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
      return (data?.trade_tier as TradeTier) ?? "standard";
    },
  });

  const tier: TradeTier = data ?? "standard";
  const discountPct = TIER_DISCOUNT[tier];

  return {
    tier,
    discountPct,                      // e.g. 0.12
    discountLabel: `${Math.round(discountPct * 100)}%`,
    tierLabel: TIER_LABEL[tier],
    /** Apply discount to a cents value */
    apply: (cents: number) => Math.round(cents * (1 - discountPct)),
  };
}
