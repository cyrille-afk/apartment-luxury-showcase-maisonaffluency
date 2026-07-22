// Mints a short-lived Supabase magic link that signs the caller in on another
// device (phone) and lands them on a specific in-app path.
//
// - Requires an authenticated caller (validated via getClaims).
// - The magic link is issued for the caller's own email only (never for
//   another user).
// - `redirectTo` must be same-origin under /trade to prevent open redirects.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const ALLOWED_ORIGINS = [
  "https://maisonaffluency.com",
  "https://www.maisonaffluency.com",
  "https://apartment-luxury-showcase-maisonaffluency.lovable.app",
  "https://id-preview--02208d51-b513-401f-a97f-9e38a2a4260f.lovable.app",
];

function safeRedirect(input: unknown): string | null {
  if (typeof input !== "string" || !input) return null;
  let url: URL;
  try {
    url = new URL(input);
  } catch {
    return null;
  }
  if (!ALLOWED_ORIGINS.includes(url.origin)) return null;
  if (!url.pathname.startsWith("/trade") && url.pathname !== "/") return null;
  return url.toString();
}

/**
 * Wrap the caller-requested destination in a clean deep-link handoff route
 * (`/trade/launch?next=<path>`). That page waits for the Supabase session to
 * hydrate, invites installable-PWA install, then forwards to the real path.
 */
function buildHandoffUrl(target: string): string {
  const url = new URL(target);
  const nextPath = `${url.pathname}${url.search}${url.hash}` || "/trade";
  const launch = new URL("/trade/launch", url.origin);
  launch.searchParams.set("next", nextPath);
  return launch.toString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims?.sub || !claimsData.claims.email) {
      return json({ error: "Unauthorized" }, 401);
    }
    const email = String(claimsData.claims.email);

    const body = await req.json().catch(() => ({}));
    const redirectTo = safeRedirect(body?.redirectTo);
    if (!redirectTo) return json({ error: "Invalid redirectTo" }, 400);

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const handoffUrl = buildHandoffUrl(redirectTo);
    const { data, error } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { redirectTo: handoffUrl },
    });
    if (error || !data?.properties?.action_link) {
      return json({ error: error?.message ?? "Failed to mint link" }, 500);
    }

    // Supabase magic-link tokens expire per project setting (default 3600s).
    return json({
      url: data.properties.action_link,
      expiresIn: 3600,
      redirectTo: handoffUrl,
    });
  } catch (err) {
    return json({ error: (err as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
