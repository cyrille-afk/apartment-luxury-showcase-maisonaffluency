import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { collectibleDesigners } from "@/components/Collectibles";

export type CollectibleOverride = { slug: string; trade_only: boolean };

let cachedPromise: Promise<Set<string>> | null = null;

async function loadTradeOnlySlugs(): Promise<Set<string>> {
  if (!cachedPromise) {
    cachedPromise = (async () => {
      const { data, error } = await supabase
        .from("collectible_overrides" as any)
        .select("slug, trade_only");
      if (error || !data) return new Set<string>();
      return new Set(
        (data as any[])
          .filter((r) => r.trade_only)
          .map((r) => String(r.slug))
      );
    })();
  }
  return cachedPromise;
}

export function invalidateCollectibleOverrides() {
  cachedPromise = null;
}

/** Returns the set of collectible-designer slugs flagged trade-only. */
export function useCollectibleTradeOnlySlugs(): Set<string> {
  const [set, setSet] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    loadTradeOnlySlugs().then((s) => {
      if (!cancelled) setSet(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return set;
}

/** Filters `collectibleDesigners`, hiding trade-only entries for public viewers. */
export function useVisibleCollectibleDesigners<T extends { id?: string; name: string }>(
  list: readonly T[] = collectibleDesigners as any
): T[] {
  const tradeOnly = useCollectibleTradeOnlySlugs();
  const { isTradeUser, isAdmin } = useAuth();
  const canSeeTradeOnly = isTradeUser || isAdmin;
  if (canSeeTradeOnly || tradeOnly.size === 0) return list as T[];
  return (list as T[]).filter((d) => {
    const key = d.id || d.name;
    return !tradeOnly.has(String(key));
  });
}
