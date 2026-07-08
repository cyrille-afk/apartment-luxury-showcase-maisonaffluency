import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FN = "send-board-shared";
const SITE_URL = "https://apartment-luxury-showcase-maisonaffluency.lovable.app";

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (char) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char)
  );

// ---------- Structured logging ----------
type LogLevel = "info" | "warn" | "error";
const log = (level: LogLevel, requestId: string, step: string, extra: Record<string, unknown> = {}) => {
  const payload = {
    fn: FN,
    request_id: requestId,
    step,
    level,
    ts: new Date().toISOString(),
    ...extra,
  };
  const line = JSON.stringify(payload);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
};

const serializeError = (err: unknown) => {
  if (err instanceof Error) {
    return { name: err.name, message: err.message, stack: err.stack };
  }
  if (err && typeof err === "object") return err as Record<string, unknown>;
  return { message: String(err) };
};

// Best-effort failure trail: writes a `failed` row to email_send_log so the
// email dashboard surfaces it alongside sent/dlq rows. Also logs.
const recordFailure = async (
  adminClient: ReturnType<typeof createClient> | null,
  requestId: string,
  step: string,
  err: unknown,
  ctx: { boardId?: string; recipient?: string | null } = {},
) => {
  log("error", requestId, step, { error: serializeError(err), ...ctx });
  if (!adminClient) return;
  try {
    await adminClient.from("email_send_log").insert({
      message_id: `board-shared-fail-${requestId}`,
      template_name: "board-shared",
      recipient_email: ctx.recipient ?? "unknown",
      status: "failed",
      error_message: `[${step}] ${serializeError(err).message ?? "unknown"}`.slice(0, 1000),
      metadata: { request_id: requestId, step, board_id: ctx.boardId ?? null, error: serializeError(err) },
    });
  } catch (logErr) {
    log("error", requestId, "record_failure_write_failed", { error: serializeError(logErr) });
  }
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const requestId = crypto.randomUUID();
  const started = Date.now();
  let adminClient: ReturnType<typeof createClient> | null = null;
  let boardIdForLog: string | undefined;
  let recipientForLog: string | null = null;

  try {
    log("info", requestId, "request_received", { method: req.method });

    // ---------- Env sanity ----------
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      log("error", requestId, "missing_env", {
        has_url: !!SUPABASE_URL,
        has_anon: !!SUPABASE_ANON_KEY,
        has_service_role: !!SUPABASE_SERVICE_ROLE_KEY,
      });
      return new Response(JSON.stringify({ error: "Server misconfigured", request_id: requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---------- Auth ----------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      log("warn", requestId, "missing_bearer");
      return new Response(JSON.stringify({ error: "Unauthorized", request_id: requestId }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Guard against SDK/API drift (this is what silently broke sending before).
    if (typeof (supabaseClient.auth as any).getClaims !== "function") {
      const err = new Error("supabase-js SDK missing auth.getClaims — bump @supabase/supabase-js version");
      adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
      await recordFailure(adminClient, requestId, "sdk_missing_getClaims", err);
      return new Response(JSON.stringify({ error: err.message, request_id: requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    let claimsData: any = null;
    let authError: any = null;
    try {
      const res = await (supabaseClient.auth as any).getClaims(token);
      claimsData = res?.data;
      authError = res?.error;
    } catch (e) {
      authError = e;
    }
    const claims = claimsData?.claims as { sub?: string } | undefined;
    const user = claims?.sub ? { id: claims.sub } : null;
    if (authError || !user) {
      log("warn", requestId, "auth_failed", { error: authError ? serializeError(authError) : "no_sub" });
      return new Response(JSON.stringify({ error: "Unauthorized", request_id: requestId }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    log("info", requestId, "auth_ok", { user_id: user.id });

    // ---------- Body ----------
    let body: any;
    try {
      body = await req.json();
    } catch (e) {
      log("warn", requestId, "bad_json", { error: serializeError(e) });
      return new Response(JSON.stringify({ error: "Invalid JSON body", request_id: requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    const { boardId } = body ?? {};
    if (!boardId) {
      log("warn", requestId, "missing_boardId");
      return new Response(JSON.stringify({ error: "Missing boardId", request_id: requestId }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    boardIdForLog = boardId;

    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

    // ---------- Fetch board ----------
    const { data: board, error: boardError } = await adminClient
      .from("client_boards")
      .select("*")
      .eq("id", boardId)
      .eq("user_id", user.id)
      .single();

    if (boardError || !board) {
      log("warn", requestId, "board_not_found", { error: boardError ? serializeError(boardError) : "no_row", board_id: boardId, user_id: user.id });
      return new Response(JSON.stringify({ error: "Board not found", request_id: requestId }), {
        status: 404,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }
    recipientForLog = board.client_email ?? null;

    if (!board.client_email) {
      log("info", requestId, "no_client_email", { board_id: boardId });
      return new Response(JSON.stringify({ success: true, sent: false, message: "No client email on board", request_id: requestId }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---------- Profile + items ----------
    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("first_name, last_name, company")
      .eq("id", user.id)
      .single();
    if (profileError) {
      log("warn", requestId, "profile_lookup_failed", { error: serializeError(profileError) });
    }

    const senderName = profile
      ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Your designer"
      : "Your designer";
    const senderCompany = profile?.company || "";

    const { count: itemCount, error: itemCountError } = await adminClient
      .from("client_board_items")
      .select("*", { count: "exact", head: true })
      .eq("board_id", boardId);
    if (itemCountError) {
      log("warn", requestId, "item_count_failed", { error: serializeError(itemCountError) });
    }

    // ---------- Suppression ----------
    const { data: suppressed, error: supErr } = await adminClient
      .from("suppressed_emails")
      .select("id")
      .eq("email", board.client_email)
      .limit(1);
    if (supErr) {
      log("warn", requestId, "suppression_lookup_failed", { error: serializeError(supErr) });
    }
    if (suppressed && suppressed.length > 0) {
      log("info", requestId, "recipient_suppressed", { recipient: board.client_email });
      return new Response(JSON.stringify({ success: true, sent: false, message: "Email suppressed", request_id: requestId }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // ---------- Compose ----------
    const boardLink = `${SITE_URL}/board/${board.share_token}`;
    const boardTitle = board.title || "Curated Selection";
    const clientName = board.client_name || "";
    const subject = `${escapeHtml(senderName)} has curated a selection for you — ${escapeHtml(boardTitle)}`;

    const html = `
<div style="font-family:Georgia,'Times New Roman',serif;max-width:600px;margin:0 auto;color:#333;background:#fff;">
  <div style="background:#1a2e2a;padding:32px 40px;text-align:center;">
    <h1 style="font-family:Georgia,serif;font-size:20px;font-weight:normal;color:#f5f0e8;letter-spacing:2px;margin:0;">MAISON AFFLUENCY</h1>
    <p style="font-family:Georgia,serif;font-size:10px;color:#c9b99a;letter-spacing:0.2em;text-transform:uppercase;margin:8px 0 0;">Curated Luxury Furnishings</p>
  </div>
  <div style="padding:40px;background:#faf8f5;">
    ${clientName ? `<p style="font-size:14px;color:#1a2e2a;margin:0 0 16px;">Dear ${escapeHtml(clientName)},</p>` : ""}
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 24px;">
      ${escapeHtml(senderName)}${senderCompany ? ` from ${escapeHtml(senderCompany)}` : ""} has prepared a curated selection of luxury furnishings for your review.
    </p>
    <div style="border-left:3px solid #1a2e2a;padding-left:16px;margin-bottom:28px;background:#fff;padding:16px 16px 16px 20px;border-radius:0 4px 4px 0;">
      <p style="font-size:18px;color:#1a2e2a;margin:0 0 4px;font-style:italic;font-family:Georgia,serif;">${escapeHtml(boardTitle)}</p>
      <p style="font-size:13px;color:#888;margin:0;">${itemCount || 0} piece${(itemCount || 0) === 1 ? "" : "s"} selected for you</p>
    </div>
    <p style="font-size:14px;color:#555;line-height:1.7;margin:0 0 32px;">
      Please take a moment to review the selection. You can <strong>approve or decline</strong> each piece and leave comments to share your preferences.
    </p>
    <div style="text-align:center;margin-bottom:32px;">
      <a href="${boardLink}" style="display:inline-block;padding:14px 36px;background:#2d5a4e;color:#f5f0e8;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:0.15em;font-family:Arial,sans-serif;border-radius:2px;">
        Review Your Selection
      </a>
    </div>
    <p style="font-size:12px;color:#aaa;line-height:1.5;margin:0;text-align:center;">
      No account needed — simply click the button above to view and respond.
    </p>
  </div>
  <div style="border-top:1px solid #e0dcd5;padding:24px 40px;text-align:center;background:#fff;">
    <p style="font-size:11px;color:#aaa;margin:0 0 4px;">
      This email was sent on behalf of ${escapeHtml(senderName)} via Maison Affluency
    </p>
    <p style="font-size:11px;color:#ccc;margin:0;">
      <a href="${SITE_URL}" style="color:#999;text-decoration:underline;">maisonaffluency.com</a>
    </p>
  </div>
</div>`;

    // ---------- Enqueue ----------
    const messageId = `board-shared-${boardId}-${Date.now()}`;
    const { error: enqueueError } = await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: board.client_email,
        from: "Maison Affluency <trade@notify.www.maisonaffluency.com>",
        sender_domain: "notify.www.maisonaffluency.com",
        subject,
        html,
        purpose: "transactional",
        label: "board-shared",
        message_id: messageId,
        idempotency_key: messageId,
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      await recordFailure(adminClient, requestId, "enqueue_email_rpc_failed", enqueueError, {
        boardId,
        recipient: board.client_email,
      });
      return new Response(JSON.stringify({ error: "Failed to queue email", request_id: requestId }), {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { error: logInsertError } = await adminClient.from("email_send_log").insert({
      message_id: messageId,
      template_name: "board-shared",
      recipient_email: board.client_email,
      status: "pending",
    });
    if (logInsertError) {
      log("warn", requestId, "email_send_log_pending_insert_failed", { error: serializeError(logInsertError) });
    }

    log("info", requestId, "enqueued", {
      message_id: messageId,
      board_id: boardId,
      recipient: board.client_email,
      duration_ms: Date.now() - started,
    });

    return new Response(JSON.stringify({ success: true, sent: true, message_id: messageId, request_id: requestId }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (err) {
    await recordFailure(adminClient, requestId, "unhandled_exception", err, {
      boardId: boardIdForLog,
      recipient: recipientForLog,
    });
    return new Response(
      JSON.stringify({ error: (err as Error)?.message ?? "Internal error", request_id: requestId }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } },
    );
  }
};

serve(handler);
