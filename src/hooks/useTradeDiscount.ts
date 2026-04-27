/**
 * Returns the active trade discount for the signed-in user, based on their tier.
 * Discount % and spend thresholds are sourced from the `trade_tier_config` table
 * so admins can edit them without code changes. Falls back to sensible defaults
 * (silver 8%, gold 10%, platinum 15%) while loading or for unauthenticated users.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TradeTier = "silver" | "gold" | "platinum";
type TradeTierRaw = TradeTier | "standard";

export interface TierConfigRow {
  tier: TradeTier;
  discount_pct: number;
  min_spend_cents: number;
  label: string;
}

const FALLBACK_CONFIG: Record<TradeTier, TierConfigRow> = {
  silver:   { tier: "silver",   discount_pct: 0.08, min_spend_cents: 0,         label: "Silver" },
  gold:     { tier: "gold",     discount_pct: 0.10, min_spend_cents: 25_000_000,  label: "Gold" },
  platinum: { tier: "platinum", discount_pct: 0.15, min_spend_cents: 75_000_000,  label: "Platinum" },
};

export const TIER_LABEL: Record<TradeTier, string> = {
  silver: "Silver",
  gold: "Gold",
  platinum: "Platinum",
};

const normalize = (raw: TradeTierRaw | null | undefined): TradeTier => {
  if (raw === "gold" || raw === "platinum") return raw;
  return "silver";
};

export function useTierConfig() {
  return useQuery({
    queryKey: ["trade-tier-config"],
    staleTime: 1000 * 60 * 10,
    queryFn: async (): Promise<Record<TradeTier, TierConfigRow>> => {
      const { data, error } = await (supabase as any)
        .from("trade_tier_config")
        .select("tier, discount_pct, min_spend_cents, label");
      if (error) throw error;
      const map = { ...FALLBACK_CONFIG };
      (data || []).forEach((row: any) => {
        if (row.tier in map) {
          map[row.tier as TradeTier] = {
            tier: row.tier,
            discount_pct: Number(row.discount_pct),
            min_spend_cents: Number(row.min_spend_cents),
            label: row.label || TIER_LABEL[row.tier as TradeTier],
          };
        }
      });
      return map;
    },
  });
}

export function useTradeDiscount() {
  const { user } = useAuth();
  const { data: config } = useTierConfig();

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
  const cfg = config ?? FALLBACK_CONFIG;
  const discountPct = cfg[tier].discount_pct;

  return {
    tier,
    discountPct,
    discountLabel: `${(discountPct * 100).toFixed(discountPct * 100 % 1 === 0 ? 0 : 1)}%`,
    tierLabel: cfg[tier].label,
    config: cfg,
    apply: (cents: number) => Math.round(cents * (1 - discountPct)),
  };
}
