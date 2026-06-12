import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { requireUser } from "../_shared/auth.ts";

// Allowlist of trusted hostnames we will fetch from. Anything else is rejected.
const ALLOWED_HOST_SUFFIXES = [
  "cloudinary.com",
  "res.cloudinary.com",
  "supabase.co",
  "supabase.in",
  "amazonaws.com",
  "googleusercontent.com",
  "cdn.shopify.com",
  "images.squarespace-cdn.com",
  "wp.com",
  "wordpress.com",
];

function isUrlAllowed(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    const host = u.hostname.toLowerCase();
    // Block private / link-local / loopback ranges to prevent SSRF
    if (
      host === "localhost" ||
      host.startsWith("127.") ||
      host.startsWith("10.") ||
      host.startsWith("192.168.") ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      host.startsWith("169.254.") ||
      host.startsWith("0.") ||
      host === "::1" ||
      host.startsWith("fc") ||
      host.startsWith("fd") ||
      host.startsWith("fe80")
    ) return false;
    return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith("." + s));
  } catch {
    return false;
  }
}

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

async function downloadImage(candidateUrl: string) {
  const imgRes = await fetch(candidateUrl, {
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; ImageProxy/1.0)",
      "Accept": "image/*,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
    },
  });

  if (!imgRes.ok) {
    throw new Error(`Failed to fetch image: ${imgRes.status} ${imgRes.statusText}`);
  }

  const rawContentType = (imgRes.headers.get("content-type") || "").trim();
  const contentType = rawContentType.split(";")[0].trim().toLowerCase();

  if (!contentType.startsWith("image/")) {
    throw new Error(`Source did not return an image (content-type: ${rawContentType || "unknown"})`);
  }

  const blob = await imgRes.blob();

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

  // Auth required — prevents anonymous SSRF + storage pollution
  const auth = await requireUser(req);
  if (!auth.ok) {
    return new Response(JSON.stringify(auth.body), {
      status: auth.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Require admin/super_admin/trade_user — prevents arbitrary signed-up
  // accounts from polluting the public assets bucket.
  const userId = auth.userId;
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const allowed = roles?.some((r: any) =>
    ["admin", "super_admin", "trade_user"].includes(r.role),
  );
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const allowed = roles?.some((r: any) =>
    ["admin", "super_admin", "trade_user"].includes(r.role),
  );
  if (!allowed) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { url, fallbackUrl } = await req.json();

    if (!url || typeof url !== "string") {
      return new Response(JSON.stringify({ error: "Missing 'url' parameter" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const candidateUrls = [...new Set(
      [url, fallbackUrl]
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value.length > 0)
        .filter((value) => isUrlAllowed(value)),
    )];

    if (candidateUrls.length === 0) {
      return new Response(JSON.stringify({ error: "URL host not allowed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let selectedUrl: string | null = null;
    let downloaded: { blob: Blob; contentType: string } | null = null;
    let lastError: Error | null = null;

    for (const candidate of candidateUrls) {
      try {
        downloaded = await downloadImage(candidate);
        selectedUrl = candidate;
        break;
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : "Unknown error";
        console.warn(`Image download failed for ${candidate}:`, message);
        lastError = error instanceof Error ? error : new Error(message);
      }
    }

    if (!downloaded || !selectedUrl) {
      throw lastError ?? new Error("Could not fetch image from any provided source");
    }

    const ext = extMap[downloaded.contentType] || "jpg";
    const path = `products/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

    // Upload to storage using service role (bypasses RLS)
    const arrayBuffer = await downloaded.blob.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from("assets")
      .upload(path, arrayBuffer, { contentType: downloaded.contentType, upsert: false });

    if (uploadError) throw uploadError;

    const { data: urlData } = supabase.storage.from("assets").getPublicUrl(path);

    return new Response(
      JSON.stringify({ publicUrl: urlData.publicUrl, sourceUsed: selectedUrl }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error: unknown) {
    console.error("Proxy image error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
