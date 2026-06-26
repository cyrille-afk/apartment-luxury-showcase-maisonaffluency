/**
 * Visualiser Render — crop / generate / feather-composite per pin.
 *
 * For each pin we crop a tight region around (x,y), ask Gemini to re-skin only
 * that crop with the swatch, then alpha-feather the returned crop back into
 * the running full image. This isolates each chair/wall/etc. so multiple pins
 * that share the same swatch all change (the prior whole-image approach often
 * left "already similar" targets untouched).
 *
 * Input:
 *   roomImage: data URL or https URL of the user's room photo
 *   pins: [{ surface: 'walls'|'floors'|'upholstery'|'curtains'|'furniture',
 *            x: 0..1, y: 0..1,
 *            swatchUrl: string, swatchName: string,
 *            brandName?: string, swatchCategory?: string }]
 *
 * Output: { image: "data:image/png;base64,..." }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { Image } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { requireUser, rateLimit } from "../_shared/auth.ts";

const SURFACE_LABEL: Record<string, string> = {
  walls: "the wall surface visible in this crop",
  floors: "the floor / rug area visible in this crop",
  upholstery: "the upholstered seating fabric visible in this crop",
  curtains: "the curtains / drapery visible in this crop",
  furniture:
    "the single piece of furniture that fills most of this crop (frame, case, legs, top)",
};

// region size, as a fraction of min(width, height) of the source image
const CROP_FRACTION = 0.32;
// feather radius as fraction of crop size (radial falloff for compositing)
const FEATHER_FRACTION = 0.22;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { roomImage, pins } = await req.json();
    if (!roomImage || typeof roomImage !== "string") {
      return jsonError("roomImage required", 400);
    }
    const validPins = (Array.isArray(pins) ? pins : []).filter(
      (p) => p && p.swatchUrl && SURFACE_LABEL[p.surface],
    );
    if (validPins.length === 0) {
      return jsonError("at least one pin with a finish required", 400);
    }

    // ── Load the base image into memory ──────────────────────────────────────
    const baseBytes = await fetchImageBytes(roomImage);
    let canvas = await Image.decode(baseBytes);
    const W = canvas.width;
    const H = canvas.height;
    const cropSide = Math.round(Math.min(W, H) * CROP_FRACTION);

    const isSoftMaterial = (cat?: string, name?: string) => {
      const t = `${cat || ""} ${name || ""}`.toLowerCase();
      return /(fabric|leather|upholster|textile|velvet|linen|wool|cotton|silk|mohair|bouclé|boucle|hide|suede)/.test(
        t,
      );
    };

    // ── Process each pin: crop → gemini → feather-composite ──────────────────
    for (let i = 0; i < validPins.length; i++) {
      const pin = validPins[i];
      const cx = Math.round(pin.x * W);
      const cy = Math.round(pin.y * H);
      let x0 = Math.max(0, cx - Math.round(cropSide / 2));
      let y0 = Math.max(0, cy - Math.round(cropSide / 2));
      const cw = Math.min(cropSide, W - x0);
      const ch = Math.min(cropSide, H - y0);
      // Re-clamp top-left if we hit the right/bottom edge
      x0 = Math.min(x0, W - cw);
      y0 = Math.min(y0, H - ch);

      const cropImg = canvas.clone().crop(x0, y0, cw, ch);
      const cropPngBytes = await cropImg.encode();
      const cropDataUrl = `data:image/png;base64,${toBase64(cropPngBytes)}`;

      const soft = isSoftMaterial(pin.swatchCategory, pin.swatchName);
      const effectiveSurface =
        pin.surface === "furniture" && soft ? "furniture-upholstery" : pin.surface;
      const surfaceLabel =
        effectiveSurface === "furniture-upholstery"
          ? "the upholstered cushions, seat, back and arms of the chair/sofa centered in this crop (leave its wood/metal frame untouched)"
          : SURFACE_LABEL[pin.surface];
      const finish = `${pin.brandName ? pin.brandName + " — " : ""}${pin.swatchName}`;
      const prompt =
        `You are a photorealistic interior renderer. Image 1 is a TIGHT CROP of one specific area in a room. Image 2 is a material swatch.\n\n` +
        `TASK: Re-skin ${surfaceLabel} with the EXACT material in image 2 (${finish}). ` +
        `Match colour, pattern, weave/grain, and texture pixel-for-pixel to image 2. ` +
        `Preserve the rest of the crop exactly — perspective, lighting, shadows, scale, surrounding objects, and the camera angle must stay identical. ` +
        `Output a single photorealistic image at the SAME aspect ratio and SAME resolution as image 1.`;

      const newCropDataUrl = await callGemini(
        LOVABLE_API_KEY,
        prompt,
        cropDataUrl,
        pin.swatchUrl,
      );

      // Decode the model output, resize to the crop box, feather, composite.
      const outBytes = await fetchImageBytes(newCropDataUrl);
      let patch = await Image.decode(outBytes);
      if (patch.width !== cw || patch.height !== ch) {
        patch = patch.resize(cw, ch);
      }
      featherRadialAlpha(patch, FEATHER_FRACTION);
      canvas.composite(patch, x0, y0);

      console.log(
        `[visualiser-render] pin ${i + 1}/${validPins.length} (${pin.surface}) at ${cx},${cy} crop ${cw}x${ch} → done`,
      );
    }

    const finalBytes = await canvas.encode();
    const finalDataUrl = `data:image/png;base64,${toBase64(finalBytes)}`;
    return new Response(JSON.stringify({ image: finalDataUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("[visualiser-render]", e);
    return jsonError("An internal error occurred", 500);
  }
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toBase64(bytes: Uint8Array): string {
  // chunked to avoid call-stack issues on large arrays
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function fetchImageBytes(urlOrDataUrl: string): Promise<Uint8Array> {
  if (urlOrDataUrl.startsWith("data:")) {
    const comma = urlOrDataUrl.indexOf(",");
    const b64 = urlOrDataUrl.slice(comma + 1);
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  const res = await fetch(urlOrDataUrl);
  if (!res.ok) throw new Error(`failed to fetch image: ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/**
 * Apply a radial alpha falloff to `img` so the outer ring fades to fully
 * transparent. We modify the alpha channel of every pixel in place.
 */
