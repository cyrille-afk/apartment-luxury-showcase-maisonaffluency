// Email click tracking — logs the click then 302 redirects to the destination.
// Public endpoint (no auth) so it works directly from email clients.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function hashIp(ip: string): Promise<string> {
  const data = new TextEncoder().encode(ip + (Deno.env.get('SUPABASE_PROJECT_ID') ?? ''))
  const hash = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32)
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const url = new URL(req.url)
  const destination = url.searchParams.get('u')
  // Public endpoint: clamp caller-supplied labels so they can't flood logs.
  const label = (v: string | null) => (v ?? 'unknown').replace(/[^a-z0-9_\-.]/gi, '').slice(0, 80) || 'unknown'
  const template = label(url.searchParams.get('t'))
  const linkId = label(url.searchParams.get('l'))
  const rawRecipient = (url.searchParams.get('r') ?? '').trim().toLowerCase().slice(0, 254)

  // Validate destination — must be a maisonaffluency.com URL to prevent open redirect abuse
  let safeDestination: string | null = null
  try {
    if (destination) {
      const decoded = decodeURIComponent(destination)
      const d = new URL(decoded)
      if (d.protocol === 'https:' && (d.hostname === 'maisonaffluency.com' || d.hostname.endsWith('.maisonaffluency.com') || d.hostname === 'apartment-luxury-showcase-maisonaffluency.lovable.app')) {
        safeDestination = d.toString()
      }
    }
  } catch (_) { /* invalid url */ }

  if (!safeDestination) {
    return new Response('Invalid destination', { status: 400, headers: corsHeaders })
  }

  // Fire-and-forget log; never block redirect on logging failure
  try {
    const supabase = createClient(supabaseUrl, serviceKey)
    // Only attribute the click to a recipient we actually sent this template
    // to — a forged ?r= can't fabricate engagement for an arbitrary address.
    let recipient: string | null = null
    if (rawRecipient && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawRecipient)) {
      const { data: sent } = await supabase.from('email_send_log')
        .select('id').eq('template_name', template).eq('recipient_email', rawRecipient).limit(1).maybeSingle()
      if (sent) recipient = rawRecipient
    }
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? ''
    const ipHash = ip ? await hashIp(ip) : null
    await supabase.from('email_click_log').insert({
      template_name: template,
      link_id: linkId,
      destination_url: safeDestination,
      recipient_email: recipient,
      user_agent: req.headers.get('user-agent'),
      referer: req.headers.get('referer'),
      ip_hash: ipHash,
    })
  } catch (e) {
    console.error('click log failed', e)
  }

  return new Response(null, {
    status: 302,
    headers: { ...corsHeaders, Location: safeDestination, 'Cache-Control': 'no-store' },
  })
})
