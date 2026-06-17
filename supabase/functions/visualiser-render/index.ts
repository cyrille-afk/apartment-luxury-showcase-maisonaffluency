/**
 * Visualiser Render — swaps surfaces in a room photo with catalogue finishes.
 *
 * Input:
 *   roomImage: data URL or https URL of the user's room photo
 *   pins: [{ surface: 'walls'|'floors'|'upholstery'|'curtains',
 *            x: 0..1, y: 0..1,
 *            swatchUrl: string, swatchName: string, brandName?: string }]
 *
 * Output: { image: "data:image/png;base64,..." }
 */
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SURFACE_LABEL: Record<string, string> = {
  walls: "the walls",
  floors: "the floor (rug/carpet area)",
  upholstery: "the upholstered furniture (sofa/chair fabric)",
  curtains: "the curtains/drapery",
  furniture: "the frame/finish of the single piece of furniture at the marked point (e.g. wood frame, metal legs, stone top, lacquered case)",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const { roomImage, pins } = await req.json();
    if (!roomImage || typeof roomImage !== "string") {
      return new Response(JSON.stringify({ error: "roomImage required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const validPins = (Array.isArray(pins) ? pins : []).filter(
      (p) => p && p.swatchUrl && SURFACE_LABEL[p.surface],
    );
    if (validPins.length === 0) {
      return new Response(JSON.stringify({ error: "at least one pin with a finish required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isSoftMaterial = (cat?: string, name?: string) => {
      const t = `${cat || ""} ${name || ""}`.toLowerCase();
      return /(fabric|leather|upholster|textile|velvet|linen|wool|cotton|silk|mohair|bouclé|boucle|hide|suede)/.test(t);
    };

    // Build swap instructions. The room photo is image #1; each swatch follows in order.
    const buildPromptFor = (p: typeof validPins[number]) => {
      const soft = isSoftMaterial(p.swatchCategory, p.swatchName);
      const effectiveSurface = p.surface === "furniture" && soft ? "furniture-upholstery" : p.surface;
      const surfaceLabel = effectiveSurface === "furniture-upholstery"
        ? "the upholstered cushions, seat, back and arms of the single piece of furniture at the marked point (leave its wood/metal frame and all surrounding objects untouched)"
        : SURFACE_LABEL[p.surface];
      const at = `near (${Math.round(p.x * 100)}% from left, ${Math.round(p.y * 100)}% from top)`;
      const finish = `${p.brandName ? p.brandName + " — " : ""}${p.swatchName}`;
      const application =
        effectiveSurface === "furniture-upholstery"
          ? "upholstery fabric/leather wrap on the cushions, seat, back and arms of that single piece only — do NOT touch its frame, legs, or any adjacent objects, walls, floor, or drapery" :
        p.surface === "floors" ? "rug/floor covering" :
        p.surface === "walls" ? "wall finish (paint/wallpaper/lacquer/plaster as appropriate)" :
        p.surface === "upholstery" ? "upholstery fabric on the seating in that area" :
        p.surface === "furniture" ? "furniture finish applied ONLY to the frame/case/legs/top of the single piece of furniture at the marked point — do NOT touch its upholstery, cushions, or any adjacent objects, walls, floor, or drapery" :
        "curtain/drapery fabric";
      return `You are a photorealistic interior renderer. Image 1 is a room photograph. Image 2 is a material swatch.\n\n` +
        `TASK: Completely re-skin ${surfaceLabel} ${at} with the EXACT material shown in image 2 (${finish}).\n\n` +
        `This is REQUIRED even if the existing surface already looks similar in colour or material. ` +
        `The output MUST visibly change so the target surface matches image 2 pixel-for-pixel in colour, pattern, grain, and texture (e.g. cowhide spots/markings, fabric weave, wood grain, leather pores). ` +
        `Apply it as a realistic ${application}, matching the room's existing perspective, scale, lighting, and shadows.\n\n` +
        `Preserve EVERY other element exactly — furniture geometry, layout, architecture, lighting fixtures, plants, artwork, windows, ceilings, and camera angle must be pixel-identical to image 1 except for this one swapped surface. ` +
        `If you output an image where the target surface looks unchanged from image 1, the output is wrong.\n\n` +
        `Output a single photorealistic image at the same aspect ratio as image 1.`;
    };

    const MODELS = [
      "google/gemini-3.1-flash-image-preview",
      "google/gemini-3-pro-image-preview",
    ];

    const callModel = async (currentImage: string, pin: typeof validPins[number]) => {
      const content: Array<Record<string, unknown>> = [
        { type: "text", text: buildPromptFor(pin) },
        { type: "image_url", image_url: { url: currentImage } },
        { type: "image_url", image_url: { url: pin.swatchUrl } },
      ];
      let lastErr = "";
      for (const model of MODELS) {
        const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model,
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            temperature: 0,
          }),
        });
        if (res.status === 429) throw new Response(JSON.stringify({ error: "Rate limited. Try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (res.status === 402) throw new Response(JSON.stringify({ error: "AI credits exhausted. Top up in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (!res.ok) {
          lastErr = `${res.status} ${await res.text()}`;
          console.error(`[visualiser-render] ${model} failed: ${lastErr}`);
          continue;
        }
        const data = await res.json();
        const img = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
        if (img) {
          console.log(`[visualiser-render] swap success on ${model} for ${pin.swatchName}`);
          return img as string;
        }
        console.warn(`[visualiser-render] ${model} returned no image for ${pin.swatchName}`);
      }
      throw new Error(`No image generated for ${pin.swatchName}. ${lastErr}`);
    };

    // Chain: apply each pin sequentially, feeding the previous output back in.
    // This forces the model to focus on one swap at a time so it can't skip any.
    let current = roomImage as string;
    try {
      for (const pin of validPins) {
        current = await callModel(current, pin);
      }
    } catch (e) {
      if (e instanceof Response) return e;
      throw e;
    }
    const generated = current;

    return new Response(JSON.stringify({ image: generated }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[visualiser-render]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
