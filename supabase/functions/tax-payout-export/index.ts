// Year-end tax export: aggregates commission payouts per studio for a given tax year
// and returns CSV suitable for 1099-NEC (US) and T4A (CA) filings.
//
// Source of truth: order_timeline.commission_statement_sent_at (year the payout was issued)
// + commission_payout_cents/commission_payout_currency.
// Studio tax info: default studio_payout_accounts row (country_code, tax_form_kind, tax_form_reference).
//
// Admin-only. Returns text/csv.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return ''
  const s = String(v)
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}
function csvRow(cells: unknown[]): string { return cells.map(csvCell).join(',') }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // --- Admin gate ---
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing auth' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: claims } = await admin.auth.getClaims(token)
  const uid = claims?.claims?.sub
  if (!uid) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const { data: isAdmin } = await admin.rpc('has_role', { _user_id: uid, _role: 'admin' })
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'Forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Params ---
  const url = new URL(req.url)
  const yearStr = url.searchParams.get('year') ?? String(new Date().getUTCFullYear() - 1)
  const year = Number(yearStr)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return new Response(JSON.stringify({ error: 'Invalid year' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const form = (url.searchParams.get('form') ?? 'all').toLowerCase() // 1099 | t4a | all

  const yearStart = `${year}-01-01T00:00:00Z`
  const yearEnd = `${year + 1}-01-01T00:00:00Z`

  // --- Fetch issued payouts in tax year ---
  const { data: rows, error } = await admin
    .from('order_timeline')
    .select('studio_id, quote_id, commission_payout_cents, commission_payout_currency, commission_statement_sent_at, actual_delivery_at')
    .gte('commission_statement_sent_at', yearStart)
    .lt('commission_statement_sent_at', yearEnd)
    .not('commission_payout_cents', 'is', null)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Aggregate by studio+currency ---
  type Agg = {
    studio_id: string
    currency: string
    total_cents: number
    order_count: number
    first_payout: string
    last_payout: string
  }
  const aggMap = new Map<string, Agg>()
  for (const r of rows ?? []) {
    if (!r.studio_id || !r.commission_payout_cents) continue
    const cur = (r.commission_payout_currency ?? 'USD').toUpperCase()
    const key = `${r.studio_id}|${cur}`
    const existing = aggMap.get(key)
    const ts = r.commission_statement_sent_at as string
    if (existing) {
      existing.total_cents += Number(r.commission_payout_cents)
      existing.order_count += 1
      if (ts < existing.first_payout) existing.first_payout = ts
      if (ts > existing.last_payout) existing.last_payout = ts
    } else {
      aggMap.set(key, {
        studio_id: r.studio_id,
        currency: cur,
        total_cents: Number(r.commission_payout_cents),
        order_count: 1,
        first_payout: ts,
        last_payout: ts,
      })
    }
  }

  const studioIds = [...new Set([...aggMap.values()].map(a => a.studio_id))]

  // --- Fetch studios + default payout account + owner contact ---
  const [{ data: studios }, { data: payouts }] = await Promise.all([
    admin.from('studios').select('id, name, owner_user_id').in('id', studioIds.length ? studioIds : ['00000000-0000-0000-0000-000000000000']),
    admin.from('studio_payout_accounts')
      .select('studio_id, country_code, currency, account_holder_name, tax_form_kind, tax_form_reference, bank_address, is_default')
      .in('studio_id', studioIds.length ? studioIds : ['00000000-0000-0000-0000-000000000000']),
  ])

  const ownerIds = [...new Set((studios ?? []).map((s: any) => s.owner_user_id).filter(Boolean))]
  const { data: profiles } = ownerIds.length
    ? await admin.from('profiles').select('id, first_name, last_name, email').in('id', ownerIds)
    : { data: [] as any[] }

  const studioMap = new Map<string, any>((studios ?? []).map((s: any) => [s.id, s]))
  const profileMap = new Map<string, any>((profiles ?? []).map((p: any) => [p.id, p]))
  // Prefer default account; fallback to first account for that studio
  const payoutByStudio = new Map<string, any>()
  for (const p of payouts ?? []) {
    const cur = payoutByStudio.get(p.studio_id)
    if (!cur || p.is_default) payoutByStudio.set(p.studio_id, p)
  }

  // --- Build CSV ---
  const header = [
    'studio_id', 'studio_name',
    'owner_name', 'owner_email',
    'country', 'tax_form_kind', 'tax_form_reference',
    'account_holder_name', 'bank_address',
    'currency', 'total_payout', 'order_count',
    'first_payout_date', 'last_payout_date',
    'form_required', 'threshold_note',
  ]

  const lines: string[] = [csvRow(header)]

  for (const a of [...aggMap.values()].sort((x, y) => y.total_cents - x.total_cents)) {
    const studio = studioMap.get(a.studio_id) ?? {}
    const acct = payoutByStudio.get(a.studio_id) ?? {}
    const owner = profileMap.get(studio.owner_user_id) ?? {}
    const country = (acct.country_code ?? '').toUpperCase()
    const totalUnits = a.total_cents / 100

    // Form filter
    let formRequired = ''
    let thresholdNote = ''
    if (country === 'US' && a.currency === 'USD') {
      formRequired = '1099-NEC'
      thresholdNote = totalUnits >= 600 ? 'Threshold met (≥ $600)' : 'Below $600 threshold'
    } else if (country === 'CA' && a.currency === 'CAD') {
      formRequired = 'T4A'
      thresholdNote = totalUnits >= 500 ? 'Threshold met (≥ $500)' : 'Below $500 threshold'
    } else {
      formRequired = 'N/A'
      thresholdNote = 'Non-US/CA — no federal info return required'
    }

    if (form === '1099' && formRequired !== '1099-NEC') continue
    if (form === 't4a' && formRequired !== 'T4A') continue

    lines.push(csvRow([
      a.studio_id,
      studio.name ?? '',
      [owner.first_name, owner.last_name].filter(Boolean).join(' '),
      owner.email ?? '',
      country,
      acct.tax_form_kind ?? '',
      acct.tax_form_reference ?? '',
      acct.account_holder_name ?? '',
      acct.bank_address ?? '',
      a.currency,
      totalUnits.toFixed(2),
      a.order_count,
      a.first_payout.slice(0, 10),
      a.last_payout.slice(0, 10),
      formRequired,
      thresholdNote,
    ]))
  }

  const csv = lines.join('\n') + '\n'
  const filename = `tax-payout-export-${year}${form !== 'all' ? '-' + form : ''}.csv`

  return new Response(csv, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
})
