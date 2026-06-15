// Polls recent net._http_response rows for scrape-products non-2xx responses
// and triggers an email alert via send-transactional-email.
// Invoked by pg_cron shortly after the daily scrape.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  // Cron-only: require shared secret
  const cronSecret = req.headers.get('x-cron-secret')
  if (!cronSecret || cronSecret !== Deno.env.get('CRON_SECRET')) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const url = new URL(req.url)
  const windowMinutes = Math.max(1, Math.min(1440, parseInt(url.searchParams.get('window') ?? '60', 10) || 60))

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: failures, error } = await supabase.rpc('get_recent_scrape_failures', {
    since_minutes: windowMinutes,
  })

  if (error) {
    console.error('rpc error', error)
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!failures || failures.length === 0) {
    return new Response(JSON.stringify({ ok: true, failures: 0 }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Idempotency: derive from latest failure id so the same batch isn't re-sent.
  const latestId = failures[0]?.id ?? Date.now()
  const idempotencyKey = `scrape-failure-${latestId}`

  const { error: sendError } = await supabase.functions.invoke('send-transactional-email', {
    body: {
      templateName: 'scrape-failure-alert',
      recipientEmail: 'cyrille@maisonaffluency.com',
      idempotencyKey,
      templateData: {
        windowMinutes,
        failures: failures.map((f: any) => ({
          status_code: f.status_code,
          body: f.body,
          created: f.created,
        })),
      },
    },
  })

  if (sendError) {
    console.error('send error', sendError)
    return new Response(JSON.stringify({ error: 'send_failed' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ ok: true, failures: failures.length, idempotencyKey }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
