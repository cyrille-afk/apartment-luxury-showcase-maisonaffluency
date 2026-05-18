import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useFfeEntitlement(overrideUserId?: string) {
  const { user } = useAuth();
  const effectiveUserId = overrideUserId ?? user?.id ?? null;
  const [favoritesCount, setFavoritesCount] = useState(0);
  const [hasPaidEntitlement, setHasPaidEntitlement] = useState(false);
  const [hasPendingEntitlement, setHasPendingEntitlement] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!effectiveUserId) { setLoading(false); return; }
    setLoading(true);
    const [favRes, entRes] = await Promise.all([
      supabase.from("trade_favorites").select("id", { count: "exact", head: true }).eq("user_id", effectiveUserId),
      supabase.from("ffe_entitlements").select("status").eq("user_id", effectiveUserId).in("status", ["paid", "pending"]),
    ]);
    setFavoritesCount(favRes.count || 0);
    const ents = entRes.data || [];
    setHasPaidEntitlement(ents.some((e: any) => e.status === "paid"));
    setHasPendingEntitlement(ents.some((e: any) => e.status === "pending"));
    setLoading(false);
  }, [effectiveUserId]);

  useEffect(() => { refresh(); }, [refresh]);

  const FAVORITES_REQUIRED = 6;
  const meetsFavoritesThreshold = favoritesCount >= FAVORITES_REQUIRED;
  const unlocked = meetsFavoritesThreshold && hasPaidEntitlement;

  return {
    favoritesCount,
    favoritesRequired: FAVORITES_REQUIRED,
    meetsFavoritesThreshold,
    hasPaidEntitlement,
    hasPendingEntitlement,
    unlocked,
    loading,
    refresh,
  };
}
