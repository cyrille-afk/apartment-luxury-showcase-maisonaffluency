import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

/** QR sign-in tokens live 2 minutes and can be redeemed exactly once. */
export const MOBILE_SYNC_TTL_SECONDS = 120;

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Desktop: mint a one-time token for the signed-in caller (verified from their access token). */
export const issueMobileSyncToken = createServerFn({ method: "POST" })
  .validator(z.object({ accessToken: z.string().min(20).max(4096) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claims, error } = await supabaseAdmin.auth.getClaims(data.accessToken);
    const userId = claims?.claims?.sub;
    if (error || !userId || !claims?.claims?.email) throw new Error("Unauthorized");

    const token = randomToken();
    const expiresAt = new Date(Date.now() + MOBILE_SYNC_TTL_SECONDS * 1000);
    // Housekeeping: drop this user's expired or used tokens.
    await supabaseAdmin
      .from("mobile_sync_tokens")
      .delete()
      .eq("user_id", userId)
      .or(`expires_at.lt.${new Date().toISOString()},used_at.not.is.null`);
    const { error: insErr } = await supabaseAdmin.from("mobile_sync_tokens").insert({
      token_hash: await sha256Hex(token),
      user_id: userId,
      expires_at: expiresAt.toISOString(),
    });
    if (insErr) throw new Error("Could not create sign-in code");
    return { token, expiresAt: expiresAt.toISOString() };
  });

/** Phone: atomically consume the token and return a one-time Auth token hash to verify client-side. */
export const redeemMobileSyncToken = createServerFn({ method: "POST" })
  .validator(z.object({ token: z.string().min(20).max(128).regex(/^[A-Za-z0-9_-]+$/) }))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("mobile_sync_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("token_hash", await sha256Hex(data.token))
      .is("used_at", null)
      .gt("expires_at", new Date().toISOString())
      .select("user_id")
      .maybeSingle();
    if (!row) return { ok: false as const, reason: "expired" as const };

    const { data: u } = await supabaseAdmin.auth.admin.getUserById(row.user_id);
    const email = u?.user?.email;
    if (!email) return { ok: false as const, reason: "expired" as const };
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({ type: "magiclink", email });
    const tokenHash = link?.properties?.hashed_token;
    if (error || !tokenHash) return { ok: false as const, reason: "failed" as const };
    return { ok: true as const, tokenHash };
  });
