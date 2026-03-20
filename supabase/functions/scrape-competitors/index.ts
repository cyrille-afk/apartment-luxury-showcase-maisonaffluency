import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const AUCTION_HOUSES = ["Phillips", "Christie's", "Piasa", "Sotheby's"];

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

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
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

    // Scrape each gallery for designer roster
    for (const gallery of galleries) {
      try {
        console.log(`Scraping gallery: ${gallery.name} — ${gallery.website_url}`);

        // Use Firecrawl to scrape the gallery website
        const scrapeRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            url: gallery.website_url,
            formats: ["markdown", "links"],
            onlyMainContent: true,
          }),
        });

        const scrapeData = await scrapeRes.json();
        const markdown = scrapeData?.data?.markdown || scrapeData?.markdown || "";
        const links = scrapeData?.data?.links || scrapeData?.links || [];

        // Try to find an artists/designers page
        const artistPageUrl = links.find((l: string) =>
          /artist|designer|roster|represented/i.test(l)
        );

        let designerMarkdown = markdown;

        if (artistPageUrl) {
          console.log(`Found artist page: ${artistPageUrl}`);
          const artistRes = await fetch("https://api.firecrawl.dev/v1/scrape", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              url: artistPageUrl,
              formats: ["markdown"],
              onlyMainContent: true,
            }),
          });
          const artistData = await artistRes.json();
          designerMarkdown = artistData?.data?.markdown || artistData?.markdown || markdown;
        }

        // Extract designer names using simple heuristic: lines that look like names
        const designerNames = extractDesignerNames(designerMarkdown);

        // Check overlap with our own designers from trade_products
        const { data: ourProducts } = await serviceClient
          .from("trade_products")
          .select("brand_name")
          .eq("is_active", true);

        const ourBrands = new Set(
          (ourProducts || []).map((p: any) => p.brand_name.toLowerCase().trim())
        );

        // Clear old designers for this gallery
        await serviceClient
          .from("competitor_designers")
          .delete()
          .eq("gallery_id", gallery.id);

        // Insert new designers
        if (designerNames.length > 0) {
          const designerRows = designerNames.map((name: string) => ({
            gallery_id: gallery.id,
            designer_name: name,
            is_overlap: ourBrands.has(name.toLowerCase().trim()),
            profile_url: artistPageUrl || gallery.website_url,
          }));

          await serviceClient.from("competitor_designers").insert(designerRows);
        }

        // Update gallery scrape status
        await serviceClient
          .from("competitor_galleries")
          .update({
            last_scraped_at: new Date().toISOString(),
            scrape_status: "completed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", gallery.id);

        results.push({
          gallery: gallery.name,
          designers_found: designerNames.length,
          status: "success",
        });
      } catch (err) {
        console.error(`Failed to scrape ${gallery.name}:`, err);
        await serviceClient
          .from("competitor_galleries")
          .update({ scrape_status: "error", updated_at: new Date().toISOString() })
          .eq("id", gallery.id);

        results.push({
          gallery: gallery.name,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }

    // Scrape auction results using Firecrawl search
    const auctionResults: any[] = [];
    for (const house of AUCTION_HOUSES) {
      try {
        console.log(`Searching auction data for: ${house}`);
        const searchRes = await fetch("https://api.firecrawl.dev/v1/search", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            query: `${house} design auction results collectible furniture 2024 2025`,
            limit: 5,
            scrapeOptions: { formats: ["markdown"] },
          }),
        });

        const searchData = await searchRes.json();
        const searchResults = searchData?.data || [];

        // Extract auction lots from search results
        for (const result of searchResults) {
          const lots = extractAuctionLots(
            result.markdown || "",
            house,
            result.url || ""
          );
          if (lots.length > 0) {
            await serviceClient.from("auction_benchmarks").insert(lots);
            auctionResults.push(...lots);
          }
        }
      } catch (err) {
        console.error(`Failed to search auctions for ${house}:`, err);
      }
    }

    // Send admin email summary
    const totalDesigners = results.reduce((sum: number, r: any) => sum + (r.designers_found || 0), 0);
    const successfulGalleries = results.filter((r: any) => r.status === "success");
    const failedGalleries = results.filter((r: any) => r.status === "error");

    const ADMIN_EMAILS = [
      "cyrille@maisonaffluency.com",
      "gregoire@maisonaffluency.com",
    ];

    const galleryRows = results
      .map((r: any) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;">${r.gallery}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;text-align:center;">${r.designers_found ?? "—"}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e5e5;text-align:center;color:${r.status === "success" ? "#2d6a4f" : "#c1121f"};">${r.status}</td></tr>`)
      .join("");

    const emailHtml = `
      <div style="font-family: Georgia, serif; max-width: 640px; margin: 0 auto; padding: 32px; background: #faf9f6;">
        <h2 style="font-size: 20px; color: #1a1a1a; margin-bottom: 4px;">Competitive Intelligence — Weekly Scrape Complete</h2>
        <p style="font-size: 13px; color: #888; margin-top: 0;">${new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}</p>
        <div style="display: flex; gap: 16px; margin: 24px 0;">
          <div style="background: #fff; border-radius: 8px; padding: 16px 20px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${totalDesigners}</div>
            <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Designers Found</div>
          </div>
          <div style="background: #fff; border-radius: 8px; padding: 16px 20px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 28px; font-weight: 700; color: #1a1a1a;">${auctionResults.length}</div>
            <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Auction Lots</div>
          </div>
          <div style="background: #fff; border-radius: 8px; padding: 16px 20px; flex: 1; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <div style="font-size: 28px; font-weight: 700; color: ${failedGalleries.length > 0 ? "#c1121f" : "#2d6a4f"};">${successfulGalleries.length}/${results.length}</div>
            <div style="font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 0.5px;">Galleries Scraped</div>
          </div>
        </div>
        <table style="width: 100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <thead><tr style="background: #1a1a1a; color: #fff;">
            <th style="padding: 10px 12px; text-align: left; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Gallery</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Designers</th>
            <th style="padding: 10px 12px; text-align: center; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
          </tr></thead>
          <tbody>${galleryRows}</tbody>
        </table>
        <p style="font-size: 13px; color: #555; margin-top: 24px; line-height: 1.6;">
          View the full analysis in <a href="https://www.maisonaffluency.com/trade/insights" style="color: #b8860b;">Trade Insights → Competitive Intelligence</a>.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
        <p style="font-size: 11px; color: #999;">Maison Affluency · Automated Competitive Intelligence Report</p>
      </div>
    `;

    for (const email of ADMIN_EMAILS) {
      try {
        await serviceClient.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload: {
            to: email,
            subject: `Competitive Intel: ${totalDesigners} designers, ${auctionResults.length} auction lots collected`,
            html: emailHtml,
            from_name: "Maison Affluency Intelligence",
          },
        });
      } catch (e) {
        console.error(`Failed to enqueue scrape summary to ${email}:`, e);
      }
    }

    // Also send in-app notifications
    const { data: adminRoles } = await serviceClient
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (adminRoles && adminRoles.length > 0) {
      const notifications = adminRoles.map((r: any) => ({
        user_id: r.user_id,
        type: "competitor_scrape",
        title: "Weekly competitive scrape complete",
        message: `Found ${totalDesigners} designers across ${successfulGalleries.length} galleries and ${auctionResults.length} auction lots.`,
        link: "/trade/insights",
      }));
      await serviceClient.from("notifications").insert(notifications);
    }

    return new Response(
      JSON.stringify({
        success: true,
        galleries: results,
        auction_lots_found: auctionResults.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Scrape error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Failed to scrape",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function extractDesignerNames(markdown: string): string[] {
  const lines = markdown.split("\n").map((l) => l.trim()).filter(Boolean);
  const names: string[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    // Clean markdown formatting
    const clean = line
      .replace(/^#{1,6}\s*/, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`]/g, "")
      .trim();

    // Skip lines that are too long (likely paragraphs), too short, or have common non-name patterns
    if (clean.length < 3 || clean.length > 60) continue;
    if (/\d{4}|©|@|http|www\.|\.com|click|view|read|more|about|contact|exhibit/i.test(clean)) continue;

    // Check if it looks like a name (2-4 capitalized words)
    const words = clean.split(/\s+/);
    if (words.length >= 2 && words.length <= 5) {
      const allCapitalized = words.every(
        (w) => /^[A-Z]/.test(w) || w.length <= 3
      );
      if (allCapitalized) {
        const key = clean.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          names.push(clean);
        }
      }
    }
  }

  return names;
}

function extractAuctionLots(
  markdown: string,
  auctionHouse: string,
  sourceUrl: string
): any[] {
  const lots: any[] = [];
  const lines = markdown.split("\n");

  // Look for patterns like: "Designer Name — Piece Title — Estimate: $X,XXX - $Y,YYY — Sold: $Z,ZZZ"
  // Or simpler patterns with price data
  const pricePattern = /(?:USD|US\$|\$|€|£|GBP|EUR)\s?[\d,]+/gi;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const prices = line.match(pricePattern);
    if (!prices || prices.length === 0) continue;

    // Extract numeric values
    const amounts = prices.map((p: string) =>
      parseInt(p.replace(/[^0-9]/g, ""), 10)
    ).filter((n: number) => n > 100 && n < 50000000);

    if (amounts.length === 0) continue;

    // Try to extract designer/piece from the line or preceding lines
    const cleanLine = line
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/[*_`#]/g, "")
      .trim();

    // Get contextual text from surrounding lines
    const contextLines = lines
      .slice(Math.max(0, i - 2), i + 1)
      .map((l) => l.replace(/[*_`#\[\]()]/g, "").trim())
      .filter(Boolean);

    const contextText = contextLines.join(" ");

    // Try to find a designer name (capitalized words before a dash or colon)
    const nameMatch = contextText.match(
      /([A-Z][a-z]+ (?:[A-Z][a-z]+\s?){0,3})/
    );
    const designerName = nameMatch ? nameMatch[1].trim() : "Unknown Designer";

    lots.push({
      auction_house: auctionHouse,
      designer_name: designerName,
      piece_title: cleanLine.substring(0, 200),
      estimate_low_usd: amounts.length >= 2 ? Math.min(...amounts) : null,
      estimate_high_usd: amounts.length >= 2 ? Math.max(...amounts.slice(0, 2)) : null,
      sold_price_usd: amounts.length >= 3 ? amounts[amounts.length - 1] : amounts[0],
      lot_url: sourceUrl,
      currency: "USD",
    });
  }

  // Limit to top 10 most relevant lots per auction house
  return lots.slice(0, 10);
}
