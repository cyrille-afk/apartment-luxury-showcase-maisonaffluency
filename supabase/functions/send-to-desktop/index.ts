// "Send to Desktop" — mobile-to-desktop continuity.
//
// A designer on site taps this on the PWA; the piece (with the finishes they
// were reviewing) is queued as a studio alert and pushed to their desktop
// session so the work is waiting when they sit down.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    )

    const { data: claimsData, error: claimsError } = await admin.auth.getClaims(token)
    const userId = claimsData?.claims?.sub as string | undefined
    if (claimsError || !userId) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json().catch(() => ({}))
    const title = String(body.title || 'Saved piece').slice(0, 160)
    const designer = String(body.designer || '').slice(0, 160)
    const finishes: string[] = Array.isArray(body.finishes)
      ? body.finishes.filter((f: unknown) => typeof f === 'string').slice(0, 6)
      : []
    const productId = typeof body.product_id === 'string' && UUID_RE.test(body.product_id)
      ? body.product_id
      : null

    const siteUrl = Deno.env.get('SITE_URL') || 'https://www.maisonaffluency.com'
    const url = productId ? `${siteUrl}/trade/products/${productId}` : `${siteUrl}/trade/boards`

    const alertBody = [designer, finishes.length ? finishes.join(' · ') : null]
      .filter(Boolean)
      .join(' — ') || 'Ready on your studio desktop.'

    const { data: alert, error: insertError } = await admin
      .from('studio_alerts')
      .insert({
        user_id: userId,
        kind: 'desktop_handoff',
        title: `${title} — sent from your phone`,
        body: alertBody,
        product_id: productId,
        url,
      })
      .select('id')
      .single()

    if (insertError) throw insertError

    // Best-effort immediate push; the cron dispatcher is the safety net.
    let pushed = 0
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY')
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY')
    const vapidSubject = Deno.env.get('VAPID_SUBJECT')
    if (vapidPublic && vapidPrivate && vapidSubject) {
      try {
        webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)
        const { data: subs } = await admin
          .from('push_subscriptions')
          .select('id, endpoint, p256dh, auth')
          .eq('user_id', userId)

        const payload = JSON.stringify({
          title: `${title} is on your desktop`,
          body: alertBody,
          url,
        })

        for (const s of subs || []) {
          try {
            await webpush.sendNotification(
              { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
              payload,
            )
            pushed++
          } catch (err) {
            const status = (err as { statusCode?: number }).statusCode
            if (status === 404 || status === 410) {
              await admin.from('push_subscriptions').delete().eq('id', s.id)
            }
          }
        }

        if (pushed > 0) {
          await admin
            .from('studio_alerts')
            .update({ pushed_at: new Date().toISOString() })
            .eq('id', alert.id)
        }
      } catch (err) {
        console.error('send-to-desktop push failed', err)
      }
    }

    return new Response(JSON.stringify({ success: true, alert_id: alert.id, pushed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    console.error('send-to-desktop error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
