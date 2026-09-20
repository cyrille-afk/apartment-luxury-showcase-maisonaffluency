// Outbound lead ingestion endpoint.
//
// Accepts a JSON array of studio leads from a third-party scraping /
// enrichment tool (Clay, Apify, PhantomBuster...). Authenticated with the
// shared `OUTBOUND_INGEST_SECRET` header — never a user JWT.
//
// Payload: { leads: [{ studio_name, founder_name, business_email,
//                      website_url, recent_design_keywords }] }
//
// Rows land in `prospect_studios` with enrichment_status = 'pending'; the
// bounded `enrich-prospect-aesthetics` worker picks them up.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { clientIp, rateLimit } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-ingest-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const MAX_LEADS = 250;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

const str = (v: unknown, max: number): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim().replace(/[\u0000-\u001f]/g, " ").slice(0, max);
  return t.length ? t : null;
};

function keywords(v: unknown): string[] {
  const list = Array.isArray(v)
    ? v
    : typeof v === "string"
    ? v.split(/[,;|]/)
    : [];
  const out: string[] = [];
  for (const raw of list) {
    const k = str(raw, 80);
    if (k && !out.includes(k)) out.push(k);
    if (out.length >= 25) break;
  }
  return out;
}

function normalizeUrl(v: unknown): string | null {
  const raw = str(v, 500);
  if (!raw) return null;
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const u = new URL(withScheme);
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return u.toString();
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const secret = Deno.env.get("OUTBOUND_INGEST_SECRET") || "";
  const presented = req.headers.get("x-ingest-secret") || "";
  if (!secret || presented !== secret) {
    return json({ error: "Unauthorized" }, 401);
  }

  const limited = rateLimit(`ingest:${clientIp(req)}`, 30, 60_000);
  if (!limited.ok) {
    return new Response(JSON.stringify({ error: "Too many requests" }), {
      status: 429,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Retry-After": String(limited.retryInSec),
      },
    });
  }

  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return json({ error: "Invalid JSON body" }, 400);
  }

  const rawLeads = Array.isArray(payload)
    ? payload
    : Array.isArray((payload as { leads?: unknown })?.leads)
    ? (payload as { leads: unknown[] }).leads
    : null;
  if (!rawLeads) return json({ error: "Expected a JSON array of leads" }, 400);
  if (rawLeads.length > MAX_LEADS) {
    return json({ error: `At most ${MAX_LEADS} leads per request` }, 400);
  }

  const source = str((payload as { source?: unknown })?.source, 60) ?? "api";
  const rejected: { index: number; reason: string }[] = [];
  const rows: Record<string, unknown>[] = [];
  const seen = new Set<string>();

  rawLeads.forEach((lead, index) => {
    if (!lead || typeof lead !== "object") {
      rejected.push({ index, reason: "not_an_object" });
      return;
    }
    const l = lead as Record<string, unknown>;
    const studio = str(l.studio_name, 200);
    const email = (str(l.business_email, 200) || "").toLowerCase();
    if (!studio) return rejected.push({ index, reason: "missing_studio_name" });
    if (!EMAIL_RE.test(email)) return rejected.push({ index, reason: "invalid_business_email" });
    if (seen.has(email)) return rejected.push({ index, reason: "duplicate_in_payload" });
    seen.add(email);

    rows.push({
      studio_name: studio,
      founder_name: str(l.founder_name, 160),
      business_email: email,
      website_url: normalizeUrl(l.website_url),
      recent_design_keywords: keywords(l.recent_design_keywords),
      website_summary: str(l.website_summary ?? l.summary, 4000),
      lead_source: source,
      enrichment_status: "pending",
    });
  });

  if (rows.length === 0) {
    return json({ ingested: 0, updated: 0, rejected }, rejected.length ? 400 : 200);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Idempotent on business_email: re-ingesting a lead refreshes its research
  // inputs but never resets a campaign that has already been dispatched.
  const { data, error } = await supabase
    .from("prospect_studios")
    .upsert(rows, { onConflict: "business_email" })
    .select("id, business_email, enrichment_status");

  if (error) {
    console.error("[ingest-prospect-leads] upsert failed", error.message);
    return json({ error: "Ingestion failed" }, 500);
  }

  // Kick the bounded enrichment worker once — it self-limits its batch size.
  try {
    await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-prospect-aesthetics`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      },
      body: JSON.stringify({ batchSize: Math.min(rows.length, 10) }),
    });
  } catch (e) {
    console.error("[ingest-prospect-leads] worker wake failed", String(e));
  }

  return json({ ingested: data?.length ?? 0, rejected });
});
