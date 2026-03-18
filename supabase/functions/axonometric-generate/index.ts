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

    const { imageUrl, mode, style, overlayImages } = await req.json();
    // mode: "elevation_to_axo" | "section_to_axo" | "stylize" | "composite"

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
    } else {
      throw new Error("Invalid mode. Use: elevation_to_axo, section_to_axo, stylize, composite");
    }

    // Build message content
    const content: any[] = [{ type: "text", text: prompt }];
    content.push({
      type: "image_url",
      image_url: { url: imageUrl },
    });

    // Add overlay product images for composite mode
    if (mode === "composite" && overlayImages && Array.isArray(overlayImages)) {
      for (const img of overlayImages.slice(0, 5)) {
        content.push({
          type: "image_url",
          image_url: { url: img },
        });
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
