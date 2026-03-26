import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface UserSignals {
  user_id: string;
  email: string;
  first_name: string;
  last_name: string;
  company: string;
  brands: Record<string, number>;
  categories: Record<string, number>;
  materials: Record<string, number>;
  designers: Record<string, number>;
  total_favorites: number;
  total_quotes: number;
  total_samples: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) {
    return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // 1. Get all trade users
    const { data: tradeUsers } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "trade_user");

    if (!tradeUsers || tradeUsers.length === 0) {
      return new Response(
        JSON.stringify({ message: "No trade users found", processed: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userIds = tradeUsers.map((u: any) => u.user_id);

    // 2. Fetch profiles
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, email, first_name, last_name, company")
      .in("id", userIds);

    const profileMap = new Map(
      (profiles || []).map((p: any) => [p.id, p])
    );

    // 3. Fetch all favorites with product details
    const { data: favorites } = await supabase
      .from("trade_favorites")
      .select("user_id, product_id, trade_products(brand_name, category, subcategory, materials, product_name)")
      .in("user_id", userIds);

    // 4. Fetch all quote items with product details
    const { data: quoteItems } = await supabase
      .from("trade_quote_items")
      .select("quote_id, product_id, trade_products(brand_name, category, subcategory, materials, product_name), trade_quotes(user_id)")
      .limit(1000);

    // 5. Fetch sample requests
    const { data: samples } = await supabase
      .from("trade_sample_requests")
      .select("user_id, brand_name, product_name")
      .in("user_id", userIds);

    // 6. Fetch designer curator picks to map brands to designers
    const { data: designerPicks } = await supabase
      .from("designer_curator_picks")
      .select("designer_id, title, designers(name)")
      .limit(1000);

    // Build brand → designer mapping
    const brandToDesigner = new Map<string, string>();
    for (const pick of designerPicks || []) {
      const designerName = (pick as any).designers?.name;
      if (designerName) {
        brandToDesigner.set(designerName, designerName);
      }
    }

    // 7. Aggregate signals per user
    const userSignals = new Map<string, UserSignals>();

    const getOrCreate = (userId: string): UserSignals => {
      if (!userSignals.has(userId)) {
        const profile = profileMap.get(userId) || {};
        userSignals.set(userId, {
          user_id: userId,
          email: (profile as any).email || "",
          first_name: (profile as any).first_name || "",
          last_name: (profile as any).last_name || "",
          company: (profile as any).company || "",
          brands: {},
          categories: {},
          materials: {},
          designers: {},
          total_favorites: 0,
          total_quotes: 0,
          total_samples: 0,
        });
      }
      return userSignals.get(userId)!;
    };

    // Process favorites
    for (const fav of favorites || []) {
      const signals = getOrCreate(fav.user_id);
      signals.total_favorites++;
      const product = (fav as any).trade_products;
      if (product) {
        signals.brands[product.brand_name] = (signals.brands[product.brand_name] || 0) + 1;
        if (product.category) signals.categories[product.category] = (signals.categories[product.category] || 0) + 1;
        if (product.subcategory) signals.categories[product.subcategory] = (signals.categories[product.subcategory] || 0) + 1;
        if (product.materials) {
          for (const mat of product.materials.split(/[,;]/)) {
            const m = mat.trim().toLowerCase();
            if (m) signals.materials[m] = (signals.materials[m] || 0) + 1;
          }
        }
      }
    }

    // Process quote items
    for (const item of quoteItems || []) {
      const userId = (item as any).trade_quotes?.user_id;
      if (!userId || !userIds.includes(userId)) continue;
      const signals = getOrCreate(userId);
      signals.total_quotes++;
      const product = (item as any).trade_products;
      if (product) {
        signals.brands[product.brand_name] = (signals.brands[product.brand_name] || 0) + 2; // weight quotes higher
        if (product.category) signals.categories[product.category] = (signals.categories[product.category] || 0) + 2;
        if (product.materials) {
          for (const mat of product.materials.split(/[,;]/)) {
            const m = mat.trim().toLowerCase();
            if (m) signals.materials[m] = (signals.materials[m] || 0) + 2;
          }
        }
      }
    }

    // Process samples (highest intent)
    for (const sample of samples || []) {
      const signals = getOrCreate(sample.user_id);
      signals.total_samples++;
      signals.brands[sample.brand_name] = (signals.brands[sample.brand_name] || 0) + 3;
    }

    // 8. For each user with enough data, ask AI to classify
    const results: any[] = [];

    for (const [userId, signals] of userSignals) {
      const totalInteractions = signals.total_favorites + signals.total_quotes + signals.total_samples;

      // Sort and take top entries
      const topBrands = Object.entries(signals.brands).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
      const topCategories = Object.entries(signals.categories).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);
      const topMaterials = Object.entries(signals.materials).sort((a, b) => b[1] - a[1]).slice(0, 5).map(e => e[0]);

      if (totalInteractions < 2) {
        // Not enough data — store minimal profile
        await supabase.from("client_taste_profiles").upsert({
          user_id: userId,
          cluster_label: "New Client",
          cluster_description: "Not enough interaction data yet to determine taste profile.",
          top_brands: topBrands,
          top_categories: topCategories,
          top_materials: topMaterials,
          top_designers: [],
          style_keywords: [],
          engagement_score: totalInteractions,
          total_favorites: signals.total_favorites,
          total_quotes: signals.total_quotes,
          total_samples: signals.total_samples,
          raw_signals: { brands: signals.brands, categories: signals.categories, materials: signals.materials },
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });
        results.push({ user_id: userId, label: "New Client", skipped: true });
        continue;
      }

      // Build AI prompt
      const prompt = `You are a luxury design taste analyst for Maison Affluency, a curated gallery of collectible furniture and objets d'art.

Analyze this client's behavioral signals and classify their taste profile.

Client: ${signals.first_name} ${signals.last_name} (${signals.company})
Favorites: ${signals.total_favorites} | Quote requests: ${signals.total_quotes} | Sample requests: ${signals.total_samples}

Top brands they engage with: ${topBrands.join(", ") || "none"}
Top categories: ${topCategories.join(", ") || "none"}
Top materials: ${topMaterials.join(", ") || "none"}

Raw brand engagement scores: ${JSON.stringify(signals.brands)}
Raw category scores: ${JSON.stringify(signals.categories)}

Respond in this exact JSON format:
{
  "cluster_label": "A short evocative label (e.g. 'Brutalist Minimalist', 'Art Deco Maximalist', 'Organic Modernist', 'French Heritage Collector', 'Material Sensualist')",
  "cluster_description": "2-3 sentences describing this client's aesthetic sensibility, what drives their choices, and how to curate for them.",
  "style_keywords": ["keyword1", "keyword2", "keyword3", "keyword4", "keyword5"],
  "top_designers": ["designer names they likely gravitate toward based on brand/category patterns"]
}`;

      try {
        const aiResp = await fetch("https://ai-gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" },
          }),
        });

        if (!aiResp.ok) {
          console.error(`AI call failed for ${userId}: ${aiResp.status}`);
          results.push({ user_id: userId, error: `AI ${aiResp.status}` });
          continue;
        }

        const aiData = await aiResp.json();
        const content = aiData.choices?.[0]?.message?.content;
        const parsed = JSON.parse(content);

        await supabase.from("client_taste_profiles").upsert({
          user_id: userId,
          cluster_label: parsed.cluster_label || "Unclassified",
          cluster_description: parsed.cluster_description || "",
          top_brands: topBrands,
          top_categories: topCategories,
          top_materials: topMaterials,
          top_designers: parsed.top_designers || [],
          style_keywords: parsed.style_keywords || [],
          engagement_score: totalInteractions,
          total_favorites: signals.total_favorites,
          total_quotes: signals.total_quotes,
          total_samples: signals.total_samples,
          raw_signals: { brands: signals.brands, categories: signals.categories, materials: signals.materials },
          computed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }, { onConflict: "user_id" });

        results.push({ user_id: userId, label: parsed.cluster_label });
      } catch (err) {
        console.error(`Error processing ${userId}:`, err);
        results.push({ user_id: userId, error: String(err) });
      }
    }

    return new Response(
      JSON.stringify({ processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Compute taste profiles error:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
