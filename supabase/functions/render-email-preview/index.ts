import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "npm:@supabase/supabase-js@2";
import { TEMPLATES } from "../_shared/transactional-email-templates/registry.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, apikey",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json(401, { error: "unauthorized" });
  const token = authHeader.slice("Bearer ".length);

  // Verify caller identity via JWT claims.
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimData, error: claimErr } = await userClient.auth.getClaims(token);
  if (claimErr || !claimData?.claims?.sub) return json(401, { error: "unauthorized" });
  const userId = claimData.claims.sub as string;

  // Require admin role — this preview may include applicant data.
  const admin = createClient(SUPABASE_URL, SERVICE, { auth: { persistSession: false } });
  const { data: roles } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const isAdmin = (roles || []).some(
    (r: { role: string }) => r.role === "admin" || r.role === "super_admin"
  );
  if (!isAdmin) return json(403, { error: "forbidden" });

  let body: { templateName?: string; templateData?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const { templateName, templateData } = body;
  if (!templateName || typeof templateName !== "string") {
    return json(400, { error: "templateName_required" });
  }

  const entry = TEMPLATES[templateName];
  if (!entry) return json(404, { error: "template_not_found" });

  try {
    const props = templateData ?? entry.previewData ?? {};
    const html = await renderAsync(React.createElement(entry.component, props));
    const subject =
      typeof entry.subject === "function" ? entry.subject(props) : entry.subject;
    return json(200, { html, subject });
  } catch (e) {
    return json(500, {
      error: "render_failed",
      detail: e instanceof Error ? e.message : String(e),
    });
  }
});
