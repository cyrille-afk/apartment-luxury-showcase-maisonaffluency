// Shared auth helpers for edge functions.
// All Lovable Cloud edge functions deploy with verify_jwt = false,
// so we MUST validate JWTs in code via supabase.auth.getClaims(token).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

/** Fire-and-forget audit log for unauthorized/forbidden attempts. */
export function recordAuthFailure(
  req: Request,
  source: string,
  kind: "edge_unauthorized" | "edge_forbidden",
  userId?: string | null,
): void {
  try {
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return;
    const ip =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const payload = {
      _event_type: kind,
      _source: source,
      _user_id: userId ?? null,
      _ip: ip,
      _details: {
        path: new URL(req.url).pathname,
        method: req.method,
        ua: req.headers.get("user-agent") ?? null,
      },
    };
    // Fire-and-forget — do not await
    fetch(`${url}/rest/v1/rpc/record_security_event`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(payload),
    }).catch(() => {});
  } catch {
    /* swallow */
  }
}

export type AuthOk = {
  ok: true;
  userId: string;
  authHeader: string;
  claims: Record<string, unknown>;
};
export type AuthErr = { ok: false; status: number; body: { error: string } };

/** Require a valid JWT. Returns userId or a 401 response payload. */
export async function requireUser(
  req: Request,
  source = "unknown",
): Promise<AuthOk | AuthErr> {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    recordAuthFailure(req, source, "edge_unauthorized", null);
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  const token = authHeader.slice(7);
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
  );
  const { data, error } = await supabase.auth.getClaims(token);
  if (error || !data?.claims?.sub) {
    recordAuthFailure(req, source, "edge_unauthorized", null);
    return { ok: false, status: 401, body: { error: "Unauthorized" } };
  }
  return {
    ok: true,
    userId: String(data.claims.sub),
    authHeader,
    claims: data.claims as Record<string, unknown>,
  };
}

/** Require an admin or super_admin role. */
export async function requireAdmin(
  req: Request,
  source = "unknown",
): Promise<AuthOk | AuthErr> {
  const auth = await requireUser(req, source);
  if (!auth.ok) return auth;
  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { data, error } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", auth.userId)
    .in("role", ["admin", "super_admin"]);
  if (error || !data || data.length === 0) {
    recordAuthFailure(req, source, "edge_forbidden", auth.userId);
    return { ok: false, status: 403, body: { error: "Forbidden" } };
  }
  return auth;
}

/** Tiny in-memory per-IP / per-user rate limiter (best-effort, edge-instance scoped). */
const buckets = new Map<string, { count: number; resetAt: number }>();
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { ok: true } | { ok: false; retryInSec: number } {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true };
  }
  if (b.count >= limit) {
    return { ok: false, retryInSec: Math.ceil((b.resetAt - now) / 1000) };
  }
  b.count++;
  return { ok: true };
}

export function clientIp(req: Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}
