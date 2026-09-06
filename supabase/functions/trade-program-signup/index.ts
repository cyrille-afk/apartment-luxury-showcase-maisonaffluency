import { createClient } from 'npm:@supabase/supabase-js@2'

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

  // Fire the invitation email once, on the first submission.
  let emailSent = Boolean(existing?.invite_email_sent_at)
  if (!emailSent) {
    const { error: mailError } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName: 'trade-program-invitation',
        recipientEmail: email,
        idempotencyKey: `trade-program-invitation-${signupId}`,
        templateData: { email, companyName },
      },
    })
    if (mailError) {
      console.error('invitation email failed', mailError)
    } else {
      emailSent = true
      await supabase
        .from('trade_program_signups')
        .update({ invite_email_sent_at: new Date().toISOString() })
        .eq('id', signupId!)
    }
  }

  return json({ ok: true, id: signupId, emailSent })
})
