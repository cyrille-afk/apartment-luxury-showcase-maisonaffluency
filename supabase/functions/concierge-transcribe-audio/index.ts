// Mandarin (and any-lang) speech-to-text proxy for the concierge composer.
// Client uploads a complete WAV (recorded via Web Audio API); we forward it
// to the Lovable AI Gateway transcription endpoint and stream the SSE back
// to the browser. LOVABLE_API_KEY stays server-side.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/audio/transcriptions";
const MODEL = "openai/gpt-4o-mini-transcribe";

// 5 MB cap for a 16 kHz mono WAV — plenty for any hand-held voice memo.
const MAX_BYTES = 5 * 1024 * 1024;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-concierge-lang",
  "Access-Control-Expose-Headers": "x-request-id",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const inbound = await req.formData();
    const file = inbound.get("file");
    if (!(file instanceof File)) {
      return new Response(JSON.stringify({ error: "missing_file" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size < 2048) {
      return new Response(JSON.stringify({ error: "empty_recording" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (file.size > MAX_BYTES) {
      return new Response(JSON.stringify({ error: "file_too_large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rebuild form so the forwarded name matches the real container (wav).
    const upstream = new FormData();
    upstream.append("model", MODEL);
    upstream.append("file", file, "recording.wav");
    // Non-streaming: return one JSON transcript. Simpler and safe for short clips.
    // (Voice notes are typically <60s so we don't need SSE UX here.)

    const response = await fetch(GATEWAY_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}` },
      body: upstream,
    });

    const bodyText = await response.text();
    if (!response.ok) {
      console.error("transcribe upstream error", response.status, bodyText);
      return new Response(JSON.stringify({
        error: "transcription_failed",
        status: response.status,
        detail: bodyText.slice(0, 500),
      }), {
        status: response.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Response is JSON with { text, ... }. Return as-is.
    return new Response(bodyText, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("transcribe fatal", err);
    return new Response(JSON.stringify({ error: "internal_error", detail: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
