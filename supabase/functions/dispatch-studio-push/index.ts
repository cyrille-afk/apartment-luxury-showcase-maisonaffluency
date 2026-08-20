// Dispatches Web Push for material / lead-time changes on saved pieces.
// Reads pending rows from studio_alerts and pushes to that user's devices.
import { createClient } from 'npm:@supabase/supabase-js@2'
import webpush from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

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

    webpush.setVapidDetails(
      Deno.env.get('VAPID_SUBJECT')!,
      Deno.env.get('VAPID_PUBLIC_KEY')!,
      Deno.env.get('VAPID_PRIVATE_KEY')!,
    )

    const { data: alerts, error } = await supabase
      .from('studio_alerts')
      .select('id, user_id, title, body, url')
      .is('pushed_at', null)
      .order('created_at', { ascending: true })
      .limit(200)

    if (error) throw error
    if (!alerts || alerts.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: 'no pending alerts' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const userIds = [...new Set(alerts.map((a) => a.user_id))]
    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('id, user_id, endpoint, p256dh, auth')
      .in('user_id', userIds)

    const byUser = new Map<string, NonNullable<typeof subs>>()
    for (const s of subs || []) {
      const list = byUser.get(s.user_id) || []
      list.push(s)
      byUser.set(s.user_id, list as NonNullable<typeof subs>)
    }

    const deadSubIds: string[] = []
    const pushedAlertIds: string[] = []
    let sent = 0

    for (const alert of alerts) {
      const targets = byUser.get(alert.user_id) || []
      // No device registered: still retire the alert, the in-app dot covers it.
      if (targets.length === 0) {
        pushedAlertIds.push(alert.id)
        continue
      }

      const payload = JSON.stringify({
        title: alert.title,
        body: alert.body,
        url: alert.url || '/trade/boards',
        tag: `studio-alert-${alert.id}`,
      })

      for (const sub of targets) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
            payload,
          )
          sent++
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode
          // 404/410 = the browser dropped the subscription; prune it.
          if (status === 404 || status === 410) deadSubIds.push(sub.id)
          else console.error('push failed', sub.id, err)
        }
      }
      pushedAlertIds.push(alert.id)
    }

    if (deadSubIds.length > 0) {
      await supabase.from('push_subscriptions').delete().in('id', deadSubIds)
    }
    if (pushedAlertIds.length > 0) {
      await supabase
        .from('studio_alerts')
        .update({ pushed_at: new Date().toISOString() })
        .in('id', pushedAlertIds)
    }

    return new Response(
      JSON.stringify({ success: true, sent, alerts: pushedAlertIds.length, pruned: deadSubIds.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (e) {
    console.error('dispatch-studio-push error', e)
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
