// Daily sweep of the sales funnel: chases shoppers and clients who stalled, and
// alerts the trade desk about internal items that have not progressed.
// Invoked by pg_cron with the shared CRON_SECRET header.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const SITE = 'https://www.maisonaffluency.com'
const ADMIN_EMAILS = ['cyrille@maisonaffluency.com', 'gregoire@maisonaffluency.com']

const HOURS = (h: number) => new Date(Date.now() - h * 3600_000).toISOString()
const daysAgo = (iso: string | null) => {
  if (!iso) return '—'
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000)
  return d <= 0 ? 'today' : `${d} day${d === 1 ? '' : 's'}`
}
const money = (cents: number) =>
  (cents / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  const secret = req.headers.get('x-cron-secret')
  if (!secret || secret !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const dryRun = new URL(req.url).searchParams.get('dry') === '1'

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const sent: string[] = []
  const internalRows: { stage: string; label: string; age: string }[] = []

  // Weekend protection: client reminders never fire on Saturday or Sunday.
  // The daily 09:00 job simply defers them to Monday morning.
  const weekday = new Date().getUTCDay()
  const isWeekend = weekday === 0 || weekday === 6
  const deferred: string[] = []

  // Manual "Pause reminders" overrides set from the Sales Funnel board.
  const { data: pauseRows } = await supabase
    .from('funnel_reminder_pauses')
    .select('entity_type, entity_id, paused')
    .eq('paused', true)
  const paused = new Set((pauseRows ?? []).map((p) => `${p.entity_type}:${p.entity_id}`))
  const isPaused = (type: string, id: string) => paused.has(`${type}:${id}`)

  const alreadySent = async (type: string, id: string, n: number) => {
    const { data } = await supabase
      .from('funnel_reminder_log')
      .select('id')
      .eq('entity_type', type)
      .eq('entity_id', id)
      .eq('reminder_number', n)
      .maybeSingle()
    return !!data
  }

  const send = async (
    type: string,
    id: string,
    n: number,
    stage: string,
    email: string,
    templateName: string,
    templateData: Record<string, unknown>,
  ) => {
    if (isPaused(type, id)) {
      deferred.push(`${stage} paused manually (${type}:${id})`)
      return false
    }
    if (isWeekend) {
      deferred.push(`${stage} held for Monday 09:00 (${type}:${id})`)
      return false
    }
    if (await alreadySent(type, id, n)) return false
    if (dryRun) {
      sent.push(`[dry] ${stage} → ${email}`)
      return true
    }
    const { error } = await supabase.functions.invoke('send-transactional-email', {
      body: {
        templateName,
        recipientEmail: email,
        idempotencyKey: `funnel-${type}-${id}-${n}`,
        templateData,
      },
    })
    if (error) {
      console.error('send failed', stage, error.message)
      return false
    }
    await supabase.from('funnel_reminder_log').insert({
      entity_type: type,
      entity_id: id,
      stage,
      reminder_number: n,
      recipient_email: email,
      audience: 'client',
      template_name: templateName,
    })
    sent.push(`${stage} → ${email}`)
    return true
  }

  // ---------- 1. Abandoned shopping bags ----------
  const { data: carts } = await supabase
    .from('abandoned_carts')
    .select('*')
    .eq('status', 'active')
    .not('email', 'is', null)
    .lt('last_activity_at', HOURS(24))
    .limit(200)

  for (const cart of carts ?? []) {
    const n = (cart.reminder_count ?? 0) + 1
    if (n > 2) continue
    // Second nudge only after a further 72h of silence.
    if (n === 2 && cart.last_reminder_at && cart.last_reminder_at > HOURS(72)) continue
    const ok = await send('cart', cart.id, n, 'Abandoned basket', cart.email as string, 'cart-reminder', {
      recipientName: cart.name,
      lines: Array.isArray(cart.items) ? cart.items : [],
      cartUrl: `${SITE}/cart`,
      secondReminder: n === 2,
    })
    if (ok && !dryRun) {
      await supabase
        .from('abandoned_carts')
        .update({ reminder_count: n, last_reminder_at: new Date().toISOString() })
        .eq('id', cart.id)
    }
  }

  // ---------- 2. Quotes sent but never paid ----------
  // Spaced grace period: first chase 5 days after the quote went out,
  // the final one a further 7 days later.
  const { data: sentQuotes } = await supabase
    .from('trade_quotes')
    .select('id, client_name, currency, submitted_at, ship_to_email, ship_to_name')
    .eq('status', 'submitted')
    .lt('submitted_at', HOURS(120))
    .limit(200)

  for (const q of sentQuotes ?? []) {
    const { data: links } = await supabase
      .from('quote_payment_links')
      .select('token, amount_cents, currency, label, status, payer_email, payer_name')
      .eq('quote_id', q.id)
      .order('created_at', { ascending: false })
    const paid = (links ?? []).some((l) => l.status === 'paid')
    if (paid) continue
    const link = (links ?? []).find((l) => l.status !== 'paid' && l.status !== 'revoked')
    const email = link?.payer_email || q.ship_to_email
    const ref = `QU-${String(q.id).slice(0, 6).toUpperCase()}`

    if (!email || !link) {
      internalRows.push({
        stage: 'Sent quote unpaid',
        label: `${q.client_name ?? 'Client'} — ${ref}${link ? '' : ' (no payment link)'}`,
        age: daysAgo(q.submitted_at),
      })
      continue
    }

    const ageDays = Math.floor((Date.now() - new Date(q.submitted_at as string).getTime()) / 86400_000)
    const n = ageDays >= 7 ? 2 : 1
    if (n === 2 && !(await alreadySent('quote_unpaid', q.id, 1))) {
      // Never skip straight to the final reminder.
      continue
    }
    await send('quote_unpaid', q.id, n, 'Sent quote unpaid', email, 'quote-payment-reminder', {
      recipientName: link.payer_name || q.ship_to_name || q.client_name,
      quoteRef: ref,
      currency: link.currency ?? q.currency ?? 'EUR',
      amountFormatted: money(link.amount_cents ?? 0),
      label: link.label ?? 'Amount due',
      payUrl: `${SITE}/pay/${link.token}`,
      secondReminder: n === 2,
    })
  }

  // ---------- 3. Draft quotes never sent ----------
  const { data: drafts } = await supabase
    .from('trade_quotes')
    .select('id, client_name, created_at')
    .eq('status', 'draft')
    .lt('created_at', HOURS(72))
    .limit(200)

  for (const d of drafts ?? []) {
    internalRows.push({
      stage: 'Quote never sent',
      label: `${d.client_name ?? 'Unnamed client'} — QU-${String(d.id).slice(0, 6).toUpperCase()}`,
      age: daysAgo(d.created_at),
    })
  }

  // ---------- 4. Requests never turned into a quote ----------
  const { data: inquiries } = await supabase
    .from('inquiries')
    .select('id, product_name, company, email, created_at, status, linked_quote_id')
    .in('status', ['new', 'in_review'])
    .is('linked_quote_id', null)
    .lt('created_at', HOURS(48))
    .limit(200)

  for (const i of inquiries ?? []) {
    internalRows.push({
      stage: 'Request not quoted',
      label: `${i.company || i.email || 'Private client'} — ${i.product_name ?? 'Quote request'}`,
      age: daysAgo(i.created_at),
    })
  }

  // ---------- Internal digest ----------
  if (internalRows.length > 0) {
    const stamp = new Date().toISOString().slice(0, 10)
    for (const [idx, admin] of ADMIN_EMAILS.entries()) {
      const key = `${stamp}-${idx}`
      if (await alreadySent('internal', key, 1)) continue
      if (dryRun) {
        sent.push(`[dry] internal digest → ${admin}`)
        continue
      }
      const { error } = await supabase.functions.invoke('send-transactional-email', {
        body: {
          templateName: 'funnel-stall-alert',
          recipientEmail: admin,
          idempotencyKey: `funnel-internal-${key}`,
          templateData: { rows: internalRows, funnelUrl: `${SITE}/trade/admin/sales-funnel` },
        },
      })
      if (error) {
        console.error('internal digest failed', error.message)
        continue
      }
      await supabase.from('funnel_reminder_log').insert({
        entity_type: 'internal',
        entity_id: key,
        stage: 'Internal digest',
        reminder_number: 1,
        recipient_email: admin,
        audience: 'internal',
        template_name: 'funnel-stall-alert',
      })
      sent.push(`internal digest → ${admin}`)
    }
  }

  return new Response(
    JSON.stringify({ ok: true, dryRun, sent, stalled: internalRows.length }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
  )
})
