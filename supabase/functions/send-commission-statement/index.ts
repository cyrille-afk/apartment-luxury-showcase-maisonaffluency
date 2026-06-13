// Sends a commission statement email to the designer when an agent-mode order
// transitions to "delivered". Strictly idempotent via order_timeline.commission_statement_sent_at.
//
// Caller: trade admin (kanban move). Auth: caller JWT verified by gateway; we
// double-check the caller is an admin server-side. All data fetches use the
// service role so we can read auth.users.email for the designer.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function fmt(amountCents: number) {
  return (amountCents / 100).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function addBusinessDays(start: Date, n: number) {
  const d = new Date(start)
  let added = 0
  while (added < n) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    if (dow !== 0 && dow !== 6) added++
  }
  return d
}

function maskAccount(s: string | null | undefined) {
  if (!s) return null
  const clean = String(s).replace(/\s+/g, '')
  if (clean.length <= 4) return `••${clean}`
  return `••${clean.slice(-4)}`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // Verify caller is admin
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: claimsData, error: claimsErr } = await admin.auth.getClaims(token)
  if (claimsErr || !claimsData?.claims?.sub) {
    return new Response(JSON.stringify({ error: 'Invalid auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const callerId = claimsData.claims.sub as string
  const { data: isAdminRow } = await admin.rpc('has_role', { _user_id: callerId, _role: 'admin' })
  if (!isAdminRow) {
    return new Response(JSON.stringify({ error: 'Admin only' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let quoteId: string
  try {
    const body = await req.json()
    quoteId = body.quote_id || body.quoteId
    if (!quoteId) throw new Error('quote_id required')
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 1. Load timeline (idempotency check)
  const { data: timeline, error: tErr } = await admin
    .from('order_timeline')
    .select('id, quote_id, kanban_status, actual_delivery_at, commission_statement_sent_at, commission_fx_rate, commission_payout_currency, commission_payout_cents, commission_fx_source, commission_fx_locked_at')
    .eq('quote_id', quoteId)
    .maybeSingle()
  if (tErr || !timeline) {
    return new Response(JSON.stringify({ error: 'Order timeline not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (timeline.commission_statement_sent_at) {
    return new Response(JSON.stringify({ skipped: 'already_sent' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (timeline.kanban_status !== 'delivered') {
    return new Response(JSON.stringify({ skipped: 'not_delivered' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 2. Load quote
  const { data: quote, error: qErr } = await admin
    .from('trade_quotes')
    .select('id, user_id, status, currency, client_name, billing_mode, commission_pct, designer_payout_account_id, created_at')
    .eq('id', quoteId)
    .maybeSingle()
  if (qErr || !quote) {
    return new Response(JSON.stringify({ error: 'Quote not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  if (quote.billing_mode !== 'agent_commission') {
    // Mark sent so we don't retry; net_buy gets no commission statement.
    await admin.from('order_timeline')
      .update({ commission_statement_sent_at: new Date().toISOString() })
      .eq('id', timeline.id)
    return new Response(JSON.stringify({ skipped: 'net_buy_no_commission' }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 3. Line items
  const { data: items } = await admin
    .from('trade_quote_items')
    .select('id, quantity, unit_price_cents, product:trade_products(name, brand)')
    .eq('quote_id', quoteId)

  const lines = (items ?? []).map((it: any) => {
    const qty = it.quantity ?? 1
    const lineCents = (it.unit_price_cents ?? 0) * qty
    const brand = it.product?.brand ? `${it.product.brand} — ` : ''
    return {
      name: `${brand}${it.product?.name ?? 'Item'}`,
      quantity: qty,
      msrpFormatted: fmt(lineCents),
      _cents: lineCents,
    }
  })
  const subtotalCents = lines.reduce((s, l) => s + l._cents, 0)
  const commissionPct = Number(quote.commission_pct ?? 0)
  const commissionCents = Math.round((subtotalCents * commissionPct) / 100)

  // 4. Payout account (optional)
  let payoutMethod: string | null = null
  if (quote.designer_payout_account_id) {
    const { data: acct } = await admin
      .from('studio_payout_accounts')
      .select('bank_name, currency, iban, ach_account_number')
      .eq('id', quote.designer_payout_account_id)
      .maybeSingle()
    if (acct) {
      const masked = maskAccount(acct.iban ?? acct.ach_account_number)
      payoutMethod = [acct.bank_name, acct.currency, masked].filter(Boolean).join(' · ')
    }
  }

  // 5. Designer email + name
  const { data: userRes, error: uErr } = await admin.auth.admin.getUserById(quote.user_id)
  if (uErr || !userRes?.user?.email) {
    return new Response(JSON.stringify({ error: 'Designer email not found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const designerEmail = userRes.user.email
  const metaName = (userRes.user.user_metadata?.full_name
    ?? userRes.user.user_metadata?.name
    ?? null) as string | null

  const deliveredOn = fmtDate(timeline.actual_delivery_at ?? new Date().toISOString())
  const expectedWireOn = fmtDate(addBusinessDays(new Date(), 3).toISOString())
  const quoteNumber = `QU-${quote.id.slice(0, 8).toUpperCase()}`

  // 6. Invoke send-transactional-email
  const sendResp = await admin.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'commission-statement',
      recipientEmail: designerEmail,
      idempotencyKey: `commission-statement-${quote.id}`,
      templateData: {
        designerName: metaName,
        quoteNumber,
        endClientName: quote.client_name || null,
        deliveredOn,
        currency: quote.currency || 'USD',
        subtotalFormatted: fmt(subtotalCents),
        commissionPct,
        commissionFormatted: fmt(commissionCents),
        payoutMethod,
        expectedWireOn,
        items: lines.map(({ name, quantity, msrpFormatted }) => ({ name, quantity, msrpFormatted })),
      },
    },
  })
  if (sendResp.error) {
    console.error('send-transactional-email failed', sendResp.error)
    return new Response(JSON.stringify({ error: 'Send failed', detail: sendResp.error.message }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // 7. Mark as sent
  await admin.from('order_timeline')
    .update({ commission_statement_sent_at: new Date().toISOString() })
    .eq('id', timeline.id)

  return new Response(JSON.stringify({
    sent: true,
    recipient: designerEmail,
    commission_cents: commissionCents,
  }), {
    status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
