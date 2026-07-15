// MCP click redirector. Logs every click sent by the public MCP catalog server
// then 302-redirects to the real destination on maisonaffluency.com.
//
// The URL pattern is `/functions/v1/mcp-click?to=<product|designer|signup>&...`
// - to=product&slug=<designer-slug>&pick=<pick-id> -> /designers/<slug>?pick=<id>
// - to=designer&slug=<designer-slug>               -> /designers/<slug>
// - to=signup                                       -> /trade-program
//
// IP is stored as a SHA-256 hash so we can distinguish sessions without
// retaining raw addresses.

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SITE_ORIGIN = "https://www.maisonaffluency.com";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function isSlug(v: string | null): v is string {
  return !!v && /^[a-z0-9-]{1,120}$/i.test(v);
}
function isUuid(v: string | null): v is string {
  return !!v && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const url = new URL(req.url);
  const to = url.searchParams.get("to");
  const slug = url.searchParams.get("slug");
  const pick = url.searchParams.get("pick");

  let destination: string;
  let click_type: "product" | "designer" | "signup";
  let pick_id: string | null = null;
  let designer_slug: string | null = null;

  if (to === "signup") {
    click_type = "signup";
    destination = `${SITE_ORIGIN}/trade-program`;
  } else if (to === "designer" && isSlug(slug)) {
    click_type = "designer";
    designer_slug = slug;
    destination = `${SITE_ORIGIN}/designers/${slug}`;
  } else if (to === "product" && isSlug(slug) && isUuid(pick)) {
    click_type = "product";
    designer_slug = slug;
    pick_id = pick;
    destination = `${SITE_ORIGIN}/designers/${slug}?pick=${pick}`;
  } else {
    // Malformed link — fall back to the homepage but do not log a bogus event.
    return Response.redirect(SITE_ORIGIN, 302);
  }

  const ip =
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "";
  const ip_hash = ip ? await sha256(ip + "|maison-affluency-mcp") : null;
  const user_agent = req.headers.get("user-agent")?.slice(0, 500) ?? null;
  const referer = req.headers.get("referer")?.slice(0, 500) ?? null;

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    await supabase
      .from("mcp_click_log")
      .insert({ click_type, pick_id, designer_slug, ip_hash, user_agent, referer });
  } catch (e) {
    // Analytics failure must never block the redirect.
    console.error("[mcp-click] log failed:", e);
  }

  return Response.redirect(destination, 302);
});
