import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * For CAROUSEL_ALBUM posts the top-level media_url may be absent or a
 * low-res thumbnail. Fetch the first child's full-size media_url instead.
 */
async function getFullSizeImageUrl(
  post: Record<string, any>,
  accessToken: string,
): Promise<string | null> {
  // IMAGE posts: media_url is already full-size
  if (post.media_type === "IMAGE" && post.media_url) {
    return post.media_url;
  }

  // CAROUSEL_ALBUM: fetch the first child media to get its full-size URL
  if (post.media_type === "CAROUSEL_ALBUM") {
    try {
      const childrenRes = await fetch(
        `https://graph.instagram.com/v21.0/${post.id}/children?fields=id,media_type,media_url&access_token=${accessToken}`,
      );
      const childrenData = await childrenRes.json();
      if (childrenData.data?.length) {
        // Prefer the first IMAGE child
        const imageChild = childrenData.data.find(
          (c: any) => c.media_type === "IMAGE",
        ) || childrenData.data[0];
        if (imageChild?.media_url) {
          return imageChild.media_url;
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch carousel children for ${post.id}:`, err);
    }
    // Fallback to top-level media_url if children fetch fails
    return post.media_url || post.thumbnail_url || null;
  }

  // Fallback for any other type
  return post.media_url || post.thumbnail_url || null;
}

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

    // Sort by timestamp descending (newest first)
    imagePosts.sort((a: { timestamp: string }, b: { timestamp: string }) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (let i = 0; i < imagePosts.length; i++) {
      const post = imagePosts[i];
      const postUrl = post.permalink;
      const postedAt = post.timestamp || null;

      // Check if already exists
      const { data: existing } = await supabase
        .from("designer_instagram_posts")
        .select("id, posted_at")
        .eq("post_url", postUrl)
        .eq("designer_id", designerId)
        .maybeSingle();

      if (existing) {
        // Always update posted_at if missing (backfill)
        if (!existing.posted_at && postedAt) {
          await supabase
            .from("designer_instagram_posts")
            .update({ posted_at: postedAt })
            .eq("id", existing.id);
          updated++;
        } else {
          skipped++;
        }
        continue;
      }

      // Get full-size image URL (handles CAROUSEL_ALBUM children)
      const imageUrl = await getFullSizeImageUrl(post, accessToken);
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
        posted_at: postedAt,
        sort_order: 0, // temporary, recomputed below
      });

      if (insertError) {
        console.warn(`Insert error for ${postUrl}:`, insertError.message);
      } else {
        inserted++;
      }
    }

    // Recompute sort_order for ALL posts of this designer based on
    // posted_at (Instagram publish time), falling back to created_at.
    // sort_order 0 = newest post.
    const { data: allPosts } = await supabase
      .from("designer_instagram_posts")
      .select("id, posted_at, created_at")
      .eq("designer_id", designerId)
      .not("image_url", "is", null);

    if (allPosts) {
      // Sort by posted_at desc, fallback to created_at desc
      allPosts.sort((a: any, b: any) => {
        const dateA = new Date(a.posted_at || a.created_at).getTime();
        const dateB = new Date(b.posted_at || b.created_at).getTime();
        return dateB - dateA;
      });

      for (let idx = 0; idx < allPosts.length; idx++) {
        await supabase
          .from("designer_instagram_posts")
          .update({ sort_order: idx })
          .eq("id", allPosts[idx].id);
      }
      console.log(`Recomputed sort_order for ${allPosts.length} posts`);
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalFetched: posts.length,
        imagePosts: imagePosts.length,
        inserted,
        updated,
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
