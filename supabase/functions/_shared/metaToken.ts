import { createClient } from "npm:@supabase/supabase-js@^2.108.2";

export const GRAPH = "https://graph.facebook.com/v21.0";

/** Saved admin-reconnected token wins; falls back to the META_ACCESS_TOKEN secret. */
export async function getMetaToken(): Promise<string | null> {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (url && key) {
    try {
      const db = createClient(url, key, { auth: { persistSession: false } });
      const { data } = await db.from("integration_tokens").select("access_token").eq("provider", "meta").maybeSingle();
      if (data?.access_token) return data.access_token;
    } catch { /* fall back */ }
  }
  return Deno.env.get("META_ACCESS_TOKEN") ?? null;
}

/** Facebook Login tokens address the linked IG account, not graph.instagram.com/me. */
export async function getInstagramAccount(token: string): Promise<{ id: string; username?: string }> {
  const response = await fetch(`${GRAPH}/me/accounts?fields=instagram_business_account{username}&limit=100&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
  const accounts = await response.json();
  if (accounts?.error) throw new Error(`Instagram connection needs reconnecting: ${accounts.error.message ?? "Meta rejected the login"}`);
  const ig = (accounts?.data ?? []).map((page: { instagram_business_account?: { id: string; username?: string } }) => page.instagram_business_account).find((account: { id?: string } | undefined) => account?.id);
  if (!ig?.id) throw new Error("No Instagram business account is linked to the saved Maison Affluency connection.");
  return ig;
}

export async function getInstagramMediaConnection(token: string): Promise<{ graph: string; accountId: string }> {
  try {
    const account = await getInstagramAccount(token);
    return { graph: GRAPH, accountId: account.id };
  } catch (error) {
    // Retain old Instagram Business Login installations only when that exact
    // secret was used; a rejected newly saved token must never switch logins.
    if (token !== Deno.env.get("META_ACCESS_TOKEN")) throw error;
    const graph = "https://graph.instagram.com/v21.0";
    const response = await fetch(`${graph}/me?fields=id&access_token=${encodeURIComponent(token)}`, { signal: AbortSignal.timeout(15000) });
    const account = await response.json();
    if (!response.ok || account.error || !account.id) throw error;
    return { graph, accountId: account.id };
  }
}

export type InstagramCheck = {
  state: "working" | "not_configured" | "invalid_token" | "no_business_account" | "error";
  message: string;
  igUsername?: string | null;
  expiresAt?: string | null;
};

/** Live end-to-end check: token valid, linked IG business account, business_discovery works. */
export async function checkInstagram(token: string | null): Promise<InstagramCheck> {
  if (!token) return { state: "not_configured", message: "No Instagram connection saved yet." };
  try {
    let expiresAt: string | null = null;
    const appId = Deno.env.get("META_APP_ID"), secret = Deno.env.get("META_APP_SECRET");
    if (appId && secret) {
      const dbg = await fetch(`${GRAPH}/debug_token?input_token=${encodeURIComponent(token)}&access_token=${appId}|${secret}`).then((r) => r.json());
      const d = dbg?.data;
      if (d && d.is_valid === false) return { state: "invalid_token", message: `Meta rejected the saved login (${d.error?.message ?? "invalid"}). Reconnect to resume automatic checks.` };
      if (d?.expires_at) expiresAt = new Date(d.expires_at * 1000).toISOString();
    }
    const ig = await getInstagramAccount(token);
    const probe = await fetch(`${GRAPH}/${ig.id}?fields=business_discovery.username(${encodeURIComponent(ig.username)}){username}&access_token=${encodeURIComponent(token)}`).then((r) => r.json());
    if (probe?.error) return { state: "error", message: probe.error.message ?? "Profile lookup failed.", igUsername: ig.username, expiresAt };
    return { state: "working", message: "Automatic Instagram checks are working.", igUsername: ig.username, expiresAt };
  } catch (e) {
    return { state: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
