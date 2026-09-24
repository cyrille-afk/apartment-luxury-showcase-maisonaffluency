/**
 * sync-currency-rates
 * ===================
 *
 * Single source of FX truth for the whole platform.
 *
 * Runs on a cron (06:00 + 18:00 UTC) and can be triggered manually by an
 * admin. Fetches one EUR-based rate table from Frankfurter (ECB), falls back
 * to open.er-api.com, validates the payload, derives every cross pair from
 * that single base so cross-rates stay internally consistent, and upserts
 * them into public.currency_rates.
 *
 * Validation guards (a failed guard aborts the run — stale rates are safer
 * than corrupt rates on luxury orders):
 *   - every tracked currency present
 *   - every rate a finite positive number
 *   - no pair moving more than MAX_DRIFT vs. the stored value
 *
 * POST { force?: boolean }  -> force skips the drift guard (admin override)
 */

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { requireCronOrAdmin } from "../_shared/auth.ts";

export const CURRENCIES = [
  "EUR", "USD", "SGD", "GBP", "CHF", "AED", "HKD", "AUD", "JPY", "CAD",
] as const;

/** Reject a sync if any pair moves more than this fraction vs. stored value. */
export const MAX_DRIFT = 0.1;

export type EurBase = Record<string, number>;

/** Validate an EUR-based payload: all currencies present, positive + finite. */
export function validateEurBase(raw: unknown): { ok: true; rates: EurBase } | { ok: false; error: string } {
  if (!raw || typeof raw !== "object") return { ok: false, error: "payload is not an object" };
  const src = raw as Record<string, unknown>;
  const rates: EurBase = { EUR: 1 };
  for (const cur of CURRENCIES) {
    if (cur === "EUR") continue;
    const v = src[cur];
    if (typeof v !== "number" || !Number.isFinite(v) || v <= 0) {
      return { ok: false, error: `missing or invalid rate for ${cur}` };
    }
    rates[cur] = v;
  }
  return { ok: true, rates };
}

/** Derive all ordered pairs from one EUR base: rate(A→B) = eur[B] / eur[A]. */
export function derivePairs(eur: EurBase): Array<{ base_currency: string; target_currency: string; rate: number }> {
  const out: Array<{ base_currency: string; target_currency: string; rate: number }> = [];
  for (const a of CURRENCIES) {
    for (const b of CURRENCIES) {
      if (a === b) continue;
      out.push({ base_currency: a, target_currency: b, rate: eur[b] / eur[a] });
    }
  }
  return out;
}

/** Drift guard: returns the offending pair, or null when everything is sane. */
export function findExcessiveDrift(
  next: Array<{ base_currency: string; target_currency: string; rate: number }>,
  stored: Record<string, number>,
  maxDrift = MAX_DRIFT,
): { pair: string; from: number; to: number } | null {
  for (const p of next) {
    const key = `${p.base_currency}_${p.target_currency}`;
    const prev = stored[key];
    if (!prev || !Number.isFinite(prev) || prev <= 0) continue;
    if (Math.abs(p.rate - prev) / prev > maxDrift) {
      return { pair: key, from: prev, to: p.rate };
    }
  }
  return null;
}

async function fetchFrankfurter(): Promise<{ rates: EurBase; date: string | null } | null> {
  try {
    const symbols = CURRENCIES.filter((c) => c !== "EUR").join(",");
    const res = await fetch(`https://api.frankfurter.dev/v1/latest?base=EUR&symbols=${symbols}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const v = validateEurBase(data?.rates);
    if (!v.ok) return null;
    return { rates: v.rates, date: typeof data?.date === "string" ? data.date : null };
  } catch {
    return null;
  }
}

async function fetchOpenErApi(): Promise<{ rates: EurBase; date: string | null } | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/EUR", { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    const data = await res.json();
    const v = validateEurBase(data?.rates);
    if (!v.ok) return null;
    return { rates: v.rates, date: new Date().toISOString().slice(0, 10) };
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  {
    const __auth = await requireCronOrAdmin(req, "sync-currency-rates");
    if (!__auth.ok) {
      return new Response(JSON.stringify(__auth.body), { status: __auth.status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    let force = false;
    if (req.method === "POST") {
      try {
        const body = await req.json();
        force = body?.force === true;
      } catch { /* empty body is fine (cron) */ }
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } },
    );

    let source = "frankfurter";
    let feed = await fetchFrankfurter();
    if (!feed) {
      feed = await fetchOpenErApi();
      source = "open-er-api";
    }
    if (!feed) {
      return json({ ok: false, error: "both rate providers unreachable; existing rates kept" }, 502);
    }

    const pairs = derivePairs(feed.rates);

    const { data: existing } = await supabase
      .from("currency_rates")
      .select("base_currency,target_currency,rate");
    const stored: Record<string, number> = {};
    for (const row of existing ?? []) {
      stored[`${row.base_currency}_${row.target_currency}`] = Number(row.rate);
    }

    if (!force) {
      const drift = findExcessiveDrift(pairs, stored);
      if (drift) {
        console.error("[sync-currency-rates] aborted: excessive drift", drift);
        return json({
          ok: false,
          error: `excessive drift on ${drift.pair}: ${drift.from} -> ${drift.to}. Re-run with force:true to accept.`,
          drift,
        }, 409);
      }
    }

    const now = new Date().toISOString();
    const rows = pairs.map((p) => ({
      ...p,
      rate: Number(p.rate.toFixed(10)),
      source,
      rate_date: feed!.date,
      last_updated_at: now,
    }));

    const { error } = await supabase
      .from("currency_rates")
      .upsert(rows, { onConflict: "base_currency,target_currency" });
    if (error) {
      console.error("[sync-currency-rates] upsert failed", error);
      return json({ ok: false, error: error.message }, 500);
    }

    console.log(`[sync-currency-rates] upserted ${rows.length} pairs from ${source}`);
    return json({ ok: true, source, rateDate: feed.date, pairs: rows.length, syncedAt: now });
  } catch (e) {
    console.error("[sync-currency-rates] unexpected", e);
    return json({ ok: false, error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
