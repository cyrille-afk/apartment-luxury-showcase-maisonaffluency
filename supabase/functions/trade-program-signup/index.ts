import { detectFileType } from '../_shared/fileSignature.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { sendTradeRequestWhatsApp } from '../_shared/twilioWhatsAppSender.ts'
import { scoreTradeApplication } from '../_shared/tradeRadar.ts'

const ADMIN_EMAILS = ['concierge@myaffluency.com', 'cyrille@maisonaffluency.com']

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Server configuration error' }, 500)

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const email = String(body.email ?? '').trim().toLowerCase()
  const step = Number(body.step ?? 1)
  const companyName = body.companyName ? String(body.companyName).trim().slice(0, 200) : null
  const websiteUrl = body.websiteUrl ? String(body.websiteUrl).trim().slice(0, 300) : null
  const businessRegNumber = body.businessRegNumber
    ? String(body.businessRegNumber).trim().slice(0, 120)
    : null

  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    return json({ error: 'A valid work email is required' }, 400)
  }
  if (step !== 1 && step !== 2 && step !== 3) return json({ error: 'Invalid step' }, 400)
  if (
    step === 2 && websiteUrl &&
    !/^@[A-Za-z0-9._]{1,30}$/.test(websiteUrl) &&
    !/^(https?:\/\/)?([A-Za-z0-9-]+\.)+[A-Za-z]{2,}(\/\S*)?$/.test(websiteUrl)
  ) {
    return json({ error: 'Enter a website or an Instagram handle starting with @' }, 400)
  }

  // Bot protection: the final submission (account creation + alerts) requires
  // a valid Cloudflare Turnstile token before any insert or notification.
  if (step === 3) {
    const token = String(body['cf-turnstile-response'] ?? '').trim()
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
    if (!secret) return json({ error: 'Security check unavailable' }, 503)
    if (!token || token.length > 4096) return json({ error: 'Security check required' }, 403)
    const ip = req.headers.get('cf-connecting-ip') ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? ''
    try {
      const form = new URLSearchParams({ secret, response: token })
      if (ip) form.set('remoteip', ip)
      const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form })
      const v = await r.json()
      if (!v.success) {
        console.warn('Turnstile failed:', v['error-codes'])
        return json({ error: 'Security check failed' }, 403)
      }
    } catch (err) {
      console.error('Turnstile verify error:', err)
      return json({ error: 'Security check failed' }, 403)
    }
  }

  const supabase = createClient(supabaseUrl, serviceKey)

  const { data: existing } = await supabase
    .from('trade_program_signups')
    .select('id, invite_email_sent_at')
    .ilike('email', email)
    .maybeSingle()

  const payload: Record<string, unknown> = { email, step }
  if (step === 2) {
    payload.company_name = companyName
    payload.website_url = websiteUrl
    payload.portfolio_reference = websiteUrl
  }
  if (step === 3) {
    payload.business_reg_number = businessRegNumber
  }
  if (!existing) {
    payload.user_agent = (req.headers.get('user-agent') ?? '').slice(0, 500) || null
    payload.referrer = (req.headers.get('referer') ?? '').slice(0, 500) || null
  }

  let signupId = existing?.id as string | undefined
  if (existing) {
    const { error } = await supabase
      .from('trade_program_signups')
      .update(payload)
      .eq('id', existing.id)
    if (error) {
      console.error('signup update failed', error)
      return json({ error: 'Could not save your details' }, 500)
    }
  } else {
    const { data, error } = await supabase
      .from('trade_program_signups')
      .insert(payload)
      .select('id')
      .single()
    if (error) {
      console.error('signup insert failed', error)
      return json({ error: 'Could not save your details' }, 500)
    }
    signupId = data.id
  }

  // Step 3: store the uploaded credential document in the private bucket.
  if (step === 3 && signupId) {
    const doc = body.document as { name?: unknown; contentType?: unknown; data?: unknown } | undefined
    if (doc && typeof doc.data === 'string' && doc.data.length > 0) {
      const base64 = doc.data
      const contentType = typeof doc.contentType === 'string' && doc.contentType
        ? doc.contentType.slice(0, 120)
        : 'application/octet-stream'
      const rawName = typeof doc.name === 'string' && doc.name ? doc.name : 'credential.pdf'
      const safeName = rawName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(-120)
      // Rough base64 size guard: ~15 MB decoded
      if (base64.length <= 21 * 1024 * 1024) {
        try {
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const detected = detectFileType(bytes)
          if (!detected) throw new Error('credential rejected: not a PDF/PNG/JPEG')
          void contentType
          const ext = detected === 'application/pdf' ? 'pdf' : detected === 'image/png' ? 'png' : 'jpg'
          const path = `hero-signups/${signupId}/${Date.now()}-${safeName.replace(/\.[^.]*$/, '')}.${ext}`
          const { error: upErr } = await supabase.storage
            .from('trade-credentials')
            .upload(path, bytes, { contentType: detected })
          if (upErr) {
            console.error('credential upload failed', upErr)
          } else {
            await supabase
              .from('trade_program_signups')
              .update({ credential_document_path: path })
              .eq('id', signupId)
          }
        } catch (e) {
          console.error('credential decode failed', e)
        }
      } else {
        console.error('credential document too large')
      }
    }
  }

  // Applicant receipt: on first submission AND on every completed application
  // (step 3), so returning applicants still get a confirmation.
  const submissionStamp = Date.now()
  let emailSent = Boolean(existing?.invite_email_sent_at) && step !== 3
  if (!emailSent) {
    const { error: mailError } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'trade-program-invitation',
        recipientEmail: email,
        idempotencyKey: step === 3
          ? `trade-program-invitation-${signupId}-s3-${submissionStamp}`
          : `trade-program-invitation-${signupId}`,
        templateData: {
          firstName: body.firstName ? String(body.firstName).trim().slice(0, 100) : undefined,
          email,
          companyName,
        },
      },
    })
    if (mailError) {
      const errorMessage = String(mailError.message || mailError).slice(0, 2000)
      console.error('Trade Program invitation enqueue failed', { signupId, error: errorMessage })
      await supabase.from('admin_alert_log').insert({
        channel: 'email',
        event: 'trade_program_application_email_failed',
        status: 'failed',
        application_id: null,
        payload: { signup_id: signupId, recipient_email: email, template_name: 'trade-program-invitation', stage: 'enqueue' },
        error: errorMessage,
      })
    } else {
      emailSent = true
      await supabase
        .from('trade_program_signups')
        .update({ invite_email_sent_at: new Date().toISOString() })
        .eq('id', signupId!)
    }
  }

  // Admin alerts on completed application: WhatsApp + email to concierge/owner.
  if (step === 3 && signupId) {
    const { data: row } = await supabase
      .from('trade_program_signups')
      .select('company_name, website_url, portfolio_reference, business_reg_number, credential_document_path')
      .eq('id', signupId)
      .maybeSingle()
    const clean = (v?: string | null) => (v ?? '').replace(/\s+/g, ' ').trim()
    const studio = clean(row?.company_name) || '(not provided)'

    // Inbound pipeline: create/refresh the trade account in pending_review and
    // kick off the Instagram/website Vision AI analysis in the background.
    const { data: acct, error: acctErr } = await supabase
      .from('trade_accounts')
      .upsert({
        signup_id: signupId,
        email,
        studio_name: clean(row?.company_name) || null,
        contact_name: body.firstName ? String(body.firstName).trim().slice(0, 100) : null,
        website_or_ig: clean(row?.portfolio_reference ?? row?.website_url) || null,
        business_reg_number: row?.business_reg_number ?? null,
        credential_document_path: row?.credential_document_path ?? null,
      }, { onConflict: 'signup_id' })
      .select('id, status')
      .single()
    if (acctErr) console.error('trade_accounts upsert failed', acctErr)
    if (acct?.id) {
      await supabase.from('studio_aesthetic_dna')
        .upsert({ trade_account_id: acct.id, status: 'pending' }, { onConflict: 'trade_account_id', ignoreDuplicates: true })
      const task = fetch(`${supabaseUrl}/functions/v1/analyze-studio-aesthetic`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ trade_account_id: acct.id }),
      }).then((r) => r.text()).catch((e) => console.error('aesthetic analysis trigger failed', e))
      // deno-lint-ignore no-explicit-any
      const rt = (globalThis as any).EdgeRuntime
      if (rt?.waitUntil) rt.waitUntil(task)
    }
    // AI Critical Radar runs in the background after Turnstile validation;
    // the applicant's response never waits on it. The WhatsApp alert is sent
    // once scoring finishes (or fails), with the radar block included.
    const websiteOrIg = clean(row?.portfolio_reference ?? row?.website_url)
    const alertTask = (async () => {
      const radar = await scoreTradeApplication({
        studio, email, websiteOrIg,
        regNumber: clean(row?.business_reg_number),
        hasDocument: Boolean(row?.credential_document_path),
        returning: Boolean(existing),
      })
      if (!radar.ok) console.error('trade radar failed', radar.error)
      if (acct?.id) {
        await supabase.from('trade_accounts').update(radar.ok
          ? { radar_score: radar.score, radar_flag: radar.flag, radar_status: 'scored', radar_scored_at: new Date().toISOString() }
          : { radar_status: 'failed', radar_flag: radar.error.slice(0, 300), radar_scored_at: new Date().toISOString() }
        ).eq('id', acct.id)
      }
      const radarLines = radar.ok
        ? ['', '📊 *AI Critical Radar:*', `• *Confidence:* ${radar.score}/100`, `• *Flag:* ${radar.flag}`]
        : ['', '📊 *AI Critical Radar:* unavailable']
      const waBody = [
        '🚨 *New Trade Account Request on Maison Affluency*',
        '',
        `• *Studio:* ${studio}`,
        `• *Email:* ${email}`,
        `• *Website / IG:* ${clean(row?.portfolio_reference ?? row?.website_url) || '—'}`,
        `• *Reg. No:* ${clean(row?.business_reg_number) || '—'}`,
        `• *Document:* ${row?.credential_document_path ? 'uploaded' : 'none'}`,
        ...(existing ? ['• *Returning applicant*'] : []),
          ...radarLines,
        '',
        'Review in the Admin Dashboard.',
      ].join('\n')

      try {
        const result = await sendTradeRequestWhatsApp({ body: waBody, studio, applicant: '', email, phone: '' })
        await supabase.from('admin_alert_log').insert({
          channel: 'twilio_whatsapp',
          event: 'trade_application_request',
          status: result.ok ? 'sent' : 'failed',
          provider_message_id: result.ok ? result.sid : null,
          payload: { signup_id: signupId, email, source: 'trade-program-hero', twilio_status: result.status ?? null, used_template: result.usedTemplate, template_status: result.templateStatus },
          error: result.ok ? null : String(result.error ?? 'unknown').slice(0, 2000),
        })
        if (!result.ok) console.error('Trade signup WhatsApp failed', result.error)
      } catch (e) {
        console.error('Trade signup WhatsApp error', e)
        await supabase.from('admin_alert_log').insert({
          channel: 'twilio_whatsapp', event: 'trade_application_request', status: 'failed',
          payload: { signup_id: signupId, email }, error: String(e instanceof Error ? e.message : e).slice(0, 2000),
        })
      }
    })()
    // deno-lint-ignore no-explicit-any
    const rt2 = (globalThis as any).EdgeRuntime
    if (rt2?.waitUntil) rt2.waitUntil(alertTask); else await alertTask

    for (const adminEmail of ADMIN_EMAILS) {
      const { error: notifyErr } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'inquiry-notification',
          recipientEmail: adminEmail,
          idempotencyKey: `trade-signup-notify-${signupId}-${submissionStamp}-${adminEmail}`,
          templateData: {
            name: studio,
            company: studio,
            email,
            phone: '',
            subject: 'New Trade Account Request',
            message: `Trade Program application completed.\nStudio: ${studio}\nWebsite / IG: ${clean(row?.portfolio_reference ?? row?.website_url) || '—'}\nRegistration No: ${clean(row?.business_reg_number) || '—'}\nCredential document: ${row?.credential_document_path ? 'uploaded' : 'none'}`,
          },
        },
      })
      if (notifyErr) console.error(`Admin notification failed for ${adminEmail}`, notifyErr)
    }
  }

  return json({ ok: true, id: signupId, emailSent })
})
