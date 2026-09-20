// Temporary administrative patch: backfills `instagram_handle` and
// `executive_emails` on acquisition leads that are missing them.
//
// Admin-only. Loops the missing rows in a single run, asks the model to map
// each studio's verified public Instagram handle and its founder's direct
// professional email, then upserts the result back onto the lead row.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { requireAdmin } from "../_shared/auth.ts";
import { modelFor } from "../_shared/aiModels.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const GATEWAY = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = modelFor("balanced");
const MAX_PER_RUN = 60;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const IG_HANDLE_RE = /^[a-zA-Z0-9._]{1,30}$/;

function sanitizeInstagram(v: unknown): string | null {
  if (typeof v !== "string") return null;
  let h = v.trim();
  if (!h) return null;
  const m = h.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) h = m[1];
  h = h.replace(/^@+/, "").trim();
  return IG_HANDLE_RE.test(h) ? h.toLowerCase() : null;
}

function sanitizeEmails(v: unknown): string[] {
  const list = Array.isArray(v) ? v : typeof v === "string" ? [v] : [];
  const out = new Set<string>();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const e = raw.trim().toLowerCase();
    if (EMAIL_RE.test(e) && e.length <= 255) out.add(e);
    if (out.size >= 3) break;
  }
  return Array.from(out);
}

type Lead = {
  id: string;
  studio_name: string;
  founder_name: string | null;
  website_url: string | null;
  business_email: string;
  instagram_handle: string | null;
  executive_emails: string[] | null;
};

async function analyse(lead: Lead, apiKey: string) {
  const prompt = [
    "You are a verification analyst mapping public professional contact data for design studios.",
    "",
    `Studio: ${lead.studio_name}`,
    `Founder / principal: ${lead.founder_name ?? "unknown"}`,
    `Website: ${lead.website_url ?? "unknown"}`,
    `Known generic contact: ${lead.business_email}`,
    "",
    "1. Locate the studio's verified, official public Instagram handle. Return it as a clean string WITHOUT the @ prefix. If you are not confident it is the official account, return null. Never invent or guess a handle.",
    "2. Locate the direct professional email of the main executive founder or principal (e.g. firstname@studio-domain.com) as published on the studio's own website or press materials. Return an array of at most 2 such addresses. Exclude generic catch-alls such as info@, hello@, contact@, studio@, press@. If none are verifiable, return an empty array.",
    "",
    'Reply as JSON only: {"instagram_handle":"studio_handle_here","executive_emails":["name@studio.com"]}',
  ].join("\n");

  const res = await fetch(GATEWAY, {
    method: "POST",
    headers: { "Lovable-API-Key": apiKey, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2000,
      response_format: { type: "json_object" },
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (res.status === 402 || res.status === 403 || res.status === 429) {
    throw Object.assign(new Error("AI temporarily unavailable"), { status: res.status });
  }
  if (!res.ok) throw new Error(`AI ${res.status}`);

  const payload = await res.json();
  const parsed = JSON.parse(String(payload?.choices?.[0]?.message?.content ?? "") || "{}");
  return {
    instagram: sanitizeInstagram(parsed?.instagram_handle),
    emails: sanitizeEmails(parsed?.executive_emails),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const gate = await requireAdmin(req);
  if (!gate.ok) return json({ error: gate.error ?? "Unauthorized" }, gate.status ?? 401);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI is not configured" }, 500);

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const { data, error } = await supabase
    .from("acquisition_leads")
    .select("id, studio_name, founder_name, website_url, business_email, instagram_handle, executive_emails")
    .is("instagram_handle", null)
    .order("created_at", { ascending: false })
    .limit(MAX_PER_RUN);

  if (error) {
    console.error("[repair-acquisition-contacts] fetch failed", error.message);
    return json({ error: "Could not load leads" }, 500);
  }

  const leads = (data ?? []) as Lead[];
  const results: { id: string; studio: string; status: string; instagram_handle?: string | null; executive_emails?: string[] }[] = [];
  let repaired = 0;
  let unresolved = 0;
  let failed = 0;

  for (const lead of leads) {
    try {
      const { instagram, emails } = await analyse(lead, apiKey);
      if (!instagram && emails.length === 0) {
        unresolved++;
        results.push({ id: lead.id, studio: lead.studio_name, status: "no_verified_data" });
        continue;
      }

      const patch: Record<string, unknown> = {};
      if (instagram) patch.instagram_handle = instagram;
      if (emails.length && !(lead.executive_emails ?? []).length) patch.executive_emails = emails;

      const { error: upErr } = await supabase
        .from("acquisition_leads")
        .update(patch)
        .eq("id", lead.id);
      if (upErr) throw new Error(upErr.message);

      repaired++;
      results.push({
        id: lead.id,
        studio: lead.studio_name,
        status: "repaired",
        instagram_handle: instagram,
        executive_emails: emails,
      });
    } catch (e) {
      const status = (e as { status?: number })?.status;
      failed++;
      results.push({ id: lead.id, studio: lead.studio_name, status: "failed" });
      console.error("[repair-acquisition-contacts]", lead.studio_name, e instanceof Error ? e.message : String(e));
      // Stop early on quota/rate limits rather than burning the whole batch.
      if (status === 402 || status === 429) break;
    }
  }

  return json({ success: true, scanned: leads.length, repaired, unresolved, failed, results });
});
