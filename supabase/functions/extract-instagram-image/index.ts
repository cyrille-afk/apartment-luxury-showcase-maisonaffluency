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
  value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"');

function upgradeResolution(url: string): string {
  return url.replace(/\/s\d+x\d+\//g, "/s1080x1080/");
}

function normalizeInstagramUrl(url: string): string {
  return url.trim().split("?")[0].replace(/\/$/, "") + "/";
}

function cloudinaryFetchUrl(sourceUrl: string): string {
  const encoded = encodeURIComponent(sourceUrl);
  return `https://res.cloudinary.com/dif1oamtj/image/fetch/f_auto,q_auto:best,c_limit,w_1600,h_1600/${encoded}`;
}

function cloudinarySquareUrl(sourceUrl: string): string {
  const encoded = encodeURIComponent(sourceUrl);
  return `https://res.cloudinary.com/dif1oamtj/image/fetch/w_1080,h_1080,c_fill,g_auto,f_jpg,q_auto:best/${encoded}`;
}

async function fetchJson(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const text = await response.text();

  if (!response.ok) {
    throw new Error(`Request failed (${response.status}): ${text.slice(0, 240)}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Upstream response was not valid JSON");
  }
}

type InstagramGraphMedia = {
  id?: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  children?: { data?: Array<{ media_type?: string; media_url?: string; thumbnail_url?: string }> };
};

async function resolveMediaUrlViaGraph(cleanUrl: string): Promise<{ url: string; method: string } | null> {
  const accessToken = Deno.env.get("META_ACCESS_TOKEN");
  if (!accessToken) return null;

  try {
    const oembed = await fetchJson(
      `https://www.instagram.com/api/v1/oembed/?url=${encodeURIComponent(cleanUrl)}`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0",
          Accept: "application/json",
        },
      },
    );

    const mediaId = typeof oembed?.media_id === "string" ? oembed.media_id : null;
    // Extract oEmbed thumbnail as fallback before attempting Graph
    const oembedThumb = typeof oembed?.thumbnail_url === "string"
      ? upgradeResolution(decodeHtmlEntities(oembed.thumbnail_url))
      : null;

    if (mediaId) {
      try {
        const media = await fetchJson(
          `https://graph.facebook.com/v23.0/${encodeURIComponent(mediaId)}?fields=id,media_type,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}&access_token=${encodeURIComponent(accessToken)}`,
          {
            headers: {
              "User-Agent": "Mozilla/5.0",
              Accept: "application/json",
            },
          },
        ) as InstagramGraphMedia;

        if (media.media_type === "CAROUSEL_ALBUM" && media.children?.data?.length) {
          const preferredChild = media.children.data.find((child) => child.media_type === "IMAGE" && child.media_url) ||
            media.children.data.find((child) => child.media_url || child.thumbnail_url);

          if (preferredChild?.media_url) {
            return { url: preferredChild.media_url, method: "graph-carousel" };
          }
          if (preferredChild?.thumbnail_url) {
            return { url: preferredChild.thumbnail_url, method: "graph-carousel-thumb" };
          }
        }

        if (media.media_type === "VIDEO" && typeof media.thumbnail_url === "string") {
          return { url: media.thumbnail_url, method: "graph-video-thumb" };
        }

        if (typeof media.media_url === "string") {
          return { url: media.media_url, method: "graph-media" };
        }

        if (typeof media.thumbnail_url === "string") {
          return { url: media.thumbnail_url, method: "graph-thumb" };
        }
      } catch (graphErr) {
        console.warn("Graph API lookup failed (will use oEmbed thumbnail):", graphErr);
      }
    }

    // Fallback: use the oEmbed thumbnail (works for any public post)
    if (oembedThumb) {
      return { url: oembedThumb, method: "oembed-internal" };
    }

    return null;
  } catch (error) {
    console.warn("Graph/oEmbed resolution failed:", error);
    return null;
  }
}

async function extractViaOembed(url: string): Promise<string | null> {
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=${encodeURIComponent(url)}&maxwidth=1080`;
    const response = await fetch(oembedUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      redirect: "follow",
    });
    if (!response.ok) {
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
      return upgradeResolution(decodeHtmlEntities(data.thumbnail_url));
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

    const ogMatch =
      html.match(
        /<meta\s+(?:[^>]*?)property=["']og:image["']\s+content=["']([^"']+)["']/i,
      ) ||
      html.match(
        /<meta\s+(?:[^>]*?)content=["']([^"']+)["']\s+(?:[^>]*?)property=["']og:image["']/i,
      );
    if (ogMatch?.[1]) return upgradeResolution(decodeHtmlEntities(ogMatch[1]));

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

  const rawContentType = (imageResponse.headers.get("content-type") || "").trim();
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

    const cleanUrl = normalizeInstagramUrl(url);
    console.log("Extracting image from:", cleanUrl);

    let resolution = await resolveMediaUrlViaGraph(cleanUrl);
    if (!resolution) {
      const oembedUrl = await extractViaOembed(cleanUrl);
      if (oembedUrl) {
        resolution = { url: oembedUrl, method: "oembed" };
      }
    }
    if (!resolution) {
      console.log("oEmbed failed, trying HTML scrape...");
      const scrapedUrl = await extractViaHtmlScrape(cleanUrl);
      if (scrapedUrl) {
        resolution = { url: scrapedUrl, method: "scrape" };
      }
    }

    if (!resolution) {
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

    const normalizedRemoteImageUrl = decodeHtmlEntities(resolution.url);
    console.log(`Extracted via ${resolution.method}:`, normalizedRemoteImageUrl.substring(0, 140));

    let downloaded;
    try {
      downloaded = await downloadImage(normalizedRemoteImageUrl);
    } catch (directErr) {
      console.log("Direct download failed, trying Cloudinary square proxy...", directErr);
      // Use square crop proxy to ensure 1:1 aspect ratio
      const proxied = cloudinarySquareUrl(normalizedRemoteImageUrl);
      try {
        downloaded = await downloadImage(proxied);
      } catch {
        // Last resort: standard proxy without forced square
        const fallback = cloudinaryFetchUrl(normalizedRemoteImageUrl);
        downloaded = await downloadImage(fallback);
      }
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

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);
    const publicUrl = urlData.publicUrl;

    if (postId && typeof postId === "string") {
      const { error: updateError } = await supabase
        .from("designer_instagram_posts")
        .update({ image_url: publicUrl })
        .eq("id", postId);

      if (updateError) throw updateError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        imageUrl: publicUrl,
        sourceUrl: normalizedRemoteImageUrl,
        storagePath: path,
        method: resolution.method,
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