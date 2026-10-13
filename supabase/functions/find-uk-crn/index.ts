import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// UK CRN: 8 chars — digits, or 2-letter prefix (SC, NI, OC, SO, NC, LP, SL, R0...) + 6 digits
const CRN_URL = /find-and-update\.company-information\.service\.gov\.uk\/company\/([A-Z0-9]{8})/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claims, error: ce } = await supabase.auth.getClaims(authHeader.slice(7));
    if (ce || !claims?.claims) return json({ error: "Unauthorized" }, 401);
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", claims.claims.sub);
    if (!roles?.some((r: any) => r.role === "admin" || r.role === "super_admin")) return json({ error: "Admin access required" }, 403);

    const body = await req.json().catch(() => ({}));
    const name = typeof body?.company_name === "string" ? body.company_name.trim() : "";
    if (name.length < 2 || name.length > 200) return json({ error: "company_name is required" }, 400);

    const key = Deno.env.get("FIRECRAWL_API_KEY");
    if (!key) return json({ error: "Web lookup is not configured" }, 500);

    const res = await fetch("https://api.firecrawl.dev/v2/search", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        query: `"${name.replace(/"/g, "")}" site:find-and-update.company-information.service.gov.uk`,
        limit: 10,
        country: "GB",
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      console.error(`Firecrawl search failed [${res.status}]: ${text}`);
      return json({ error: "Web lookup failed", status: res.status }, 502);
    }
    const parsed = JSON.parse(text);
    const results: any[] = Array.isArray(parsed?.data) ? parsed.data : parsed?.data?.web ?? [];
    const seen = new Map<string, { crn: string; title: string; url: string; snippet: string }>();
    for (const r of results) {
      const m = String(r.url ?? "").match(CRN_URL);
      if (!m) continue;
      const crn = m[1].toUpperCase();
      if (seen.has(crn)) continue;
      const title = String(r.title ?? "").replace(/\s*-\s*(Find and update company information|Companies House).*$/i, "").replace(/\s*overview.*$/i, "").trim();
      seen.set(crn, {
        crn,
        title: title || crn,
        url: `https://find-and-update.company-information.service.gov.uk/company/${crn}`,
        snippet: String(r.description ?? "").slice(0, 240),
      });
    }
    return json({ candidates: [...seen.values()].slice(0, 6) });
  } catch (e) {
    console.error(e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
