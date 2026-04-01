import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Step 1 – Exchange short-lived token → long-lived token (60 days)
 * Step 2 – Fetch recent media from the Instagram Graph API
 * Step 3 – Upsert into designer_instagram_posts
 *
 * Body: { designerId: string, igUserId?: string, action?: "exchange_token" | "sync" }
 */

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { designerId, igUserId, action = "sync" } = await req.json();

    // ── Exchange token ──────────────────────────────────────────────
    if (action === "exchange_token") {
      const shortToken = Deno.env.get("META_ACCESS_TOKEN");
      const appId = Deno.env.get("META_APP_ID");
      const appSecret = Deno.env.get("META_APP_SECRET");

      if (!shortToken || !appId || !appSecret) {
        return new Response(
          JSON.stringify({ success: false, error: "Missing Meta credentials in secrets" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const url = `https://graph.facebook.com/v21.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${appId}&client_secret=${appSecret}&fb_exchange_token=${encodeURIComponent(shortToken)}`;

      const res = await fetch(url);
      const data = await res.json();

      if (data.error) {
        console.error("Token exchange error:", data.error);
        return new Response(
          JSON.stringify({ success: false, error: data.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // data.access_token is the long-lived token (60 days)
      // data.expires_in is seconds (~5184000 for 60 days)
      const longToken = data.access_token;
      const expiresIn = data.expires_in;

      console.log(`Token exchanged successfully. Expires in ${Math.round(expiresIn / 86400)} days.`);

      return new Response(
        JSON.stringify({
          success: true,
          longLivedToken: longToken,
          expiresInDays: Math.round(expiresIn / 86400),
          message: "Save this long-lived token as META_ACCESS_TOKEN secret to replace the short-lived one.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // ── Sync Instagram media ────────────────────────────────────────
    if (!designerId) {
      return new Response(
        JSON.stringify({ success: false, error: "designerId is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const accessToken = Deno.env.get("META_ACCESS_TOKEN");
    if (!accessToken) {
      return new Response(
        JSON.stringify({ success: false, error: "META_ACCESS_TOKEN not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // If no igUserId provided, discover it from /me/accounts → IG business account
    let instagramUserId = igUserId;

    if (!instagramUserId) {
      // Get pages the user manages
      const pagesRes = await fetch(
        `https://graph.facebook.com/v21.0/me/accounts?fields=id,name,instagram_business_account&access_token=${accessToken}`,
      );
      const pagesData = await pagesRes.json();

      if (pagesData.error) {
        return new Response(
          JSON.stringify({ success: false, error: `Pages API: ${pagesData.error.message}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      // Find the first page with an IG business account
      const pageWithIG = pagesData.data?.find(
        (p: { instagram_business_account?: { id: string } }) => p.instagram_business_account?.id,
      );

      if (!pageWithIG) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "No Instagram Business Account found linked to your Facebook Pages.",
            pages: pagesData.data?.map((p: { id: string; name: string }) => ({ id: p.id, name: p.name })),
          }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      instagramUserId = pageWithIG.instagram_business_account.id;
      console.log(`Discovered IG Business Account: ${instagramUserId} from page "${pageWithIG.name}"`);
    }

    // Fetch recent media
    const mediaRes = await fetch(
      `https://graph.facebook.com/v21.0/${instagramUserId}/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=25&access_token=${accessToken}`,
    );
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      return new Response(
        JSON.stringify({ success: false, error: `Media API: ${mediaData.error.message}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const posts = mediaData.data || [];
    console.log(`Fetched ${posts.length} posts from Instagram`);

    // Filter to IMAGE and CAROUSEL_ALBUM (skip VIDEO-only)
    const imagePosts = posts.filter(
      (p: { media_type: string }) => p.media_type === "IMAGE" || p.media_type === "CAROUSEL_ALBUM",
    );

    // Upsert posts into designer_instagram_posts
    let inserted = 0;
    let skipped = 0;

    for (let i = 0; i < imagePosts.length; i++) {
      const post = imagePosts[i];
      const postUrl = post.permalink;

      // Check if already exists
      const { data: existing } = await supabase
        .from("designer_instagram_posts")
        .select("id")
        .eq("post_url", postUrl)
        .eq("designer_id", designerId)
        .maybeSingle();

      if (existing) {
        skipped++;
        continue;
      }

      // Download and re-host the image to our storage
      const imageUrl = post.media_url || post.thumbnail_url;
      let storedImageUrl: string | null = null;

      if (imageUrl) {
        try {
          const imgRes = await fetch(imageUrl);
          if (imgRes.ok) {
            const blob = await imgRes.blob();
            const ext = blob.type?.includes("png") ? "png" : "jpg";
            const path = `instagram-posts/${Date.now()}-${crypto.randomUUID()}.${ext}`;
            const arrayBuffer = await blob.arrayBuffer();

            const { error: uploadError } = await supabase.storage
              .from("assets")
              .upload(path, arrayBuffer, { contentType: blob.type || "image/jpeg", upsert: false });

            if (!uploadError) {
              const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
              storedImageUrl = urlData.publicUrl;
            }
          }
        } catch (err) {
          console.warn(`Failed to re-host image for ${postUrl}:`, err);
        }
      }

      const { error: insertError } = await supabase.from("designer_instagram_posts").insert({
        designer_id: designerId,
        post_url: postUrl,
        caption: post.caption?.substring(0, 500) || null,
        image_url: storedImageUrl,
        sort_order: i,
      });

      if (insertError) {
        console.warn(`Insert error for ${postUrl}:`, insertError.message);
      } else {
        inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        instagramUserId,
        totalFetched: posts.length,
        imagePosts: imagePosts.length,
        inserted,
        skipped,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
