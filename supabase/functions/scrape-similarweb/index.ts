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

  try {
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
      { global: { headers: { Authorization: authHeader } } }
    );

    // Verify auth
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("FIRECRAWL_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Firecrawl not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: galleries } = await serviceClient
      .from("competitor_galleries")
      .select("*");

    if (!galleries || galleries.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No galleries to scrape" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];
    const currentMonth = new Date().toISOString().substring(0, 7) + "-01";

    for (const gallery of galleries) {
      try {
        // Extract domain from website_url
        const domain = new URL(gallery.website_url).hostname.replace(/^www\./, "");
        const similarWebUrl = `https://www.similarweb.com/website/${domain}/`;

        console.log(`Scraping SimilarWeb for: ${domain}`);

        const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: similarWebUrl,
            formats: ["markdown"],
            onlyMainContent: true,
            waitFor: 3000,
          }),
        });

        const scrapeData = await scrapeRes.json();
        const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";

        if (!markdown || markdown.length < 50) {
          console.log(`No SimilarWeb data for ${domain}`);
          results.push({ gallery: gallery.name, domain, status: "no_data" });
          continue;
        }

        // Parse traffic metrics from SimilarWeb markdown
        const metrics = parseSimilarWebMetrics(markdown);

        if (metrics.monthly_visits || metrics.bounce_rate || metrics.avg_duration_seconds) {
          await serviceClient
            .from("competitor_traffic")
            .upsert(
              {
                gallery_id: gallery.id,
                month: currentMonth,
                monthly_visits: metrics.monthly_visits,
                bounce_rate: metrics.bounce_rate,
                avg_duration_seconds: metrics.avg_duration_seconds,
                source: "similarweb_auto",
              },
              { onConflict: "gallery_id,month" }
            );

          results.push({
            gallery: gallery.name,
            domain,
            status: "success",
            metrics,
          });
        } else {
          results.push({ gallery: gallery.name, domain, status: "parse_failed" });
        }
      } catch (err) {
        console.error(`Failed to scrape SimilarWeb for ${gallery.name}:`, err);
        results.push({
          gallery: gallery.name,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("SimilarWeb scrape error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to scrape",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseSimilarWebMetrics(markdown: string): {
  monthly_visits: number | null;
  bounce_rate: number | null;
  avg_duration_seconds: number | null;
} {
  let monthly_visits: number | null = null;
  let bounce_rate: number | null = null;
  let avg_duration_seconds: number | null = null;

  // Match total visits patterns like "12.5K", "1.2M", "500", "Total Visits 12.5K"
  const visitPatterns = [
    /total\s*visits?\s*[:\-–]?\s*([\d,.]+)\s*([KMBkmb])?/i,
    /monthly\s*visits?\s*[:\-–]?\s*([\d,.]+)\s*([KMBkmb])?/i,
    /([\d,.]+)\s*([KMBkmb])?\s*(?:total\s*)?visits?/i,
  ];

  for (const pattern of visitPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      monthly_visits = parseAbbreviatedNumber(match[1], match[2]);
      break;
    }
  }

  // Match bounce rate patterns like "Bounce Rate 45.2%", "45.2% bounce"
  const bouncePatterns = [
    /bounce\s*rate\s*[:\-–]?\s*([\d.]+)\s*%/i,
    /([\d.]+)\s*%\s*bounce/i,
  ];

  for (const pattern of bouncePatterns) {
    const match = markdown.match(pattern);
    if (match) {
      bounce_rate = parseFloat(match[1]);
      if (bounce_rate > 100) bounce_rate = null;
      break;
    }
  }

  // Match avg visit duration patterns like "00:02:30", "2m 30s", "Avg. Visit Duration 00:02:30"
  const durationPatterns = [
    /(?:avg\.?\s*)?(?:visit\s*)?duration\s*[:\-–]?\s*(\d{1,2}):(\d{2}):(\d{2})/i,
    /(?:avg\.?\s*)?(?:visit\s*)?duration\s*[:\-–]?\s*(\d+)\s*m(?:in)?\s*(\d+)\s*s/i,
    /(\d{1,2}):(\d{2}):(\d{2})\s*(?:avg|duration)/i,
  ];

  for (const pattern of durationPatterns) {
    const match = markdown.match(pattern);
    if (match) {
      if (match[3] !== undefined) {
        // HH:MM:SS format
        avg_duration_seconds = parseInt(match[1]) * 3600 + parseInt(match[2]) * 60 + parseInt(match[3]);
      } else {
        // Xm Ys format
        avg_duration_seconds = parseInt(match[1]) * 60 + parseInt(match[2]);
      }
      break;
    }
  }

  return { monthly_visits, bounce_rate, avg_duration_seconds };
}

function parseAbbreviatedNumber(numStr: string, suffix?: string): number | null {
  const num = parseFloat(numStr.replace(/,/g, ""));
  if (isNaN(num)) return null;

  const multipliers: Record<string, number> = {
    k: 1_000,
    m: 1_000_000,
    b: 1_000_000_000,
  };

  const mult = suffix ? multipliers[suffix.toLowerCase()] || 1 : 1;
  return Math.round(num * mult);
}
