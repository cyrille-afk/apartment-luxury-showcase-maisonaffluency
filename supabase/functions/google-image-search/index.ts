import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Authenticate caller
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  if (claimsError || !claimsData?.claims) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { query, start = 1 } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length === 0) {
      return new Response(JSON.stringify({ error: "Missing or empty 'query' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("GOOGLE_CSE_API_KEY");
    const cx = Deno.env.get("GOOGLE_CSE_CX");

    if (!apiKey) {
      throw new Error("GOOGLE_CSE_API_KEY is not configured");
    }
    if (!cx) {
      throw new Error("GOOGLE_CSE_CX is not configured");
    }

    const params = new URLSearchParams({
      key: apiKey,
      cx,
      q: query.trim(),
      searchType: "image",
      num: "10",
      start: String(Math.max(1, Number(start))),
      safe: "active",
      imgSize: "large",
    });

    const res = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`);
    const data = await res.json();

    if (!res.ok) {
      console.error("Google CSE API error:", JSON.stringify(data));
      throw new Error(`Google CSE API error [${res.status}]: ${data?.error?.message || "Unknown error"}`);
    }

    const results = (data.items || []).map((item: any) => ({
      title: item.title,
      link: item.link,
      thumbnail: item.image?.thumbnailLink,
      contextLink: item.image?.contextLink,
      width: item.image?.width,
      height: item.image?.height,
    }));

    return new Response(
      JSON.stringify({
        results,
        totalResults: data.searchInformation?.totalResults || "0",
        nextStart: data.queries?.nextPage?.[0]?.startIndex || null,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Google image search error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
