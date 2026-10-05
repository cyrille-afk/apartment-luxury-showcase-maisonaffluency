import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@^2.108.2";

// Admin-only health check for the public MCP endpoint.
// Verifies: (1) initialize handshake, (2) tools/list response, (3) expected tools present.

const MCP_PATH = "/functions/v1/mcp";
const EXPECTED_TOOLS = ["search_curator_picks"];
const TIMEOUT_MS = 8000;

type CheckResult = {
  ok: boolean;
  status: number | null;
  duration_ms: number;
  error: string | null;
  detail?: unknown;
};

async function rpc(url: string, method: string, params: Record<string, unknown>, id: number): Promise<CheckResult> {
  const started = Date.now();
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    const res = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        // Required by MCP Streamable HTTP — servers reject without it (406)
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id, method, params }),
    });
    clearTimeout(timer);
    const duration = Date.now() - started;
    const text = await res.text();

    // Parse plain JSON or the first data: line of an SSE stream
    let payload: unknown = null;
    try {
      payload = JSON.parse(text);
    } catch {
      const dataLine = text.split("\n").find((l) => l.startsWith("data:"));
      if (dataLine) {
        try { payload = JSON.parse(dataLine.slice(5).trim()); } catch { /* fallthrough */ }
      }
    }
    if (!payload || typeof payload !== "object") {
      return { ok: false, status: res.status, duration_ms: duration, error: `Non-JSON-RPC response (HTTP ${res.status})`, detail: text.slice(0, 300) };
    }
    const p = payload as { error?: { message?: string }; result?: unknown };
    if (p.error) {
      return { ok: false, status: res.status, duration_ms: duration, error: `RPC error: ${p.error.message ?? "unknown"}`, detail: p.error };
    }
    if (!res.ok) {
      return { ok: false, status: res.status, duration_ms: duration, error: `HTTP ${res.status}`, detail: text.slice(0, 300) };
    }
    return { ok: true, status: res.status, duration_ms: duration, error: null, detail: p.result };
  } catch (err) {
    return {
      ok: false,
      status: null,
      duration_ms: Date.now() - started,
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

  const initialize = await rpc(endpoint, "initialize", {
    protocolVersion: "2025-03-26",
    capabilities: {},
    clientInfo: { name: "maison-affluency-health-check", version: "1.0.0" },
  }, 1);

  const toolsList = await rpc(endpoint, "tools/list", {}, 2);

  const toolNames: string[] = [];
  if (toolsList.ok && toolsList.detail && typeof toolsList.detail === "object") {
    const tools = (toolsList.detail as { tools?: Array<{ name?: string }> }).tools;
    if (Array.isArray(tools)) {
      for (const t of tools) if (t?.name) toolNames.push(t.name);
    }
  }
  const missingTools = EXPECTED_TOOLS.filter((t) => !toolNames.includes(t));

  const serverInfo = initialize.ok && initialize.detail && typeof initialize.detail === "object"
    ? (initialize.detail as { serverInfo?: unknown }).serverInfo ?? null
    : null;

  const healthy = initialize.ok && toolsList.ok && missingTools.length === 0;

  return new Response(JSON.stringify({
    healthy,
    endpoint,
    checked_at: new Date().toISOString(),
    checks: {
      initialize: { ok: initialize.ok, status: initialize.status, duration_ms: initialize.duration_ms, error: initialize.error, serverInfo },
      tools_list: { ok: toolsList.ok, status: toolsList.status, duration_ms: toolsList.duration_ms, error: toolsList.error },
    },
    tools: toolNames,
    missing_expected_tools: missingTools,
  }), {
    status: healthy ? 200 : 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
