import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const getCountryFromHeaders = (req: Request) => {
  const headerCountry =
    req.headers.get("cf-ipcountry") ||
    req.headers.get("x-vercel-ip-country") ||
    req.headers.get("x-country-code") ||
    "";

  if (headerCountry && headerCountry.length > 2) return headerCountry;

  if (headerCountry.length === 2) {
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(headerCountry.toUpperCase()) || headerCountry.toUpperCase();
    } catch {
      return headerCountry.toUpperCase();
    }
  }

  return "";
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }

  try {
    const { documentId = null, label = "", country = "", source = "public" } = await req.json();

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const resolvedCountry = country || getCountryFromHeaders(req);

    const { error } = await adminClient
      .from("public_download_events")
      .insert({
        document_id: documentId,
        document_label: label,
        country: resolvedCountry,
        source,
      });

    if (error) {
      console.error("[log-public-download] insert failed", error);
      return new Response(JSON.stringify({ error: "Failed to log download" }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[log-public-download] unexpected error", error);
    return new Response(JSON.stringify({ error: "Invalid request" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});