// Mirrors the shopper's basket server-side so abandoned bags can be measured
// and recovered. Public endpoint: anonymous shoppers must be able to write.
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

const str = (v: unknown, max = 200): string | null => {
  if (typeof v !== 'string') return null
  const t = v.trim()
  return t ? t.slice(0, max) : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  const sessionId = str(body.sessionId, 80)
  if (!sessionId) return json({ error: 'sessionId is required' }, 400)

  const status = ['active', 'ordered', 'dismissed'].includes(String(body.status))
    ? String(body.status)
    : 'active'

  const rawItems = Array.isArray(body.items) ? body.items.slice(0, 50) : []
  const items = rawItems.map((i: Record<string, unknown>) => ({
    title: str(i?.title, 160),
    designerName: str(i?.designerName, 120),
    finishLabel: str(i?.finishLabel, 120),
    productPath: str(i?.productPath, 300),
    imageUrl: str(i?.imageUrl, 500),
    quantity: Math.max(1, Math.min(999, Number(i?.quantity) || 1)),
    unitPriceCents: Math.max(0, Math.min(1_000_000_000, Number(i?.unitPriceCents) || 0)),
  }))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Empty basket + no order => nothing worth keeping.
  if (items.length === 0 && status !== 'ordered') {
    await supabase.from('abandoned_carts').delete().eq('session_id', sessionId)
    return json({ ok: true, cleared: true })
  }

  const subtotal = items.reduce((s, i) => s + i.unitPriceCents * i.quantity, 0)

  const payload: Record<string, unknown> = {
    session_id: sessionId,
    user_id: str(body.userId, 64),
    email: str(body.email, 200)?.toLowerCase() ?? null,
    name: str(body.name, 160),
    currency: str(body.currency, 8)?.toUpperCase() ?? null,
    item_count: items.reduce((s, i) => s + i.quantity, 0),
    subtotal_cents: subtotal,
    items,
    status,
    last_activity_at: new Date().toISOString(),
  }
  if (status === 'ordered') payload.recovered_at = new Date().toISOString()

  // Never wipe a captured email with a null on a later anonymous ping.
  if (!payload.email) delete payload.email
  if (!payload.name) delete payload.name
  if (!payload.user_id) delete payload.user_id

  const { error } = await supabase
    .from('abandoned_carts')
    .upsert(payload, { onConflict: 'session_id' })

  if (error) {
    console.error('track-cart upsert failed', error.message)
    return json({ error: 'write_failed' }, 500)
  }

  return json({ ok: true })
})
