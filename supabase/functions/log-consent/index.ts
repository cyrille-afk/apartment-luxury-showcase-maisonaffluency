import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Immutable consent audit trail (GDPR Art. 7(1)).
 * Stores only hashed identifiers — never an email, auth id or raw IP.
 */

const sha256Hex = async (value: string): Promise<string> => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
};

const SALT = Deno.env.get("CONSENT_HASH_SALT") ?? Deno.env.get("SUPABASE_URL") ?? "ma";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return json({ error: "Invalid payload" }, 400);

    const { subjectId, policyVersion, decidedAt, method, scopes, path, surface } =
      body as Record<string, unknown>;

    if (typeof subjectId !== "string" || subjectId.length < 4 || subjectId.length > 128)
      return json({ error: "Invalid subjectId" }, 400);
    if (typeof policyVersion !== "string" || policyVersion.length > 64)
      return json({ error: "Invalid policyVersion" }, 400);
    if (!["accept_all", "reject_all", "custom"].includes(String(method)))
      return json({ error: "Invalid method" }, 400);
    const when = typeof decidedAt === "string" ? Date.parse(decidedAt) : NaN;
    if (!Number.isFinite(when)) return json({ error: "Invalid decidedAt" }, 400);
    const s = (scopes ?? {}) as Record<string, unknown>;

    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const { error } = await supabase.from("consent_audit_log").insert({
      subject_hash: await sha256Hex(`${SALT}:${subjectId}`),
      policy_version: policyVersion,
      method: String(method),
      scope_necessary: true,
      scope_functional: s.functional === true,
      scope_analytics: s.analytics === true,
      scope_marketing: s.marketing === true,
      surface: typeof surface === "string" ? surface.slice(0, 32) : null,
      path: typeof path === "string" ? path.slice(0, 256) : null,
      user_agent_hash: await sha256Hex(`${SALT}:${req.headers.get("user-agent") ?? ""}`),
      ip_hash: await sha256Hex(`${SALT}:${ip}`),
      decided_at: new Date(when).toISOString(),
    });

    if (error) return json({ error: "Could not record consent" }, 500);
    return json({ recorded: true });
  } catch {
    return json({ error: "Unexpected error" }, 500);
  }
});
