import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

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
export function useClientTierUpgrades() {
  const [flags, setFlags] = useState<ClientUpgradeFlags>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from("clients" as any)
      .select("id, eligible_tier, eligible_for_upgrade")
      .eq("eligible_for_upgrade", true);
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
  }, []);

  useEffect(() => {
    let active = true;
    refresh();
    const channel = supabase
      .channel(`client-tier-upgrades-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "clients" }, () => {
        if (active) refresh();
      })
      .subscribe();
    return () => {
      active = false;
      supabase.removeChannel(channel);
    };
  }, [refresh]);

  return { flags, count: Object.keys(flags).length, loading, refresh };
}
