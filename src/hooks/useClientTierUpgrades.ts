import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useRealtimeTables } from "@/contexts/RealtimeMultiplexerContext";

export type EligibleTier = "gold" | "platinum";

export type ClientUpgradeFlags = Record<string, EligibleTier>;

export function tierUpgradeLabel(tier: EligibleTier | string | null | undefined): string | null {
  if (tier === "gold") return "Eligible for Gold Upgrade";
  if (tier === "platinum") return "Eligible for Platinum Upgrade";
  return null;
}

/**
 * Live rolling-12-month tier eligibility flags computed in the database
 * (clients.eligible_for_upgrade / eligible_tier). RLS scopes rows to the
 * studios the member belongs to, so the count is always studio-safe.
 */
export function useClientTierUpgrades(studioId?: string | null) {
  const [flags, setFlags] = useState<ClientUpgradeFlags>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    let query = supabase
      .from("clients" as any)
      .select("id, eligible_tier, eligible_for_upgrade, studio_id")
      .eq("eligible_for_upgrade", true);
    if (studioId) query = query.eq("studio_id", studioId);
    const { data, error } = await query;
    if (!error) {
      const next: ClientUpgradeFlags = {};
      ((data || []) as any[]).forEach((row) => {
        if (row.eligible_tier === "gold" || row.eligible_tier === "platinum") {
          next[row.id] = row.eligible_tier;
        }
      });
      setFlags(next);
    }
    setLoading(false);
  }, [studioId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useRealtimeTables("clients", () => refresh());

  return { flags, count: Object.keys(flags).length, loading, refresh };
}
