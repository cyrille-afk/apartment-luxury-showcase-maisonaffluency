import { createClient } from 'npm:@supabase/supabase-js@2'
import { render } from 'npm:@react-email/render@0.0.12'
import { WeeklyDigestEmail } from '../_shared/email-templates/weekly-digest.tsx'

const TRADE_USER_THRESHOLD = 25
const TOP_PRODUCTS_COUNT = 3
const NEW_ARRIVALS_COUNT = 3

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const siteUrl = Deno.env.get('SITE_URL') || 'https://apartment-luxury-showcase-maisonaffluency.lovable.app'

    // 1. Check if we've reached the trade user threshold
    const { count: tradeUserCount } = await supabase
      .from('user_roles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'trade_user')

    if ((tradeUserCount || 0) < TRADE_USER_THRESHOLD) {
      return new Response(
        JSON.stringify({ skipped: true, reason: `Only ${tradeUserCount} trade users (threshold: ${TRADE_USER_THRESHOLD})` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 2. Get top 3 most-favorited products
    const { data: favs } = await supabase
      .from('trade_favorites')
      .select('product_id')

    const favCounts = new Map<string, number>()
    for (const f of (favs || [])) {
      favCounts.set(f.product_id, (favCounts.get(f.product_id) || 0) + 1)
    }
    const topProductIds = [...favCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, TOP_PRODUCTS_COUNT)

    let popularProducts: { name: string; brand: string; image_url: string | null; fav_count: number }[] = []
    if (topProductIds.length > 0) {
      const { data: prods } = await supabase
        .from('trade_products')
        .select('id, product_name, brand_name, image_url')
        .in('id', topProductIds.map(([id]) => id))

      const prodMap = new Map((prods || []).map((p: any) => [p.id, p]))
      popularProducts = topProductIds.map(([pid, count]) => {
        const p = prodMap.get(pid)
        return p ? { name: p.product_name, brand: p.brand_name, image_url: p.image_url, fav_count: count } : null
      }).filter(Boolean) as any
    }

    // 3. Get 3 newest products (added in the last 7 days)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: newProds } = await supabase
      .from('trade_products')
      .select('product_name, brand_name, image_url')
      .gte('created_at', oneWeekAgo)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(NEW_ARRIVALS_COUNT)

    const newArrivals = (newProds || []).map((p: any) => ({
      name: p.product_name,
      brand: p.brand_name,
      image_url: p.image_url,
    }))

    // Skip if there's nothing to show
    if (popularProducts.length === 0 && newArrivals.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'No content to include in digest' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // 4. Get all trade user emails
    const { data: tradeRoles } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('role', 'trade_user')

    if (!tradeRoles || tradeRoles.length === 0) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'No trade users found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, email')
      .in('id', tradeRoles.map((r: any) => r.user_id))

    // Check suppressed emails
    const { data: suppressed } = await supabase
      .from('suppressed_emails')
      .select('email')

    const suppressedSet = new Set((suppressed || []).map((s: any) => s.email.toLowerCase()))

    const recipients = (profiles || []).filter(
      (p: any) => p.email && !suppressedSet.has(p.email.toLowerCase())
    )

    // 5. Render and enqueue emails
    let enqueued = 0
    for (const recipient of recipients) {
      const html = await render(
        WeeklyDigestEmail({
          recipient: recipient.email,
          siteUrl,
          popularProducts,
          newArrivals,
        })
      )

      const messageId = `weekly-digest-${new Date().toISOString().slice(0, 10)}-${recipient.id}`

      await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to: recipient.email,
          subject: 'Your Weekly Highlights — Maison Affluency',
          html,
          message_id: messageId,
          template_name: 'weekly-digest',
        },
      })

      // Log the send
      await supabase.from('email_send_log').insert({
        message_id: messageId,
        template_name: 'weekly-digest',
        recipient_email: recipient.email,
        status: 'pending',
      })

      enqueued++
    }

    return new Response(
      JSON.stringify({ success: true, enqueued, popular: popularProducts.length, new_arrivals: newArrivals.length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Weekly digest error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
