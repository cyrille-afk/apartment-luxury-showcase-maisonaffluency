import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

const decodeHtmlEntities = (value: string) =>
  value.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"');

/**
 * Upgrade an Instagram CDN thumbnail URL to the highest available resolution.
 * Instagram CDN URLs often contain `/s640x640/` or similar size segments.
 * Replacing with `/s1080x1080/` often yields the original resolution.
 */
function upgradeResolution(url: string): string {
  // Replace size segments like /s150x150/, /s320x320/, /s640x640/ with /s1080x1080/
  let upgraded = url.replace(/\/s\d+x\d+\//g, "/s1080x1080/");
  // Also try removing crop parameters that force zoomed-in crops
  // e.g. /e35/ (enhancement), /c0.xxx.yyy.zzz/ (crop coordinates)
  upgraded = upgraded.replace(/\/c[\d.]+\.[\d.]+\.[\d.]+\.[\d.]+\//g, "/");
  return upgraded;
}

async function extractViaOembed(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&maxwidth=1080`;
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      redirect: "follow",
    });
    if (!response.ok) {
      // Consume body to prevent leak
      await response.text();
      return null;
    }
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("json")) {
      await response.text();
      return null;
    }
    const data = await response.json();
    if (typeof data?.thumbnail_url === "string") {
      const raw = decodeHtmlEntities(data.thumbnail_url);
      // Try to upgrade to 1080px version
      return upgradeResolution(raw);
    }
    return null;
  } catch {
    return null;
  }
}

async function extractViaHtmlScrape(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
      redirect: "follow",
    });
    if (!response.ok) {
      await response.text();
      return null;
    }

    const html = await response.text();

    // Try og:image first (usually highest quality)
    const ogMatch =
      html.match(
        /<meta\s+(?:[^>]*?)property=["']og:image["']\s+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)property=["']og:image["']/i,
      );
    if (ogMatch?.[1]) return upgradeResolution(decodeHtmlEntities(ogMatch[1]));

    // twitter:image fallback
    const twMatch =
      html.match(
        /<meta\s+(?:[^>]*?)name=["']twitter:image["']\s+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)name=["']twitter:image["']/i,
      );
    if (twMatch?.[1]) return upgradeResolution(decodeHtmlEntities(twMatch[1]));

    return null;
  } catch {
    return null;
  }
}

/**
 * Use Cloudinary fetch to proxy + transform the image to a 1080x1080 square.
 * This ensures consistent aspect ratio regardless of source crop.
 */
function cloudinaryFetchUrl(sourceUrl: string): string {
  const encoded = encodeURIComponent(sourceUrl);
  return `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1080,h_1080,c_fill,g_auto,f_jpg,q_auto:best/${encoded}`;
}

async function downloadImage(candidateUrl: string) {
  const imageResponse = await fetch(candidateUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ImageProxy/1.0)",
      Accept: "image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
  });

  if (!imageResponse.ok) {
    throw new Error(
      `Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`,
    );
  }

  const rawContentType = (
    imageResponse.headers.get("content-type") || ""
  ).trim();
  const contentType = rawContentType.split(";")[0].trim().toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(
      `Source did not return an image (content-type: ${rawContentType || "unknown"})`,
    );
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
        JSON.stringify({
          success: false,
          error: "Valid Instagram URL is required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const cleanUrl = url.trim().split("?")[0].replace(/\/$/, "") + "/";
    console.log("Extracting image from:", cleanUrl);

    // Step 1: Extract the raw Instagram image URL via oEmbed or HTML scrape
    let remoteImageUrl = await extractViaOembed(cleanUrl);
    const method = remoteImageUrl ? "oembed" : "scrape";
    if (!remoteImageUrl) {
      console.log("oEmbed failed, trying HTML scrape...");
      remoteImageUrl = await extractViaHtmlScrape(cleanUrl);
    }

    if (!remoteImageUrl) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "Could not extract image. The post may be private, or Instagram is rate-limiting requests. Try again later or paste the image URL manually.",
        }),
        {
          status: 422,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const normalizedRemoteImageUrl = decodeHtmlEntities(remoteImageUrl);
    console.log(`Extracted via ${method}:`, normalizedRemoteImageUrl.substring(0, 100));

    // Step 2: Try to download the upgraded-resolution image directly first.
    // If that fails, fall back to Cloudinary fetch proxy for square crop.
    let downloaded;
    try {
      downloaded = await downloadImage(normalizedRemoteImageUrl);
    } catch (directErr) {
      console.log("Direct download failed, trying Cloudinary fetch proxy...", directErr);
      const proxied = cloudinaryFetchUrl(normalizedRemoteImageUrl);
      downloaded = await downloadImage(proxied);
    }

    const ext = extMap[downloaded.contentType] || "jpg";
    const path = `instagram-posts/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const arrayBuffer = await downloaded.blob.arrayBuffer();

    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(path, arrayBuffer, {
        contentType: downloaded.contentType,
        upsert: false,
      });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage
      .from("assets")
      .getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    // Step 3: Update the DB record if postId provided
    if (postId && typeof postId === "string") {
      const { error: updateError } = await supabase
        .from("designer_instagram_posts")
        .update({ image_url: publicUrl })
        .eq("id", postId);

      if (updateError) throw updateError;
    }

    console.log("Success:", publicUrl.substring(0, 80));

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        sourceUrl: normalizedRemoteImageUrl,
        storagePath: path,
        method,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
