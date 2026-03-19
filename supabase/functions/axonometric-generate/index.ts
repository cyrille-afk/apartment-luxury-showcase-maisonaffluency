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
    const { imageUrl, mode, style, overlayImages, technicalDrawingUrl, maskDataUrl, placements, referenceImageUrl, refinementPrompt, styleReferenceUrl, skipStyleReference, markerHints } = body;
    // mode: "elevation_to_axo" | "section_to_axo" | "stylize" | "composite" | "3d_to_cad" | "cad_overlay" | "product_swap" | "scene_edit" | "freeform" | "turntable_angle"

    if (!imageUrl) throw new Error("imageUrl is required");

    // Turntable angle mode — generates a single view at a specified angle
    const turntableAngle = body.turntableAngle as number | undefined;

    let prompt = "";
    const defaultStyle = style || "photorealistic architectural rendering with warm natural lighting, high-end interior finishes";

    if (mode === "elevation_to_axo") {
      prompt = `You are an expert architectural visualization AI. Transform this 2D floor plan / elevation drawing into a professional 3D axonometric (isometric) cutaway dollhouse-style interior view.

CRITICAL ACCURACY RULES:
1. FURNITURE PLACEMENT: Study the floor plan CAREFULLY. Every piece of furniture shown in the drawing (sofas, tables, chairs, beds, desks, shelving, rugs, plants) must appear in the 3D render at the EXACT same position, orientation, and relative scale as shown in the plan. Do NOT invent, add, remove, or reposition any furniture.
2. ROOM GEOMETRY: Interior partition walls, doors, windows, columns, and openings must match the plan exactly — correct lengths, angles, and positions.
3. SPATIAL RELATIONSHIPS: Maintain the exact distances between furniture pieces and between furniture and walls as shown in the plan.
4. ORIENTATION: If a sofa faces north in the plan, it must face north in the 3D view. Preserve all rotations and facing directions.
5. COUNT: The number of each furniture type must match exactly — if the plan shows 2 armchairs, render exactly 2, not 1 or 3.

WALL RENDERING RULES — VERY IMPORTANT:
- Do NOT render thick external/building envelope walls. The exterior boundary of the space should be open or only subtly indicated with a thin edge or floor boundary.
- Only render INTERIOR partition walls that divide rooms within the space.
- The result should look like a dollhouse or architectural model with the exterior shell completely removed, exposing the interior directly.
- Windows and doors on the perimeter should still be visible but without the thick structural wall surrounding them — show them as openings or thin frames at the floor plan boundary.

Render from an elevated oblique angle (approximately 45° azimuth, 30° elevation) showing the full interior as an open cutaway with no roof and no external walls. Style: ${defaultStyle}. The result must be a faithful 3D translation of the 2D plan — not an artistic reinterpretation.`;
    } else if (mode === "section_to_axo") {
      prompt = `You are an expert architectural visualization AI. Transform this 2D architectural section drawing into a detailed 3D axonometric (isometric) cutaway dollhouse-style interior view.

CRITICAL ACCURACY RULES:
1. FURNITURE & FIXTURES: Every piece of furniture, fixture, and object visible in the section must appear in the 3D render at the EXACT same position, height, and relative scale. Do NOT invent, add, remove, or reposition any element.
2. SPATIAL VOLUME: Show the full spatial volume — interior partition walls, floors, ceilings, stairs, mezzanines, and openings — rendered in three dimensions from an elevated oblique angle.
3. PROPORTIONS: Wall heights, floor-to-ceiling distances, stair dimensions, and opening sizes must match the section exactly.
4. DEPTH: Extrude the section into realistic room depth, maintaining all structural and spatial relationships from the original drawing.

WALL RENDERING RULES — VERY IMPORTANT:
- Do NOT render thick external/building envelope walls. The exterior boundary of the space should be open or only subtly indicated with a thin edge or floor boundary.
- Only render INTERIOR partition walls that divide rooms within the space.
- The result should look like a dollhouse or architectural model with the exterior shell completely removed, exposing the interior directly.
- Windows and doors on the perimeter should still be visible but without the thick structural wall surrounding them — show them as openings or thin frames at the boundary.

Style: ${defaultStyle}. The result must be a faithful 3D translation of the section — not an artistic reinterpretation.`;
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
      if (swapList.length > 10) throw new Error("Maximum 10 swaps per generation");

      const swapInstructions = swapList
        .map((s, i) => `${i + 1}. ${s.prompt}`)
        .join("\n");

      prompt = `You are given an interior architectural render. The user wants to swap ${swapList.length === 1 ? "a specific piece" : "multiple pieces"} of furniture/products in the scene. For each swap instruction below, remove the specified item and replace it IN THE EXACT SAME POSITION with the corresponding replacement product image (provided in order after the scene image). Match scale, perspective, lighting, and shadows perfectly so each replacement looks naturally integrated.\n\nCRITICAL: You MUST preserve EVERY other element in the scene EXACTLY as they are — all other furniture, walls, flooring, decorations, lighting fixtures, plants, artwork, windows, rugs, and architectural details must remain completely unchanged. Do NOT remove, move, or alter anything that is not explicitly mentioned in the swap instructions. The output image should be pixel-identical to the input except for the swapped items.\n\nSwap instructions:\n${swapInstructions}\n\nStyle: ${defaultStyle}.`;
    } else if (mode === "freeform") {
      const userPrompt = body.userPrompt;
      if (!userPrompt?.trim()) throw new Error("userPrompt is required for freeform mode");
      prompt = `You are an expert architectural visualization AI. You are given an interior/architectural render. Apply the following user instruction to this image.\n\nCRITICAL RULE: You MUST keep ALL other elements in the scene EXACTLY as they are. Only modify what is explicitly requested. Every piece of furniture, decoration, wall, floor, ceiling, plant, artwork, rug, lighting fixture, and architectural detail that is NOT mentioned in the instruction must remain completely unchanged and in its exact original position. The output should be identical to the input except for the specific change requested.\n\nInstruction: "${userPrompt}"\n\nStyle: ${defaultStyle}. Produce a single cohesive professional architectural rendering as output.`;
    } else if (mode === "clean_room") {
      prompt = `You are given a 3D axonometric architectural interior render. REMOVE ALL movable furniture, decorations, rugs, plants, artwork, and accessories from the scene. Keep ONLY the architectural shell: walls, floors, ceilings, windows, doors, built-in cabinetry, and fixed architectural elements. Fill the areas where furniture was removed with matching floor/wall textures so the room looks naturally empty and clean. The result should be a pristine, empty architectural space ready for new furniture placement.\n\nStyle: ${defaultStyle}.`;
    } else if (mode === "proposal_render") {
      const productList = (placements || [])
        .map((p: any, i: number) => {
          const rotNote = p.rotation ? ` — ROTATE this product ${p.rotation}° clockwise from its original orientation in the product photo` : "";
          const dimNote = p.dimensions ? ` [Dimensions: ${p.dimensions}]` : "";
          return `${i + 1}. "${p.product_name}" by ${p.brand_name}${dimNote}${rotNote}`;
        })
        .join("\n");
      if (!placements || placements.length === 0) throw new Error("At least one product placement is required");
      prompt = `You are a PHOTOREALISTIC architectural interior renderer. You will receive images in this EXACT order:
1. REFERENCE LAYOUT: The client's original 3D axonometric furnished room — use this for BOTH spatial positioning AND as the MANDATORY camera/viewpoint reference.
2. EMPTY ROOM: The same room with all furniture removed — this is your blank canvas.
3-${placements.length + 2}. PRODUCT PHOTOS (${placements.length} images): Each image shows the EXACT product to place. These are real product photographs.

REPLACEMENT PRODUCTS (each numbered entry corresponds to the product photo in that position):
${productList}

YOUR TASK — STRICT RULES:
Place each product from its PRODUCT PHOTO into the EMPTY ROOM at the position indicated by the REFERENCE LAYOUT.

CAMERA & VIEWPOINT (HIGHEST PRIORITY — NON-NEGOTIABLE):
- Study the REFERENCE LAYOUT image and replicate its EXACT camera position: the same bird's-eye / top-down axonometric angle looking almost straight down at the floor plan
- If the reference uses a steep top-down view (≈60-75° elevation, nearly overhead), your output MUST also use that SAME steep top-down view — do NOT lower the camera to a dramatic or cinematic perspective
- Match the identical azimuth rotation (compass direction the camera faces), the identical tilt/elevation angle, and the identical zoom / field of view
- The architectural shell (walls, floor edges, windows, doors) in your output must align pixel-for-pixel with the REFERENCE LAYOUT
- If the EMPTY ROOM image has a slightly different crop or angle, IGNORE it — always match the REFERENCE LAYOUT's viewpoint
- The viewer should be able to overlay the reference and the output and see the room structure line up exactly
- ABSOLUTELY DO NOT use a low-angle, eye-level, or dramatic perspective — keep the same overhead dollhouse-style viewpoint as the reference

SHAPE & APPEARANCE FIDELITY (MOST IMPORTANT):
- You MUST reproduce the EXACT shape, silhouette, proportions, color, material, and design of each product AS IT APPEARS in its product photo
- If a product photo shows a ROUND table, render a ROUND table — never change it to rectangular, oval, or any other shape
- If a product photo shows a curved sofa, render a curved sofa — never straighten it
- If a product photo shows a specific upholstery color or pattern, use that EXACT color and pattern
- Every visible detail (legs, armrests, cushions, base shape, edge profiles) must match the product photo precisely
- Think of each product photo as a manufacturing specification — the render must look like THAT EXACT product was photographed in the room

POSITIONING & SCALE RULES:
- Place EVERY product listed above — do NOT skip any. There are ${placements.length} products and ALL ${placements.length} must appear in the output
- Map each replacement product to its corresponding furniture TYPE in the reference layout (sofa→sofa position, dining table→dining table position, dining chairs→dining chair positions, armchair→armchair position, side table→side table position, etc.)
- Place each product at the EXACT same position, facing the EXACT same direction as the furniture it replaces in the reference layout
- Maintain the same distances from walls and between pieces as shown in the reference
- Apply correct 3D axonometric perspective transformation to each product
- When dimensions are provided (e.g. W65 × D58 × H79cm), use them to scale each product correctly RELATIVE to the room and to other furniture — a side table should be noticeably smaller than a sofa, a dining table taller than a coffee table, etc.

ARCHITECTURAL PRESERVATION:
- Keep ALL architectural elements (walls, floors, ceilings, windows, doors, built-ins, lighting) from the EMPTY ROOM exactly as they are
- Add realistic shadows, reflections, and ambient lighting that match the room's existing lighting conditions

ABSOLUTE PROHIBITIONS:
- Do NOT reproduce or copy ANY furniture appearance from the REFERENCE LAYOUT — it is ONLY for spatial positioning and camera angle
- Do NOT invent, add, or hallucinate any furniture not in the product photos
- Do NOT change the shape, color, material, or design of any product from what is shown in its photo
- Do NOT approximate — if the product photo shows a specific design, render that SPECIFIC design
- Do NOT omit any product — all ${placements.length} products MUST be placed

Style: ${defaultStyle}.`;
    } else if (mode === "proposal_refine") {
      const productList = (placements || [])
        .map((p: any, i: number) => {
          const dimNote = p.dimensions ? ` [Dimensions: ${p.dimensions}]` : "";
          const rotNote = typeof p.rotation === "number" && p.rotation !== 0
            ? ` [Target rotation: ${p.rotation}°]`
            : "";
          return `${i + 1}. "${p.product_name}" by ${p.brand_name}${dimNote}${rotNote}`;
        })
        .join("\n");

      const removeHintLines = (markerHints?.remove_points || [])
        .map((m: any, i: number) => `${i + 1}. (${m.x_percent}%, ${m.y_percent}%)${m.label ? ` — ${m.label}` : ""}`)
        .join("\n");

      const moveHintLine = markerHints?.move_from && markerHints?.move_to
        ? `Move hint: from (${markerHints.move_from.x_percent}%, ${markerHints.move_from.y_percent}%) to (${markerHints.move_to.x_percent}%, ${markerHints.move_to.y_percent}%).`
        : "";

      const userInstruction = refinementPrompt || "Improve the placement and integration of furniture.";

      prompt = `You are performing a TARGETED edit on an already-generated proposal render.

IMAGE ORDER:
1. CURRENT PROPOSAL (base image to preserve)
2. ORIGINAL CLIENT LAYOUT (for room geometry and furniture zones only)
3+ PRODUCT REFERENCE IMAGES (exact products that must appear)

PRODUCT REFERENCES:
${productList || "No explicit product list provided."}

ADMIN REFINEMENT REQUEST:
"${userInstruction}"

${moveHintLine}
${removeHintLines ? `Remove markers:\n${removeHintLines}` : ""}

STRICT EDIT RULES:
- Start from IMAGE 1 (CURRENT PROPOSAL) and keep it as the visual baseline.
- Only change what the admin explicitly asked for.
- Keep all untouched areas pixel-consistent with IMAGE 1 (same walls, floor, lighting, décor, and camera framing).
- Do NOT copy furniture appearance from IMAGE 2; use IMAGE 2 only for spatial guidance.
- For swaps/replacements, match products to the PRODUCT REFERENCE IMAGES exactly (shape, color, material, silhouette, and scale).
- If remove markers are provided, remove objects at those coordinates and inpaint naturally with surrounding surfaces.
- Do not introduce new furniture or alter unrelated objects.

Style: ${defaultStyle}. Output one cohesive render with minimal collateral changes.`;
    } else if (mode === "apply_texture") {
      const wallDescription = body.wallDescription || "the most prominent wall";
      prompt = `You are given an interior architectural render AND a texture/wallpaper swatch image. Apply the provided texture/wallpaper to ${wallDescription} in the scene. The texture should be applied realistically — matching the wall's perspective, lighting, and scale. Tile or repeat the pattern naturally as a real wallpaper installation would look.

CRITICAL: You MUST preserve EVERY other element in the scene EXACTLY as they are — all furniture, other walls, flooring, ceiling, decorations, lighting fixtures, plants, artwork, windows, rugs, and architectural details must remain completely unchanged and in their exact original positions. The output should be identical to the input except for the specified wall surface.

Style: ${defaultStyle}. Produce a single cohesive professional architectural rendering as output.`;
    } else if (mode === "scene_edit") {
      const placementDesc = (placements || [])
        .map((p: any, i: number) => `${i + 1}. "${p.product_name}" by ${p.brand_name} at position (${p.position?.x_percent ?? 50}% from left, ${p.position?.y_percent ?? 50}% from top), size ${p.size_percent ?? 15}% of image width, rotated ${p.rotation_degrees ?? 0}°`)
        .join("\n");

      const hasMask = !!maskDataUrl;
      const hasProducts = placements && placements.length > 0;

      if (hasMask && hasProducts) {
        prompt = `You are given an architectural 3D axonometric interior render. The areas marked in RED in the mask overlay should have the existing furniture REMOVED and replaced with a clean, empty version of that space (matching the room's flooring, wall texture, and lighting). Then, place the following product images into the scene at their specified positions, blending them naturally with correct perspective, shadows, and lighting:\n${placementDesc}\n\nCRITICAL: You MUST preserve EVERY other element in the scene EXACTLY as they are — all other furniture, walls, flooring, decorations, lighting fixtures, plants, artwork, windows, rugs, and architectural details that are NOT in the masked RED areas must remain completely unchanged and in their exact original positions. The output should be identical to the input except for the masked areas and newly placed products.\n\nStyle: ${defaultStyle}. Make the final result look like a single cohesive professional architectural rendering.`;
      } else if (hasMask) {
        prompt = `You are given an architectural 3D axonometric interior render. The areas marked in RED in the mask overlay contain furniture that should be REMOVED. Replace those areas with a clean, empty version of the space — matching the surrounding flooring, wall textures, and lighting.\n\nCRITICAL: You MUST keep EVERY other element in the scene EXACTLY as they are. All furniture, decorations, walls, flooring, plants, artwork, rugs, lighting fixtures, and architectural details OUTSIDE the masked RED areas must remain completely unchanged and in their exact original positions. The output should be pixel-identical to the input except for the masked areas.\n\nStyle: ${defaultStyle}.`;
      } else if (hasProducts) {
        prompt = `You are given an architectural 3D axonometric interior render. Place the following product images into the scene at their specified positions, blending them naturally with correct axonometric perspective, realistic shadows, and lighting:\n${placementDesc}\n\nCRITICAL: You MUST preserve EVERY existing element in the scene EXACTLY as they are — all furniture, walls, flooring, decorations, lighting fixtures, plants, artwork, windows, rugs, and architectural details must remain completely unchanged and in their exact original positions. Only ADD the new products; do NOT remove or alter anything else.\n\nStyle: ${defaultStyle}. Make the final result look like a single cohesive professional architectural rendering.`;
      } else {
        throw new Error("Scene edit requires either a mask (erase areas) or product placements");
      }
    } else {
      throw new Error("Invalid mode. Use: elevation_to_axo, section_to_axo, stylize, composite, 3d_to_cad, cad_overlay, product_swap, freeform, apply_texture, scene_edit, turntable_angle");
    }

    // If a style reference image is provided, append instruction to match its visual style
    if (styleReferenceUrl) {
      prompt += `\n\nIMPORTANT STYLE REFERENCE: A reference image is provided as the LAST image in this message. You MUST match its exact visual style, color grading, lighting, material quality, and rendering technique as closely as possible. The output should look like it was generated in the same batch/session as the reference image. However, choose your OWN optimal camera angle and viewpoint for this specific floor plan — do NOT copy the camera angle from the reference.`;
    } else if (skipStyleReference) {
      prompt += `\n\nIMPORTANT: Generate a FRESH, original interpretation of this drawing. Choose your own optimal camera angle, viewpoint, color palette, and lighting setup. Do NOT replicate any previously seen rendering style — produce a unique result.`;
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

    // Add texture/wallpaper swatch image for apply_texture mode
    if (mode === "apply_texture") {
      const textureUrl = body.textureImageUrl;
      if (textureUrl) {
        content.push({
          type: "image_url",
          image_url: { url: textureUrl },
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

    // Proposal render: add reference (original furnished) image, then empty room is already the main imageUrl, then product images
    if (mode === "proposal_render") {
      // Insert original furnished image BEFORE the empty room (which is already content[1])
      if (referenceImageUrl) {
        // The main imageUrl = empty room. We need original first, then empty, then products.
        // Restructure: [text_prompt, original_furnished, empty_room, ...product_images]
        const emptyRoomEntry = content[1]; // the imageUrl (empty room)
        content[1] = { type: "image_url", image_url: { url: referenceImageUrl } };
        content.splice(2, 0, emptyRoomEntry);
      }
      if (placements && Array.isArray(placements)) {
        for (const p of placements.slice(0, 10)) {
          if (p.image_url) {
            content.push({
              type: "image_url",
              image_url: { url: p.image_url },
            });
          }
        }
      }
    }

    // Proposal refine: original layout reference + previous proposal (imageUrl)
    if (mode === "proposal_refine") {
      // content already has [text_prompt, previous_proposal_image]
      // Insert original layout reference before the proposal
      if (referenceImageUrl) {
        const proposalEntry = content[1];
        content[1] = { type: "image_url", image_url: { url: referenceImageUrl } };
        content.splice(2, 0, proposalEntry);
      }
    }

    // Append style reference image as the LAST image so the AI sees it after all other inputs
    if (styleReferenceUrl) {
      content.push({
        type: "image_url",
        image_url: { url: styleReferenceUrl },
      });
    }

    // Pro for initial axo transforms (quality matters), Flash for everything else (speed)
    const selectedModel = mode === "elevation_to_axo"
      ? "google/gemini-3-pro-image-preview"
      : "google/gemini-3.1-flash-image-preview";

    console.log(`[axo-gen] mode=${mode}, model=${selectedModel}, images=${content.filter((c: any) => c.type === "image_url").length}`);

    const MAX_ATTEMPTS = 3;
    let generatedImage: string | undefined;
    let textResponse = "";

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      // On final attempt, try Pro model as fallback for better image generation
      const attemptModel = attempt === MAX_ATTEMPTS ? "google/gemini-3-pro-image-preview" : selectedModel;
      if (attempt > 1) {
        console.log(`[axo-gen] Retry attempt ${attempt} with model=${attemptModel}`);
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
            model: attemptModel,
            messages: [{ role: "user", content }],
            modalities: ["image", "text"],
            temperature: attempt > 1 ? 0.2 : 0, // slight temperature bump on retries
          }),
        }
      );

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        const errBody = await aiResponse.text();
        if (status === 429) {
          // On rate limit, wait briefly and retry instead of failing immediately
          if (attempt < MAX_ATTEMPTS) {
            console.warn(`[axo-gen] Rate limited on attempt ${attempt}, waiting 3s...`);
            await new Promise(r => setTimeout(r, 3000));
            continue;
          }
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
        console.error(`AI gateway error (attempt ${attempt}):`, status, errBody);
        if (attempt === MAX_ATTEMPTS) throw new Error(`AI generation failed [${status}]`);
        continue;
      }

      const aiData = await aiResponse.json();
      generatedImage = aiData.choices?.[0]?.message?.images?.[0]?.image_url?.url;
      textResponse = aiData.choices?.[0]?.message?.content || "";

      if (generatedImage) {
        console.log(`[axo-gen] Image generated on attempt ${attempt}`);
        break;
      }
      console.warn(`[axo-gen] No image on attempt ${attempt}, textResponse length=${textResponse.length}`);
      if (attempt === MAX_ATTEMPTS) {
        throw new Error("No image was generated after retries. The AI may not have understood the input — try with fewer products or a simpler prompt.");
      }
    }

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
