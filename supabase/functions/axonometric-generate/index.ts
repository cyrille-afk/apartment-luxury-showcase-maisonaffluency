import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check – admin only
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const sb = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authErr,
    } = await sb.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Check admin role
    const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id);
    const isAdmin = roles?.some(
      (r: any) => r.role === "admin" || r.role === "super_admin"
    );
    if (!isAdmin) throw new Error("Admin access required");

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const body = await req.json();
    const { imageUrl, mode, style, overlayImages, technicalDrawingUrl, maskDataUrl, placements } = body;
    // mode: "elevation_to_axo" | "section_to_axo" | "stylize" | "composite" | "3d_to_cad" | "cad_overlay" | "product_swap" | "scene_edit" | "freeform"

    if (!imageUrl) throw new Error("imageUrl is required");

    let prompt = "";
    const defaultStyle = style || "photorealistic architectural rendering with warm natural lighting, high-end interior finishes";

    if (mode === "elevation_to_axo") {
      prompt = `Transform this 2D room elevation drawing into a professional 3D axonometric (isometric) architectural view. Extrude the walls and elements shown in the elevation into a three-dimensional cutaway perspective. Show depth, volume, and spatial relationships. Style: ${defaultStyle}. Maintain all architectural proportions and details from the original elevation.`;
    } else if (mode === "section_to_axo") {
      prompt = `Transform this 2D architectural section drawing into a detailed 3D axonometric (isometric) cutaway view. Show the full spatial volume of the section — walls, floors, ceilings, stairs, and openings — rendered in three dimensions from an elevated oblique angle. Style: ${defaultStyle}. Preserve all structural and spatial relationships from the original section.`;
    } else if (mode === "stylize") {
      prompt = `Enhance and stylize this architectural 3D axonometric view to give it a ${defaultStyle} feel. Add realistic textures, materials, shadows, and ambient lighting. Keep the geometry and spatial layout exactly the same but elevate the visual quality to a professional presentation rendering.`;
    } else if (mode === "composite") {
      prompt = `Take this 3D axonometric architectural view and incorporate the provided furniture/product images into the scene naturally. Place them at appropriate positions within the rooms, respecting scale, perspective, and the axonometric projection angle. Add realistic shadows and lighting to blend the products seamlessly into the architectural rendering. Style: ${defaultStyle}.`;
    } else if (mode === "3d_to_cad") {
      prompt = `Convert this 3D product/furniture image into a clean 2D CAD-style technical vector block drawing. Generate multiple orthographic views: front elevation, side elevation, and top/plan view. Use clean black line work on a white background, similar to an AutoCAD or technical architecture block. Estimate and label the approximate dimensions (width × depth × height) in millimeters based on the visible proportions and typical furniture/object sizing. Include dimension lines with arrows. The output should look like a professional CAD furniture block ready to be inserted into architectural floor plans or elevation drawings. No shading, no color — pure technical line drawing style.`;
    } else if (mode === "cad_overlay") {
      prompt = `Take this architectural technical drawing (floor plan or elevation) and insert the provided CAD furniture/product block drawings into the appropriate positions. Scale the blocks to match the drawing's proportions. Maintain the technical drawing style — clean lines, no shading. Position the product blocks logically within rooms or against walls as appropriate for the product type. Keep the original technical drawing intact and overlay the product blocks seamlessly.`;
    } else if (mode === "product_swap") {
      const swaps = body.swaps as { prompt: string; imageUrl: string }[] | undefined;
      // Legacy single-swap support
      const singlePrompt = body.swapPrompt || "";
      const singleImage = body.replacementImageUrl;

      const swapList = swaps && swaps.length > 0
        ? swaps
        : (singleImage && singlePrompt.trim()) ? [{ prompt: singlePrompt, imageUrl: singleImage }] : [];

      if (swapList.length === 0) throw new Error("At least one swap (prompt + replacement image) is required");
      if (swapList.length > 5) throw new Error("Maximum 5 swaps per generation");

      const swapInstructions = swapList
        .map((s, i) => `${i + 1}. ${s.prompt}`)
        .join("\n");

      prompt = `You are given an interior architectural render. The user wants to swap ${swapList.length === 1 ? "a specific piece" : "multiple pieces"} of furniture/products in the scene. For each swap instruction below, remove the specified item and replace it IN THE EXACT SAME POSITION with the corresponding replacement product image (provided in order after the scene image). Match scale, perspective, lighting, and shadows perfectly so each replacement looks naturally integrated.\n\nCRITICAL: You MUST preserve EVERY other element in the scene EXACTLY as they are — all other furniture, walls, flooring, decorations, lighting fixtures, plants, artwork, windows, rugs, and architectural details must remain completely unchanged. Do NOT remove, move, or alter anything that is not explicitly mentioned in the swap instructions. The output image should be pixel-identical to the input except for the swapped items.\n\nSwap instructions:\n${swapInstructions}\n\nStyle: ${defaultStyle}.`;
    } else if (mode === "freeform") {
      const userPrompt = body.userPrompt;
      if (!userPrompt?.trim()) throw new Error("userPrompt is required for freeform mode");
      prompt = `You are an expert architectural visualization AI. You are given an interior/architectural render. Apply the following user instruction to this image.\n\nCRITICAL RULE: You MUST keep ALL other elements in the scene EXACTLY as they are. Only modify what is explicitly requested. Every piece of furniture, decoration, wall, floor, ceiling, plant, artwork, rug, lighting fixture, and architectural detail that is NOT mentioned in the instruction must remain completely unchanged and in its exact original position. The output should be identical to the input except for the specific change requested.\n\nInstruction: "${userPrompt}"\n\nStyle: ${defaultStyle}. Produce a single cohesive professional architectural rendering as output.`;
    } else if (mode === "scene_edit") {
      const placementDesc = (placements || [])
        .map((p: any, i: number) => `${i + 1}. "${p.product_name}" by ${p.brand_name} at position (${p.position?.x_percent ?? 50}% from left, ${p.position?.y_percent ?? 50}% from top), size ${p.size_percent ?? 15}% of image width, rotated ${p.rotation_degrees ?? 0}°`)
        .join("\n");

      const hasMask = !!maskDataUrl;
      const hasProducts = placements && placements.length > 0;

      if (hasMask && hasProducts) {
        prompt = `You are given an architectural 3D axonometric interior render. The areas marked in RED in the mask overlay should have the existing furniture REMOVED and replaced with a clean, empty version of that space (matching the room's flooring, wall texture, and lighting). Then, place the following product images into the scene at their specified positions, blending them naturally with correct perspective, shadows, and lighting:\n${placementDesc}\n\nStyle: ${defaultStyle}. Make the final result look like a single cohesive professional architectural rendering.`;
      } else if (hasMask) {
        prompt = `You are given an architectural 3D axonometric interior render. The areas marked in RED in the mask overlay contain furniture that should be REMOVED. Replace those areas with a clean, empty version of the space — matching the surrounding flooring, wall textures, and lighting. Keep everything else in the scene exactly as is. Style: ${defaultStyle}.`;
      } else if (hasProducts) {
        prompt = `You are given an architectural 3D axonometric interior render. Place the following product images into the scene at their specified positions, blending them naturally with correct axonometric perspective, realistic shadows, and lighting:\n${placementDesc}\n\nStyle: ${defaultStyle}. Make the final result look like a single cohesive professional architectural rendering.`;
      } else {
        throw new Error("Scene edit requires either a mask (erase areas) or product placements");
      }
    } else {
      throw new Error("Invalid mode. Use: elevation_to_axo, section_to_axo, stylize, composite, 3d_to_cad, cad_overlay, product_swap, freeform, scene_edit");
    }

    // Build message content
    const content: any[] = [{ type: "text", text: prompt }];
    content.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });

    // Add replacement product images for product_swap mode
    if (mode === "product_swap") {
      const swaps = body.swaps as { prompt: string; imageUrl: string }[] | undefined;
      const singleImage = body.replacementImageUrl;
      const swapList = swaps && swaps.length > 0
        ? swaps
        : singleImage ? [{ prompt: "", imageUrl: singleImage }] : [];
      for (const s of swapList.slice(0, 5)) {
        content.push({
          type: "image_url",
          image_url: { url: s.imageUrl },
        });
      }
    }

    // Add overlay product images for composite mode
    if (mode === "composite" && overlayImages && Array.isArray(overlayImages)) {
      for (const img of overlayImages.slice(0, 5)) {
        content.push({
          type: "image_url",
          image_url: { url: img },
        });
      }
    }

    // Add CAD blocks + technical drawing for cad_overlay mode
    if (mode === "cad_overlay") {
      if (technicalDrawingUrl) {
        content.push({
          type: "image_url",
          image_url: { url: technicalDrawingUrl },
        });
      }
      if (overlayImages && Array.isArray(overlayImages)) {
        for (const img of overlayImages.slice(0, 5)) {
          content.push({
            type: "image_url",
            image_url: { url: img },
          });
        }
      }
    }

    // Scene edit: add mask image + product images
    if (mode === "scene_edit") {
      if (maskDataUrl) {
        content.push({
          type: "image_url",
          image_url: { url: maskDataUrl },
        });
      }
      if (overlayImages && Array.isArray(overlayImages)) {
        for (const img of overlayImages.slice(0, 5)) {
          content.push({
            type: "image_url",
            image_url: { url: img },
          });
        }
      }
    }

    const aiResponse = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-pro-image-preview",
          messages: [{ role: "user", content }],
          modalities: ["image", "text"],
        }),
      }
    );

    if (!aiResponse.ok) {
      const status = aiResponse.status;
      const body = await aiResponse.text();
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please top up in workspace settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("AI gateway error:", status, body);
      throw new Error(`AI generation failed [${status}]`);
    }

    const aiData = await aiResponse.json();
    const generatedImage =
      aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    const textResponse = aiData.choices?.[0]?.message?.content || "";

    if (!generatedImage) {
      throw new Error("No image was generated. The AI may not have understood the input.");
    }

    // Upload the generated image to storage
    const base64Data = generatedImage.replace(/^data:image\/\w+;base64,/, "");
    const binaryData = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));
    const fileName = `axonometric/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;

    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminSb = createClient(supabaseUrl, serviceKey);

    const { error: uploadErr } = await adminSb.storage
      .from("assets")
      .upload(fileName, binaryData, { contentType: "image/png" });

    if (uploadErr) {
      console.error("Upload error:", uploadErr);
      // Still return the base64 image even if upload fails
      return new Response(
        JSON.stringify({ imageUrl: generatedImage, storedUrl: null, text: textResponse }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: urlData } = adminSb.storage.from("assets").getPublicUrl(fileName);

    return new Response(
      JSON.stringify({
        imageUrl: generatedImage,
        storedUrl: urlData.publicUrl,
        text: textResponse,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("axonometric-generate error:", e);
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
