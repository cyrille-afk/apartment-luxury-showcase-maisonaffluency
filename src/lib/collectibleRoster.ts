// Collectible Design roster — loaded from the `collectible_roster` table.
// Replaces the designer list that used to be bundled into Collectibles.tsx.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CollectiblePick = {
  image: string;
  hoverImage?: string;
  title: string;
  category: string;
  subcategory?: string;
  materials: string;
  dimensions: string;
  edition?: string;
  tags?: string[];
  description?: string;
  pdfUrl?: string;
  pdfFilename?: string;
};

export type CollectibleDesigner = {
  id?: string;
  name: string;
  founder?: string;
  specialty: string;
  image: string;
  biography: string;
  notableWorks: string;
  notableWorksLink?: { text: string; galleryIndex: number };
  philosophy: string;
  curatorPicks: CollectiblePick[];
  links: Array<{ type: string; url?: string }>;
};

export type CollectibleRoster = {
  designers: CollectibleDesigner[];
  /** Roster keys that require trade sign-in. */
  gated: Set<string>;
};

let rosterPromise: Promise<CollectibleRoster> | null = null;
let rosterCache: CollectibleRoster | null = null;

export function loadCollectibleRoster(): Promise<CollectibleRoster> {
  if (!rosterPromise) {
    rosterPromise = (async () => {
      const { data, error } = await supabase
        .from("collectible_roster" as any)
        .select("roster_key, gated, payload")
        .order("sort_order", { ascending: true });
      if (error) {
        rosterPromise = null;
        throw error;
      }
      const rows = (data as any[]) ?? [];
      const roster: CollectibleRoster = {
        designers: rows.map((r) => r.payload as CollectibleDesigner),
        gated: new Set(rows.filter((r) => r.gated).map((r) => String(r.roster_key))),
      };
      rosterCache = roster;
      return roster;
    })();
  }
  return rosterPromise;
}

export function getCachedCollectibleRoster(): CollectibleRoster | null {
  return rosterCache;
}

export function invalidateCollectibleRoster() {
  rosterPromise = null;
}

/** Returns the roster (null while loading). */
export function useCollectibleRoster(): CollectibleRoster | null {
  const [roster, setRoster] = useState<CollectibleRoster | null>(rosterCache);
  useEffect(() => {
    let cancelled = false;
    loadCollectibleRoster()
      .then((r) => !cancelled && setRoster(r))
      .catch(() => !cancelled && setRoster({ designers: [], gated: new Set() }));
    return () => {
      cancelled = true;
    };
  }, []);
  return roster;
}

const EMPTY: CollectibleDesigner[] = [];
export function useCollectibleDesigners(): CollectibleDesigner[] {
  return useCollectibleRoster()?.designers ?? EMPTY;
}
