// Mandarin concierge → director hand-off.
//
// Called by the client after each assistant turn on lang=zh, and whenever
// the user explicitly requests a Singapore viewing. Runs a small intent
// classifier (Gemini flash, JSON output) over the last N turns; when the
// signal is high, upserts a row in cn_director_briefs and emails the
// director inbox via the shared send-transactional-email pipeline.
//
// No PII is logged. The function is CORS-safe and idempotent per session
// (24h dedupe unless the caller sets force=true, which the viewing CTA does).
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CN_DIRECTOR_EMAIL = Deno.env.get("CN_DIRECTOR_EMAIL") || "";
const CHAT_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MODEL = "google/gemini-3-flash-preview";

interface ClientMsg {
  role: "user" | "assistant";
  content: string;
}

interface Body {
  session_id?: string | null;
  invited_name?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  messages: ClientMsg[];
  // Manual triggers (viewing CTA): skip classifier, always insert.
  force?: boolean;
  viewing_requested?: boolean;
  pieces_of_interest?: Array<{ product_id?: string; name: string; reason?: string }>;
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.messages?.length) {
    return new Response(JSON.stringify({ error: "missing_messages" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // session_id column is uuid + FK; only forward when it looks like a uuid.
  const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  const sessionUuid = body.session_id && UUID_RE.test(body.session_id) ? body.session_id : null;
  const sessionKey = sessionUuid || "no-session";
  const invitedName = (body.invited_name || "").slice(0, 120) || null;

  // 24h dedupe unless force=true.
  if (!body.force && sessionKey !== "no-session") {
    const { data: existing } = await admin
      .from("cn_director_briefs")
      .select("id, created_at")
      .eq("session_id", sessionKey)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .limit(1);
    if (existing?.length) {
      return new Response(JSON.stringify({ status: "already_briefed", brief_id: existing[0].id }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // Classifier — cheap Gemini flash JSON pass.
  let structured = {
    high_intent: !!body.force,
    project_summary: "",
    aesthetic: "",
    budget_band: "",
    sentiment: "",
    pieces_of_interest: body.pieces_of_interest || [],
  };

  if (!body.force) {
    try {
      const transcript = body.messages.slice(-10).map((m) => `[${m.role}]: ${m.content}`).join("\n");
      const classifyPrompt = `You are analysing a Mandarin luxury-design concierge conversation.
Output STRICT JSON — no prose, no markdown. Schema:
{
  "high_intent": boolean,        // true only if the user names a real project (space/style/budget) OR asks for a viewing
  "project_summary": string,     // <= 400 chars, English, factual
  "aesthetic": string,           // <= 120 chars, English keywords
  "budget_band": string,         // one of: "unspecified" | "<500k SGD" | "500k–2M SGD" | "2–10M SGD" | ">10M SGD"
  "sentiment": string,           // one word: curious | evaluating | committed | hesitant
  "pieces_of_interest": [{ "name": string, "reason": string }]
}

Conversation:
${transcript}`;

      const r = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: MODEL,
          messages: [{ role: "user", content: classifyPrompt }],
          response_format: { type: "json_object" },
        }),
      });
      if (r.ok) {
        const j = await r.json();
        const raw = j?.choices?.[0]?.message?.content;
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            structured = { ...structured, ...parsed };
          } catch (e) {
            console.warn("cn-brief classifier json parse failed", e);
          }
        }
      } else {
        console.warn("cn-brief classifier upstream error", r.status);
      }
    } catch (e) {
      console.warn("cn-brief classifier failed", e);
    }
  }

  if (!structured.high_intent && !body.viewing_requested) {
    return new Response(JSON.stringify({ status: "low_intent" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Insert brief.
  const insertPayload = {
    session_id: body.session_id || null,
    invited_name: invitedName,
    contact_email: body.contact_email || null,
    contact_phone: body.contact_phone || null,
    project_summary: structured.project_summary || null,
    aesthetic: structured.aesthetic || null,
    budget_band: structured.budget_band || null,
    sentiment: structured.sentiment || null,
    pieces_of_interest: structured.pieces_of_interest || [],
    viewing_requested_at: body.viewing_requested ? new Date().toISOString() : null,
    status: "new",
  };

  const { data: inserted, error: insertErr } = await admin
    .from("cn_director_briefs")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertErr) {
    console.error("cn-brief insert failed", insertErr);
    return new Response(JSON.stringify({ error: "insert_failed", detail: insertErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Fire the director email (best-effort).
  if (CN_DIRECTOR_EMAIL) {
    try {
      const emailResp = await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "cn-director-brief",
          recipientEmail: CN_DIRECTOR_EMAIL,
          idempotencyKey: `cn-brief-${inserted.id}${body.viewing_requested ? "-viewing" : ""}`,
          templateData: {
            invitedName: invitedName || "Anonymous VIP",
            viewingRequested: !!body.viewing_requested,
            projectSummary: structured.project_summary,
            aesthetic: structured.aesthetic,
            budgetBand: structured.budget_band,
            sentiment: structured.sentiment,
            piecesOfInterest: structured.pieces_of_interest,
            contactEmail: body.contact_email,
            contactPhone: body.contact_phone,
            briefId: inserted.id,
          },
        },
      });
      if (emailResp.error) console.error("cn-brief email failed", emailResp.error);
      else {
        await admin
          .from("cn_director_briefs")
          .update({ last_email_sent_at: new Date().toISOString() })
          .eq("id", inserted.id);
      }
    } catch (e) {
      console.error("cn-brief email throw", e);
    }
  }

  return new Response(JSON.stringify({ status: "briefed", brief_id: inserted.id }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
