import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { TEMPLATES } from '../_shared/transactional-email-templates/registry.tsx'
import { prepareTradeActivation } from '../_shared/tradeActivation.ts'

// Configuration baked in at scaffold time — do NOT change these manually.
// To update, re-run the email domain setup flow.
const SITE_NAME = "Maison Affluency"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers — never the root domain.
// The email API looks up this exact domain; a mismatch causes "No email domain record found".
const SENDER_DOMAIN = "notify.www.maisonaffluency.com"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// When display_from_root is enabled, this can be the root domain for cleaner branding,
// even though actual sending uses the subdomain above.
const FROM_DOMAIN = "www.maisonaffluency.com"

// Generate a cryptographically random 32-byte hex token
function generateToken(): string {
  const bytes = new Uint8Array(32)
  crypto.getRandomValues(bytes)
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// Auth note: this function uses verify_jwt = true in config.toml, so Supabase's
// gateway validates the caller's JWT (anon or service_role) before the request
// reaches this code. No in-function auth check is needed.

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Parse request body
  let templateName: string
  let recipientEmail: string
  let idempotencyKey: string
  let messageId: string
  let templateData: Record<string, any> = {}
  try {
    const body = await req.json()
    templateName = body.templateName || body.template_name
    recipientEmail = body.recipientEmail || body.recipient_email
    messageId = crypto.randomUUID()
    idempotencyKey = body.idempotencyKey || body.idempotency_key || messageId
    if (body.templateData && typeof body.templateData === 'object') {
      templateData = body.templateData
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON in request body' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (!templateName) {
    return new Response(
      JSON.stringify({ error: 'templateName is required' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // ── Privileged caller check ────────────────────────────────────────────
  // service role / admin → any template. Otherwise only two narrow cases:
  //  • welcome-registration for a just-created account whose email matches
  //  • manual-shipping-quote-request by a signed-in user, forced to concierge
  {
    const deny = (status: number, error: string) =>
      new Response(JSON.stringify({ error }), {
        status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    const authHeader = req.headers.get('Authorization') ?? ''
    const svc = createClient(supabaseUrl, supabaseServiceKey)
    let privileged = authHeader === `Bearer ${supabaseServiceKey}`
    let callerId: string | null = null
    if (!privileged && authHeader.startsWith('Bearer ')) {
      const anon = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY')!)
      const { data } = await anon.auth.getClaims(authHeader.slice(7))
      const sub = data?.claims?.sub as string | undefined
      if (sub && data?.claims?.role === 'authenticated') {
        callerId = sub
        const { data: roles } = await svc
          .from('user_roles').select('role').eq('user_id', sub).in('role', ['admin', 'super_admin'])
        privileged = (roles?.length ?? 0) > 0
      }
    }
    if (templateName === 'board-collaborator-invite' && callerId) {
      // Always rebuild collaborator invitations from stored data, including for
      // admin callers. This prevents placeholder copy and a dead "#" CTA.
      const m = /^board-invite-([0-9a-f-]{36})$/i.exec(String(idempotencyKey))
      const token = String(templateData.token ?? '')
      if (!m || !/^[0-9a-f]{48}$/.test(token)) return deny(403, 'Forbidden')
      const { data: inv } = await svc
        .from('board_invites')
        .select('board_id, email, role, token_hash, invited_by, created_at, board:client_boards(title, studio_name, studio_logo_url, hide_maison_branding, studio_id, project_id)')
        .eq('id', m[1]).maybeSingle()
      const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))))
        .map((b) => b.toString(16).padStart(2, '0')).join('')
      if (!inv || inv.invited_by !== callerId || inv.token_hash !== hash || Date.now() - Date.parse(inv.created_at) > 15 * 60 * 1000) return deny(403, 'Forbidden')
      const board = (inv as any).board ?? {}
      let studioName = board.studio_name as string | null
      let studioLogoUrl = board.studio_logo_url as string | null
      if ((!studioName || !studioLogoUrl) && board.studio_id) {
        const { data: s } = await svc.from('studios').select('name, logo_url').eq('id', board.studio_id).maybeSingle()
        studioName = studioName || s?.name || null
        studioLogoUrl = studioLogoUrl || s?.logo_url || null
      }
      let projectName: string | null = null
      const { data: slug } = await svc.rpc('_board_slug', { _board_id: (inv as any).board_id ?? null })
      if (board.project_id) {
        const { data: p } = await svc.from('projects').select('name').eq('id', board.project_id).maybeSingle()
        projectName = p?.name ?? null
      }
      recipientEmail = inv.email
      templateData = {
        studioName: studioName || 'Your designer', studioLogoUrl,
        hideMaisonBranding: board.hide_maison_branding !== false,
        projectName: projectName || board.title || 'Project portfolio',
        boardTitle: board.title || 'Curated selection', role: inv.role,
        link: `https://www.maisonaffluency.com/shared/board/${slug || token}`,
      }
    } else if (!privileged) {
      if (templateName === 'welcome-registration') {
        const m = /^welcome-reg-([0-9a-f-]{36})$/i.exec(String(idempotencyKey))
        if (!m) return deny(403, 'Forbidden')
        const { data: u } = await svc.auth.admin.getUserById(m[1])
        const created = u?.user?.created_at ? Date.parse(u.user.created_at) : 0
        if (
          !u?.user?.email ||
          u.user.email.toLowerCase() !== String(recipientEmail ?? '').toLowerCase() ||
          Date.now() - created > 15 * 60 * 1000
        ) return deny(403, 'Forbidden')
      } else if (templateName === 'manual-shipping-quote-request' && callerId) {
        recipientEmail = 'concierge@maisonaffluency.com'
      } else {
        return deny(callerId ? 403 : 401, callerId ? 'Forbidden' : 'Unauthorized')
      }
    }
  }

  // Only privileged callers reach trade notices above. Validate edited copy
  // before any suppression/token/queue writes; templates escape text via React.
  if (/^trade-(approval|rejection)(-copy-(concierge|cyrille))?$/.test(templateName)) {
    const { subjectText, bodyText } = templateData
    if ((subjectText !== undefined && (typeof subjectText !== 'string' || !subjectText.trim() || subjectText.length > 200 || /[\r\n]/.test(subjectText))) ||
        (bodyText !== undefined && (typeof bodyText !== 'string' || !bodyText.trim() || bodyText.length > 20000))) {
      return new Response(JSON.stringify({ error: 'Invalid notification draft' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  if (
    (templateName === 'quote-confirmation-payment-link' ||
      templateName === 'quote-confirmation-internal-copy') &&
    (typeof templateData.quotePdfUrl !== 'string' ||
      !templateData.quotePdfUrl.startsWith('https://'))
  ) {
    return new Response(
      JSON.stringify({ error: 'A verified formal quote PDF link is required before sending' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 1. Look up template from registry (early — needed to resolve recipient)
  const template = TEMPLATES[templateName]

  if (!template) {
    console.error('Template not found in registry', { templateName })
    return new Response(
      JSON.stringify({
        error: `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`,
      }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Resolve effective recipient: template-level `to` takes precedence over
  // the caller-provided recipientEmail. This allows notification templates
  // to always send to a fixed address (e.g., site owner from env var).
  const effectiveRecipient = template.to || recipientEmail

  if (!effectiveRecipient) {
    return new Response(
      JSON.stringify({
        error: 'recipientEmail is required (unless the template defines a fixed recipient)',
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // Create Supabase client with service role (bypasses RLS)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // 2. Check suppression list (fail-closed: if we can't verify, don't send)
  const { data: suppressed, error: suppressionError } = await supabase
    .from('suppressed_emails')
    .select('id')
    .eq('email', effectiveRecipient.toLowerCase())
    .maybeSingle()

  if (suppressionError) {
    console.error('Suppression check failed — refusing to send', {
      error: suppressionError
    })
    return new Response(
      JSON.stringify({ error: 'Failed to verify suppression status' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (suppressed) {
    // Log the suppressed attempt
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
    })

    console.log('Email suppressed', { templateName })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  // 3. Get or create unsubscribe token (one token per email address)
  const normalizedEmail = effectiveRecipient.toLowerCase()
  let unsubscribeToken: string

  // Check for existing token for this email
  const { data: existingToken, error: tokenLookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token, used_at')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (tokenLookupError) {
    console.error('Token lookup failed', {
      error: tokenLookupError
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to look up unsubscribe token',
    })
    return new Response(
      JSON.stringify({ error: 'Failed to prepare email' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (existingToken && !existingToken.used_at) {
    // Reuse existing unused token
    unsubscribeToken = existingToken.token
  } else if (!existingToken) {
    // Create new token — upsert handles concurrent inserts gracefully
    unsubscribeToken = generateToken()
    const { error: tokenError } = await supabase
      .from('email_unsubscribe_tokens')
      .upsert(
        { token: unsubscribeToken, email: normalizedEmail },
        { onConflict: 'email', ignoreDuplicates: true }
      )

    if (tokenError) {
      console.error('Failed to create unsubscribe token', {
        error: tokenError
    })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to create unsubscribe token',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    // If another request raced us, our upsert was silently ignored.
    // Re-read to get the actual stored token.
    const { data: storedToken, error: reReadError } = await supabase
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', normalizedEmail)
      .maybeSingle()

    if (reReadError || !storedToken) {
      console.error('Failed to read back unsubscribe token after upsert', {
        error: reReadError
    })
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: templateName,
        recipient_email: effectiveRecipient,
        status: 'failed',
        error_message: 'Failed to confirm unsubscribe token storage',
      })
      return new Response(
        JSON.stringify({ error: 'Failed to prepare email' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }
    unsubscribeToken = storedToken.token
  } else {
    // Token exists but is already used — email should have been caught by suppression check above.
    // This is a safety fallback; log and skip sending.
    console.warn('Unsubscribe token already used but email not suppressed', {
    })
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'suppressed',
      error_message:
        'Unsubscribe token used but email missing from suppressed list',
    })
    return new Response(
      JSON.stringify({ success: false, reason: 'email_suppressed' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }

  if (templateName === 'trade-approval') {
    const { data: prior, error: priorError } = await supabase.from('email_send_log')
      .select('id').eq('template_name', templateName).eq('recipient_email', effectiveRecipient)
      .contains('metadata', { idempotency_key: idempotencyKey }).in('status', ['pending', 'sent']).limit(1)
    if (priorError) return new Response(JSON.stringify({ error: 'Could not verify notification retry' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    if (prior?.length) return new Response(JSON.stringify({ success: true, queued: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    try { templateData = { ...templateData, activationUrl: await prepareTradeActivation(supabase, effectiveRecipient) } }
    catch (error) {
      return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Could not prepare activation' }), { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }
  } else if (templateName.startsWith('trade-approval-copy-')) {
    delete templateData.activationUrl
  }

  // 4. Render React Email template to HTML and plain text
  const html = await renderAsync(
    React.createElement(template.component, templateData)
  )
  const plainText = await renderAsync(
    React.createElement(template.component, templateData),
    { plainText: true }
  )

  // Resolve subject — supports static string or dynamic function
  const resolvedSubject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  // 5. Enqueue the pre-rendered email for async processing by the dispatcher.
  // The dispatcher (process-email-queue) handles sending, retries, and rate-limit backoff.

  // Log pending BEFORE enqueue so we have a record even if enqueue crashes
  await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: templateName,
    recipient_email: effectiveRecipient,
    status: 'pending',
    metadata: { idempotency_key: idempotencyKey },
  })

  const { error: enqueueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: effectiveRecipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: resolvedSubject,
      html,
      text: plainText,
      purpose: 'transactional',
      label: templateName,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue email', {
      error: enqueueError,
      templateName
    })

    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: templateName,
      recipient_email: effectiveRecipient,
      status: 'failed',
      error_message: 'Failed to enqueue email',
    })

    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  console.log('Transactional email enqueued', { templateName })

  return new Response(
    JSON.stringify({ success: true, queued: true }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  )
})
