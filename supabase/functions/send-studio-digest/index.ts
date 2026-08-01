// Studio Sourcing Digest — bundles the previous day's mobile saves into one
// 8:30am email per designer. Cron-only.
import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const esc = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  // Cron-only. Accepts either the shared CRON_SECRET header or a service-role
  // bearer (the scheduler reads the service-role key from the vault).
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const cronSecretEnv = Deno.env.get('CRON_SECRET')
  const cronSecret = req.headers.get('x-cron-secret')
  const bearer = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
  const authorised =
    (!!cronSecretEnv && cronSecret === cronSecretEnv) || (!!serviceKey && bearer === serviceKey)
  if (!authorised) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  try {
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.maisonaffluency.com'

    // Every mobile save not yet included in a digest.
    const { data: items, error } = await supabase
      .from('client_board_items')
      .select('id, board_id, product_id, variant_label, fabric_label, wood_label, created_at')
      .eq('saved_via', 'mobile')
      .is('digest_sent_at', null)
      .order('created_at', { ascending: true })
      .limit(500)

    if (error) throw error
    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no mobile saves pending' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const boardIds = [...new Set(items.map((i) => i.board_id))]
    const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))]

    const [{ data: boards }, { data: products }] = await Promise.all([
      supabase.from('client_boards').select('id, title, user_id').in('id', boardIds),
      supabase
        .from('trade_products')
        .select('id, product_name, brand_name, image_url, spec_sheet_url, lead_time')
        .in('id', productIds),
    ])

    const boardMap = new Map((boards || []).map((b) => [b.id, b]))
    const prodMap = new Map((products || []).map((p) => [p.id, p]))

    // Group by owner
    const byUser = new Map<string, typeof items>()
    for (const item of items) {
      const board = boardMap.get(item.board_id)
      if (!board?.user_id) continue
      const list = byUser.get(board.user_id) || []
      list.push(item)
      byUser.set(board.user_id, list)
    }

    if (byUser.size === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no resolvable owners' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email, first_name')
      .in('id', [...byUser.keys()])
    const profileMap = new Map((profiles || []).map((p) => [p.id, p]))

    const { data: suppressed } = await supabase.from('suppressed_emails').select('email')
    const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()))

    const today = new Date().toISOString().slice(0, 10)
    let enqueued = 0
    const sentItemIds: string[] = []

    for (const [userId, userItems] of byUser) {
      const profile = profileMap.get(userId)
      // Always retire the rows so a missing address can't re-queue forever.
      sentItemIds.push(...userItems.map((i) => i.id))
      if (!profile?.email || suppressedSet.has(profile.email.toLowerCase())) continue

      const rows = userItems
        .map((item) => {
          const p = prodMap.get(item.product_id) as
            | { product_name: string; brand_name: string | null; image_url: string | null; spec_sheet_url: string | null; lead_time: string | null }
            | undefined
          const board = boardMap.get(item.board_id)
          const finishes = [item.variant_label, item.fabric_label, item.wood_label].filter(Boolean).join(' · ')
          const specLink = p?.spec_sheet_url
            ? `<a href="${esc(p.spec_sheet_url)}" style="color:#0f3b32;text-decoration:underline;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;">Spec sheet</a>`
            : ''
          return `
            <tr>
              <td width="88" valign="top" style="padding:0 16px 24px 0;">
                ${p?.image_url ? `<img src="${esc(p.image_url)}" width="88" height="88" alt="" style="display:block;object-fit:cover;background:#f2f0eb;" />` : ''}
              </td>
              <td valign="top" style="padding:0 0 24px 0;font-family:Georgia,serif;color:#1c1c1c;">
                <div style="font-size:10px;letter-spacing:0.18em;text-transform:uppercase;color:#8a8578;">${esc(p?.brand_name || '')}</div>
                <div style="font-size:17px;margin:2px 0 4px;">${esc(p?.product_name || 'Saved piece')}</div>
                <div style="font-size:12px;color:#6f6a5e;">${esc(board?.title || 'Project folder')}${finishes ? ' — ' + esc(finishes) : ''}</div>
                ${p?.lead_time ? `<div style="font-size:12px;color:#6f6a5e;">Lead time ${esc(p.lead_time)}</div>` : ''}
                <div style="margin-top:8px;">${specLink}</div>
              </td>
            </tr>`
        })
        .join('')

      const html = `<!doctype html><html><body style="margin:0;background:#f7f6f3;padding:32px 0;">
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          <tr><td align="center">
            <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;">
              <tr><td style="background:#0f3b32;padding:28px 32px;font-family:Georgia,serif;color:#f7f6f3;">
                <div style="font-size:11px;letter-spacing:0.24em;text-transform:uppercase;opacity:0.75;">Maison Affluency</div>
                <div style="font-size:22px;margin-top:6px;">Studio Sourcing Digest</div>
              </td></tr>
              <tr><td style="padding:28px 32px 8px;font-family:Georgia,serif;color:#1c1c1c;font-size:14px;line-height:1.7;">
                ${profile.first_name ? esc(profile.first_name) + ',' : 'Good morning,'}
                <br/>You flagged ${userItems.length} piece${userItems.length > 1 ? 's' : ''} from your phone. Technical documentation is ready on your desktop workspace.
              </td></tr>
              <tr><td style="padding:20px 32px 0;">
                <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${rows}</table>
              </td></tr>
              <tr><td style="padding:8px 32px 36px;">
                <a href="${siteUrl}/trade/boards" style="display:inline-block;background:#0f3b32;color:#f7f6f3;font-family:Georgia,serif;font-size:12px;letter-spacing:0.16em;text-transform:uppercase;padding:14px 26px;text-decoration:none;">Open your studio dashboard</a>
              </td></tr>
              <tr><td style="padding:0 32px 32px;font-family:Georgia,serif;font-size:11px;color:#8a8578;">
                Sent once each morning — never on every save.
              </td></tr>
            </table>
          </td></tr>
        </table>
      </body></html>`

      // The send API rejects payloads without a plain-text alternative.
      const text = [
        'Studio Sourcing Digest — Maison Affluency',
        '',
        `You flagged ${userItems.length} piece${userItems.length > 1 ? 's' : ''} from your phone.`,
        '',
        ...userItems.map((item) => {
          const p = prodMap.get(item.product_id) as { product_name?: string; brand_name?: string | null } | undefined
          const board = boardMap.get(item.board_id)
          const finishes = [item.variant_label, item.fabric_label, item.wood_label].filter(Boolean).join(' / ')
          return `- ${[p?.brand_name, p?.product_name || 'Saved piece'].filter(Boolean).join(' — ')}` +
            ` (${board?.title || 'Project folder'}${finishes ? ', ' + finishes : ''})`
        }),
        '',
        `Open your studio dashboard: ${siteUrl}/trade/boards`,
      ].join('\n')

      // One unsubscribe token per address — required by the send API.
      const normalizedEmail = profile.email.toLowerCase()
      let unsubscribeToken: string | null = null
      const { data: existingToken } = await supabase
        .from('email_unsubscribe_tokens')
        .select('token, used_at')
        .eq('email', normalizedEmail)
        .maybeSingle()
      if (existingToken && !existingToken.used_at) {
        unsubscribeToken = existingToken.token as string
      } else if (!existingToken) {
        const fresh = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '')
        await supabase
          .from('email_unsubscribe_tokens')
          .upsert({ token: fresh, email: normalizedEmail }, { onConflict: 'email', ignoreDuplicates: true })
        const { data: stored } = await supabase
          .from('email_unsubscribe_tokens')
          .select('token')
          .eq('email', normalizedEmail)
          .maybeSingle()
        unsubscribeToken = (stored?.token as string) || fresh
      }
      if (!unsubscribeToken) continue

      const messageId = `studio-digest-${today}-${userId}`

      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to: profile.email,
          from: 'Maison Affluency <notify@notify.www.maisonaffluency.com>',
          sender_domain: 'notify.www.maisonaffluency.com',
          subject: `Studio Sourcing Digest — ${userItems.length} piece${userItems.length > 1 ? 's' : ''} saved`,
          html,
          text,
          unsubscribe_token: unsubscribeToken,
          purpose: 'transactional',
          label: 'studio-digest',
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
        },
      })

      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'studio-digest',
        recipient_email: profile.email,
        status: 'pending',
      })

      enqueued++
    }

    if (sentItemIds.length > 0) {
      await supabase
        .from('client_board_items')
        .update({ digest_sent_at: new Date().toISOString() })
        .in('id', sentItemIds)
    }

    return new Response(JSON.stringify({ success: true, enqueued, items: sentItemIds.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('studio digest error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
