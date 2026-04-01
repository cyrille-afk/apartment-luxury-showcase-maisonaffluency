import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_IMAGE_SIZE_BYTES = 20 * 1024 * 1024;

const extMap: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

const decodeHtmlEntities = (value: string) => value.replace(/&amp;/g, "&");

async function extractViaOembed(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}`;
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    return typeof data?.thumbnail_url === "string" ? decodeHtmlEntities(data.thumbnail_url) : null;
  } catch {
    return null;
  }
}

async function extractViaHtmlScrape(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!response.ok) return null;

    const html = await response.text();

    const ogMatch = html.match(/<meta\s+(?:[^>]*?)property=["']og:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)property=["']og:image["']/i);
    if (ogMatch?.[1]) return decodeHtmlEntities(ogMatch[1]);

    const twMatch = html.match(/<meta\s+(?:[^>]*?)name=["']twitter:image["']\s+content=["']([^"']+)["']/i)
      || html.match(/<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)name=["']twitter:image["']/i);
    if (twMatch?.[1]) return decodeHtmlEntities(twMatch[1]);

    return null;
  } catch {
    return null;
  }
}

async function downloadImage(candidateUrl: string) {
  const imageResponse = await fetch(candidateUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ImageProxy/1.0)",
      "Accept": "image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`);
  }

  const rawContentType = (imageResponse.headers.get("content-type") || "").trim();
  const contentType = rawContentType.split(";")[0].trim().toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(`Source did not return an image (content-type: ${rawContentType || "unknown"})`);
  }

  const blob = await imageResponse.blob();

  if (blob.size > MAX_IMAGE_SIZE_BYTES) {
    throw new Error("Image too large (max 20MB)");
  }

  if (blob.size === 0) {
    throw new Error("Fetched image is empty");
  }

  return { blob, contentType };
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
    const { url, postId } = await req.json();

    if (!url || !url.includes("instagram.com")) {
      return new Response(
        JSON.stringify({ success: false, error: "Valid Instagram URL is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const cleanUrl = url.trim().split("?")[0].replace(/\/$/, "") + "/";
    console.log("Extracting image from:", cleanUrl);

    let remoteImageUrl = await extractViaOembed(cleanUrl);
    if (!remoteImageUrl) {
      console.log("oEmbed failed, trying HTML scrape...");
      remoteImageUrl = await extractViaHtmlScrape(cleanUrl);
    }

    if (!remoteImageUrl) {
      return new Response(
        JSON.stringify({ success: false, error: "Could not extract image. The post may be private, or Instagram is rate-limiting requests. Try again later or paste the image URL manually." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const normalizedRemoteImageUrl = decodeHtmlEntities(remoteImageUrl);
    const downloaded = await downloadImage(normalizedRemoteImageUrl);
    const ext = extMap[downloaded.contentType] || "jpg";
    const path = `instagram-posts/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await downloaded.blob.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(path, arrayBuffer, { contentType: downloaded.contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    if (postId && typeof postId === "string") {
      const { error: updateError } = await supabase
        .from("designer_instagram_posts")
        .update({ image_url: publicUrl })
        .eq("id", postId);

      if (updateError) throw updateError;
    }

    console.log("Success:", publicUrl.substring(0, 80));

    return new Response(
      JSON.stringify({ success: true, imageUrl: publicUrl, sourceUrl: normalizedRemoteImageUrl, storagePath: path }),
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
