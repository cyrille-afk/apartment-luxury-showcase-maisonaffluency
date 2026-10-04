import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type TradeOfficeMarket = "SG" | "US" | "GB" | null;

export function resolveTradeOfficeMarket(country?: string | null, city?: string | null): TradeOfficeMarket {
  const location = (country || "").trim().toLowerCase();
  const office = (city || "").trim().toLowerCase();
  if (["singapore", "sg"].includes(location)) return "SG";
  if (["united states", "united states of america", "usa", "us", "u.s.", "u.s.a."].includes(location)) return "US";
  if (["united kingdom", "uk", "gb", "great britain", "england", "scotland", "wales"].includes(location)) return "GB";
  if (!location && ["new york", "nyc"].includes(office)) return "US";
  if (!location && office === "london") return "GB";
  return null;
}

/** The member's registered trade office, not their browser or delivery address. */
export function useTradeOfficeMarket(): TradeOfficeMarket {
  const { user } = useAuth();
  const [market, setMarket] = useState<TradeOfficeMarket>(null);

  useEffect(() => {
    let cancelled = false;
    setMarket(null);
    if (!user?.id) return;

    (async () => {
      const [{ data: account }, { data: profile }] = await Promise.all([
        supabase.from("trade_accounts").select("country,city").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("profiles").select("country").eq("id", user.id).maybeSingle(),
      ]);
      if (!cancelled) setMarket(resolveTradeOfficeMarket(account?.country || profile?.country, account?.city));
    })();

    return () => { cancelled = true; };
  }, [user?.id]);

  return market;
}