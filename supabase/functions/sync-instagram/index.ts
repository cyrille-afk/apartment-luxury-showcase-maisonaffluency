import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Sync Instagram posts using the Instagram Business Login API.
 * Uses graph.instagram.com endpoints (not Facebook Graph API).
 *
 * Body: { designerId: string }
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
    const { designerId } = await req.json();

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

    // Fetch recent media using Instagram Business Login API
    const mediaRes = await fetch(
      `https://graph.instagram.com/v21.0/me/media?fields=id,caption,media_type,media_url,permalink,thumbnail_url,timestamp&limit=25&access_token=${accessToken}`,
    );
    const mediaData = await mediaRes.json();

    if (mediaData.error) {
      return new Response(
        JSON.stringify({ success: false, error: `Instagram API: ${mediaData.error.message}` }),
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

      // Download and re-host the image to storage
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
            } else {
              console.warn(`Upload error for ${postUrl}:`, uploadError.message);
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
