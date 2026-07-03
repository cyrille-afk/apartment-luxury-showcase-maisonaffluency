import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const EDITABLE_FIELDS = [
  "company_name",
  "company_website",
  "job_title",
  "city",
  "country",
  "is_certified_professional",
  "certification_details",
  "message",
] as const;

const patchSchema = z.object({
  company_name: z.string().trim().min(1).max(200).optional().nullable(),
  company_website: z.string().trim().max(500).optional().nullable(),
  job_title: z.string().trim().min(1).max(150).optional().nullable(),
  city: z.string().trim().max(100).optional().nullable(),
  country: z.string().trim().max(100).optional().nullable(),
  is_certified_professional: z.boolean().optional().nullable(),
  certification_details: z.string().trim().max(300).optional().nullable(),
  message: z.string().trim().max(2000).optional().nullable(),
}).passthrough();

const bodySchema = z.object({
  action: z.enum(["get", "update"]),
  token: z.string().min(10).max(200),
  patch: patchSchema.optional(),
});

const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let parsed;
  try {
    parsed = bodySchema.safeParse(await req.json());
  } catch {
    return json(400, { error: "invalid_json" });
  }
  if (!parsed.success) return json(400, { error: parsed.error.flatten() });

  const { action, token, patch } = parsed.data;

  // Hash the incoming token and look up by hash — the raw token is never stored.
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: app, error } = await admin
    .from("trade_applications")
    .select(
      "id, user_id, status, edit_token_expires_at, company_name, company_website, job_title, city, country, is_certified_professional, certification_details, message"
    )
    .eq("edit_token_hash", tokenHash)
    .maybeSingle();

  if (error) return json(500, { error: "lookup_failed" });
  if (!app) return json(404, { error: "invalid_token" });
  if (app.edit_token_expires_at && new Date(app.edit_token_expires_at) < new Date()) {
    return json(410, { error: "expired" });
  }
  if (app.status === "approved" || app.status === "rejected") {
    return json(409, { error: "already_reviewed", status: app.status });
  }

  if (action === "get") {
    const { id: _id, user_id: _u, edit_token_expires_at: _e, ...rest } = app as Record<string, unknown>;
    return json(200, { application: rest });
  }

  if (!patch || Object.keys(patch).length === 0) {
    return json(400, { error: "empty_patch" });
  }

  const update: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in patch) update[key] = (patch as Record<string, unknown>)[key];
  }

  // Resolve the applicant's display name from their profile so admins see
  // "Completed by [name]" on the card once they save.
  let completedByName: string | null = null;
  if (app.user_id) {
    const { data: prof } = await admin
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("id", app.user_id)
      .maybeSingle();
    if (prof) {
      const full = `${prof.first_name || ""} ${prof.last_name || ""}`.trim();
      completedByName = full || prof.email || null;
    }
  }

  update.edit_completed_at = new Date().toISOString();
  update.edit_completed_by_name = completedByName;

  const { error: upErr } = await admin
    .from("trade_applications")
    .update(update)
    .eq("id", app.id);

  if (upErr) return json(500, { error: "update_failed", detail: upErr.message });

  return json(200, { success: true });
});