function featherRadialAlpha(img: Image, featherFraction: number) {
  const w = img.width;
  const h = img.height;
  const cx = (w - 1) / 2;
  const cy = (h - 1) / 2;
  // distance from center, normalized so 1.0 = edge of inscribed circle
  const rMax = Math.min(w, h) / 2;
  const fadeStart = 1 - featherFraction; // begin fading at this normalized radius
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (x - cx) / rMax;
      const dy = (y - cy) / rMax;
      const r = Math.sqrt(dx * dx + dy * dy);
      let a = 1;
      if (r >= 1) a = 0;
      else if (r > fadeStart) a = 1 - (r - fadeStart) / featherFraction;
      const px = img.getPixelAt(x + 1, y + 1); // imagescript is 1-indexed
      const r8 = (px >>> 24) & 0xff;
      const g8 = (px >>> 16) & 0xff;
      const b8 = (px >>> 8) & 0xff;
      const a8 = Math.max(0, Math.min(255, Math.round(a * 255)));
      const next = ((r8 << 24) | (g8 << 16) | (b8 << 8) | a8) >>> 0;
      img.setPixelAt(x + 1, y + 1, next);
    }
  }
}

const MODELS = [
  "google/gemini-3.1-flash-image-preview",
  "google/gemini-3-pro-image-preview",
];

async function callGemini(
  apiKey: string,
  prompt: string,
  baseDataUrl: string,
  swatchUrl: string,
): Promise<string> {
  const content: Array<Record<string, unknown>> = [
    { type: "text", text: prompt },
    { type: "image_url", image_url: { url: baseDataUrl } },
    { type: "image_url", image_url: { url: swatchUrl } },
  ];
  let lastErr = "";
  for (const model of MODELS) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content }],
        modalities: ["image", "text"],
        temperature: 0,
      }),
    });
    if (res.status === 429) {
      throw new Response(
        JSON.stringify({ error: "Rate limited. Try again shortly." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (res.status === 402) {
      throw new Response(
        JSON.stringify({
          error: "AI credits exhausted. Top up in workspace settings.",
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (!res.ok) {
      lastErr = `${res.status} ${await res.text()}`;
      console.error(`[visualiser-render] ${model} failed: ${lastErr}`);
      continue;
    }
    const data = await res.json();
    const img = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (img) return img as string;
    console.warn(`[visualiser-render] ${model} returned no image`);
  }
  throw new Error(`No image generated for crop. ${lastErr}`);
}
