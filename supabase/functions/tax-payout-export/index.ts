// Designer-facing year-end payout statement.
// Returns a CSV of commission payouts issued to the caller's studio(s) within a tax year.
// Source: order_timeline.commission_statement_sent_at + commission_payout_cents/_currency.
// Scope:
//   - Default: caller's own studios (via studio_members).
//   - Admins may pass ?studio_id=<uuid> to pull any single studio.
// Not a tax form. Studios use this as a reference statement for their own accountant.
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
const csvRow = (cells: unknown[]) => cells.map(csvCell).join(',')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

  // --- Auth ---
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

  // --- Params ---
  const url = new URL(req.url)
  const yearStr = url.searchParams.get('year') ?? String(new Date().getUTCFullYear() - 1)
  const year = Number(yearStr)
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    return new Response(JSON.stringify({ error: 'Invalid year' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
  const requestedStudioId = url.searchParams.get('studio_id')

  // --- Scope studios ---
  let studioIds: string[] = []
  if (requestedStudioId) {
    if (!isAdmin) {
      const { data: membership } = await admin
        .from('studio_members').select('studio_id').eq('user_id', uid).eq('studio_id', requestedStudioId).maybeSingle()
      if (!membership) {
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
    studioIds = [requestedStudioId]
  } else {
    const { data: memberships } = await admin
      .from('studio_members').select('studio_id').eq('user_id', uid)
    studioIds = [...new Set((memberships ?? []).map((m: any) => m.studio_id).filter(Boolean))]
    if (!studioIds.length) {
      return new Response(JSON.stringify({ error: 'No studio on file' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }
  }

  const yearStart = `${year}-01-01T00:00:00Z`
  const yearEnd = `${year + 1}-01-01T00:00:00Z`

  // --- Fetch payouts ---
  const { data: rows, error } = await admin
    .from('order_timeline')
    .select('studio_id, quote_id, commission_payout_cents, commission_payout_currency, commission_statement_sent_at, actual_delivery_at')
    .in('studio_id', studioIds)
    .gte('commission_statement_sent_at', yearStart)
    .lt('commission_statement_sent_at', yearEnd)
    .not('commission_payout_cents', 'is', null)
    .order('commission_statement_sent_at', { ascending: true })

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // --- Quote refs for itemised lines ---
  const quoteIds = [...new Set((rows ?? []).map(r => r.quote_id).filter(Boolean))]
  const { data: quotes } = quoteIds.length
    ? await admin.from('trade_quotes').select('id, project_name, client_name').in('id', quoteIds)
    : { data: [] as any[] }
  const quoteMap = new Map<string, any>((quotes ?? []).map((q: any) => [q.id, q]))

  const { data: studios } = await admin.from('studios').select('id, name').in('id', studioIds)
  const studioMap = new Map<string, any>((studios ?? []).map((s: any) => [s.id, s]))

  // --- Build CSV: itemised lines + totals per currency ---
  const header = [
    'studio_name', 'payout_issued_on', 'delivered_on',
    'quote_number', 'project', 'client',
    'currency', 'commission_payout',
  ]
  const lines: string[] = [csvRow(header)]

  const totals = new Map<string, { studio: string; currency: string; total_cents: number; count: number }>()

  for (const r of rows ?? []) {
    const studio = studioMap.get(r.studio_id) ?? {}
    const q = quoteMap.get(r.quote_id) ?? {}
    const cur = (r.commission_payout_currency ?? 'USD').toUpperCase()
    const cents = Number(r.commission_payout_cents ?? 0)

    lines.push(csvRow([
      studio.name ?? '',
      (r.commission_statement_sent_at as string ?? '').slice(0, 10),
      (r.actual_delivery_at as string ?? '').slice(0, 10),
      q.quote_number ?? '',
      q.project_name ?? r.project_name ?? '',
      q.client_name ?? r.client_name ?? '',
      cur,
      (cents / 100).toFixed(2),
    ]))

    const k = `${r.studio_id}|${cur}`
    const t = totals.get(k)
    if (t) { t.total_cents += cents; t.count += 1 }
    else totals.set(k, { studio: studio.name ?? '', currency: cur, total_cents: cents, count: 1 })
  }

  // Blank separator + totals block
  lines.push('')
  lines.push(csvRow(['SUMMARY', `Tax year ${year}`, '', '', '', '', '', '']))
  lines.push(csvRow(['studio_name', '', '', '', 'orders', '', 'currency', 'total_payout']))
  for (const t of totals.values()) {
    lines.push(csvRow([t.studio, '', '', '', t.count, '', t.currency, (t.total_cents / 100).toFixed(2)]))
  }
  lines.push('')
  lines.push(csvRow(['Note: This is a reference payout statement, not a tax form. Provide it to your accountant alongside your own jurisdiction\'s filings.']))

  const csv = lines.join('\n') + '\n'
  const filename = `payout-statement-${year}.csv`

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
