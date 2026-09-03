import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type RegionTier = "ASEAN" | "GCC" | "ROW";

export interface RegionalLogisticsRule {
  region_tier: RegionTier;
  base_shipping_markup: number;
  tax_handling_mode: string;
  estimated_lead_time: string;
  hub_city: string | null;
  delivery_mode: string;
  show_singapore_tax: boolean;
  notes: string | null;
}

const ASEAN = [
  "singapore", "sg", "malaysia", "my", "indonesia", "id", "thailand", "th", "vietnam", "viet nam", "vn",
  "philippines", "ph", "brunei", "bn", "cambodia", "kh", "laos", "lao pdr", "la", "myanmar", "burma", "mm",
];
const GCC = [
  "united arab emirates", "uae", "u.a.e.", "ae", "saudi arabia", "ksa", "sa", "kingdom of saudi arabia",
  "qatar", "qa", "kuwait", "kw", "bahrain", "bh", "oman", "om",
];

export function mapCountryToRegionTier(country?: string | null): RegionTier {
  const c = (country || "").trim().toLowerCase();
  if (ASEAN.includes(c)) return "ASEAN";
  if (GCC.includes(c)) return "GCC";
  return "ROW";
}

/**
 * Resolves the signed-in trade user's region tier (from their trade application,
 * falling back to their profile country) and the matching logistics rules.
 */
export function useRegionalLogistics() {
  const { user, profile } = useAuth();
  const [regionTier, setRegionTier] = useState<RegionTier>("ROW");
  const [rule, setRule] = useState<RegionalLogisticsRule | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!user) {
        if (!cancelled) { setRule(null); setLoading(false); }
        return;
      }
      let tier: RegionTier = mapCountryToRegionTier((profile as any)?.country);
      const { data: app } = await supabase
        .from("trade_applications")
        .select("region_tier, country")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (app?.region_tier) tier = app.region_tier as RegionTier;
      else if (app?.country) tier = mapCountryToRegionTier(app.country);

      const { data: rules } = await supabase
        .from("regional_logistics_tiers")
        .select("region_tier, base_shipping_markup, tax_handling_mode, estimated_lead_time, hub_city, delivery_mode, show_singapore_tax, notes")
        .eq("region_tier", tier)
        .maybeSingle();

      if (cancelled) return;
      setRegionTier(tier);
      setRule((rules as RegionalLogisticsRule | null) ?? null);
      setLoading(false);
    };
    run();
    return () => { cancelled = true; };
  }, [user, profile]);

  return { regionTier, rule, loading };
}
