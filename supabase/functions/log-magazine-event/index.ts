import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const getCountryFromHeaders = (req: Request) => {
  const headerCountry =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code") ||
    "";
  if (!headerCountry) return "";
  if (headerCountry.length === 2) {
    try {
      return (
        new Intl.DisplayNames(["en"], { type: "region" }).of(
          headerCountry.toUpperCase(),
        ) || headerCountry.toUpperCase()
      );
    } catch {
      return headerCountry.toUpperCase();
    }
  }
  return headerCountry;
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const {
      documentId = null,
      label = "",
      eventType,
      source = "",
    } = await req.json();

    if (eventType !== "impression" && eventType !== "click") {
      return new Response(JSON.stringify({ error: "Invalid eventType" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Best-effort user resolution from JWT
    let userId: string | null = null;
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      const token = authHeader.replace(/^Bearer\s+/i, "");
      try {
        const { data } = await admin.auth.getClaims(token);
        userId = (data?.claims?.sub as string) || null;
      } catch {
        userId = null;
      }
    }

    const country = getCountryFromHeaders(req);

    const { error } = await admin.from("magazine_badge_events").insert({
      document_id: documentId,
      document_label: label,
      event_type: eventType,
      source,
      country,
      user_id: userId,
    });

    if (error) {
      console.error("[log-magazine-event] insert failed", error);
      return new Response(JSON.stringify({ error: "Failed to log" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (e) {
    console.error("[log-magazine-event] error", e);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});
