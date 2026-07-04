// Client-side wrappers for the two Validate/Sync edge functions:
//   - trade-concierge-validate → structured traffic-light per row
//   - trade-concierge-realign  → cascading delta (replacements/additions/removals)
//
// Both endpoints are read-only from the DB and never mutate the tearsheet;
// applying accepted deltas is the client's job (see RealignmentDiffPanel).

import { supabase } from "@/integrations/supabase/client";

const BASE = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

export type SyncItem = {
  pick_id: string;
  title?: string;
  designer_name: string | null;
  materials: string | null;
  category: string | null;
};


export type ValidationRow = {
  pick_id: string;
  status: "green" | "yellow" | "red";
  reason: string;
};

export type ValidationVerdict = {
  overall: "green" | "yellow" | "red";
  summary: string;
  per_row: ValidationRow[];
  global_warnings: string[];
};

export type RealignPreview = {
  id: string;
  title: string;
  image_url: string | null;
  materials: string | null;
  category: string | null;
  designer_name: string | null;
};

export type RealignmentDelta = {
  summary: string;
  replacements: { old_pick_id: string; new_pick_id: string; reason: string }[];
  additions:    { new_pick_id: string; reason: string }[];
  removals:     { pick_id: string; reason: string }[];
  new_previews: RealignPreview[];
};

async function authHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  const anon = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return {
    "Content-Type": "application/json",
    apikey: anon,
    Authorization: token ? `Bearer ${token}` : `Bearer ${anon}`,
  };
}

export async function validateTearsheetEdits(payload: {
  title: string;
  original_note?: string | null;
  kept: SyncItem[];
  skipped: SyncItem[];
  locked: SyncItem[];
  title_change?: { from: string; to: string } | null;
}): Promise<ValidationVerdict> {
  const res = await fetch(`${BASE}/trade-concierge-validate`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return {
      overall: "yellow",
      summary: `Validator unreachable (${res.status}).`,
      per_row: [],
      global_warnings: [],
    };
  }
  return (await res.json()) as ValidationVerdict;
}

export async function realignUnlocked(payload: {
  title: string;
  locked: SyncItem[];
  excluded: SyncItem[];
  unlocked: SyncItem[];
}): Promise<RealignmentDelta> {
  const res = await fetch(`${BASE}/trade-concierge-realign`, {
    method: "POST",
    headers: await authHeader(),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    return {
      summary: `Re-aligner unreachable (${res.status}).`,
      replacements: [], additions: [], removals: [], new_previews: [],
    };
  }
  return (await res.json()) as RealignmentDelta;
}
