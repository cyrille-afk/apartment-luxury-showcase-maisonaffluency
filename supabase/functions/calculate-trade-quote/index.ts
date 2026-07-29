import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body = await req.json();
    const project_id: string | undefined = body?.project_id;
    const base_items: Array<{ name: string; price: number }> = Array.isArray(body?.base_items) ? body.base_items : [];

    if (!project_id || base_items.length === 0) {
      return new Response(JSON.stringify({ error: 'project_id and base_items are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: project, error: projectError } = await supabaseClient
      .from('projects')
      .select('trade_multiplier, location_neighborhood, location_city')
      .eq('id', project_id)
      .single();

    if (projectError) throw projectError;

    const multiplier = Number(project?.trade_multiplier) || 1.0;

    let subtotal = 0;
    const calculatedItems = base_items.map((item) => {
      const price = Number(item.price) || 0;
      subtotal += price;
      return {
        item_name: item.name,
        original_price: price,
        discounted_price: Math.round(price * multiplier),
      };
    });

    const totalDiscount = Math.round(subtotal * (1 - multiplier));
    const finalTotal = subtotal - totalDiscount;

    const locationParts = [project?.location_neighborhood, project?.location_city].filter(Boolean);

    return new Response(
      JSON.stringify({
        success: true,
        meta: {
          location: locationParts.join(', ') || null,
          multiplier_applied: multiplier,
          shipping_tier: multiplier < 1 ? 'White-Glove NY Hub' : 'Standard',
        },
        pricing_summary: {
          items: calculatedItems,
          subtotal,
          trade_discount_applied: totalDiscount,
          estimated_total: finalTotal,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
