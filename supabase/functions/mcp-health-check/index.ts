import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@^2.108.2";

// Admin-only health check for the OAuth-protected MCP endpoint.
// The endpoint now requires sign-in, so an unsigned request MUST return
// 401 + WWW-Authenticate. Healthy means: auth challenge present, protected-
// resource metadata reachable, and the authorization server discovery
// document exposes authorize/token/registration endpoints.

const MCP_PATH = "/functions/v1/mcp";
const TIMEOUT_MS = 8000;

type CheckResult = {
  ok: boolean;
  status: number | null;
  duration_ms: number;
  error: string | null;
  detail?: unknown;
};

async function timedFetch(url: string, init: RequestInit = {}): Promise<{ res: Response | null; duration: number; error: string | null }> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, { ...init, signal: controller.signal });
    clearTimeout(timer);
    return { res, duration: Date.now() - started, error: null };
  } catch (err) {
    return {
      res: null,
      duration: Date.now() - started,
      error: err instanceof Error && err.name === "AbortError" ? `Timed out after ${TIMEOUT_MS}ms` : String(err),
    };
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  // Admin gate: require a valid session with an admin role
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authHeader.replace(/^Bearer\s+/i, "");
  const { data: claims, error: claimsError } = await userClient.auth.getClaims(token);
  const userId = claims?.claims?.sub as string | undefined;
  if (claimsError || !userId) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: isAdmin } = await userClient.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Admin access required" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const endpoint = `${supabaseUrl}${MCP_PATH}`;
  const issuer = `${supabaseUrl}/auth/v1`;

  // Check 1: unsigned initialize must be rejected with 401 + WWW-Authenticate
  const challenge: CheckResult = await (async () => {
    const { res, duration, error } = await timedFetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1, method: "initialize",
        params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "maison-affluency-health-check", version: "2.0.0" } },
      }),
    });
    if (!res) return { ok: false, status: null, duration_ms: duration, error };
    const wwwAuth = res.headers.get("www-authenticate") ?? "";
    if (res.status === 401 && wwwAuth.toLowerCase().includes("bearer")) {
      return { ok: true, status: 401, duration_ms: duration, error: null, detail: { www_authenticate: wwwAuth } };
    }
    return {
      ok: false, status: res.status, duration_ms: duration,
      error: res.status === 401 ? "401 missing WWW-Authenticate header" : `Expected 401 auth challenge, got HTTP ${res.status}`,
    };
  })();

  // Check 2: protected-resource metadata reachable and points at our issuer
  const resourceMeta: CheckResult = await (async () => {
    const url = `${endpoint}/.well-known/oauth-protected-resource`;
    const { res, duration, error } = await timedFetch(url);
    if (!res) return { ok: false, status: null, duration_ms: duration, error };
    if (!res.ok) return { ok: false, status: res.status, duration_ms: duration, error: `HTTP ${res.status}` };
    try {
      const meta = await res.json();
      const servers: string[] = Array.isArray(meta?.authorization_servers) ? meta.authorization_servers : [];
      if (servers.includes(issuer)) {
        return { ok: true, status: res.status, duration_ms: duration, error: null, detail: { resource: meta.resource, authorization_servers: servers } };
      }
      return { ok: false, status: res.status, duration_ms: duration, error: `authorization_servers does not include ${issuer}`, detail: meta };
    } catch {
      return { ok: false, status: res.status, duration_ms: duration, error: "Metadata is not valid JSON" };
    }
  })();

  // Check 3: authorization server discovery exposes authorize/token/registration
  const discovery: CheckResult = await (async () => {
    const url = `${issuer}/.well-known/openid-configuration`;
    const { res, duration, error } = await timedFetch(url);
    if (!res) return { ok: false, status: null, duration_ms: duration, error };
    if (!res.ok) return { ok: false, status: res.status, duration_ms: duration, error: `HTTP ${res.status}` };
    try {
      const meta = await res.json();
      const missing = ["authorization_endpoint", "token_endpoint", "registration_endpoint"].filter((k) => !meta?.[k]);
      if (missing.length === 0) {
        return { ok: true, status: res.status, duration_ms: duration, error: null, detail: { authorization_endpoint: meta.authorization_endpoint, token_endpoint: meta.token_endpoint, registration_endpoint: meta.registration_endpoint } };
      }
      return { ok: false, status: res.status, duration_ms: duration, error: `Discovery document missing: ${missing.join(", ")}` };
    } catch {
      return { ok: false, status: res.status, duration_ms: duration, error: "Discovery document is not valid JSON" };
    }
  })();

  const healthy = challenge.ok && resourceMeta.ok && discovery.ok;

  return new Response(JSON.stringify({
    healthy,
    endpoint,
    mode: "oauth_protected",
    checked_at: new Date().toISOString(),
    checks: {
      auth_challenge: { ok: challenge.ok, status: challenge.status, duration_ms: challenge.duration_ms, error: challenge.error, detail: challenge.detail },
      protected_resource_metadata: { ok: resourceMeta.ok, status: resourceMeta.status, duration_ms: resourceMeta.duration_ms, error: resourceMeta.error, detail: resourceMeta.detail },
      oauth_discovery: { ok: discovery.ok, status: discovery.status, duration_ms: discovery.duration_ms, error: discovery.error, detail: discovery.detail },
    },
    note: "Endpoint requires sign-in; tool listing requires an approved OAuth token and is verified through the ChatGPT connector flow.",
  }), {
    status: healthy ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
