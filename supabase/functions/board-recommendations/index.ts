import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing auth' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const body = await req.json()
    const { board_id, product_ids, source } = body

    let boardTitle = 'Mood Board'
    let boardProductIds: string[] = []
    let cacheKey: string | null = null

    if (board_id) {
      const { data: board } = await supabase
        .from('client_boards')
        .select('id, title, user_id')
        .eq('id', board_id)
        .single()

      if (!board || board.user_id !== user.id) {
        return new Response(JSON.stringify({ error: 'Board not found' }), {
          status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      boardTitle = board.title
      cacheKey = board_id

      const { data: boardItems } = await supabase
        .from('client_board_items')
        .select('product_id')
        .eq('board_id', board_id)

      if (!boardItems || boardItems.length === 0) {
        return new Response(JSON.stringify({ recommendations: [], reason: 'Board has no items' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }

      boardProductIds = boardItems.map((i: any) => i.product_id)
    } else if (product_ids && Array.isArray(product_ids) && product_ids.length > 0) {
      boardProductIds = product_ids.slice(0, 20)
      boardTitle = source === 'mood_board' ? 'Your Mood Board' : 'Selection'
    } else {
      return new Response(JSON.stringify({ error: 'board_id or product_ids required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check cache for project boards
    if (cacheKey) {
      const { data: cached } = await supabase
        .from('board_recommendations')
        .select('product_id, score, reason, created_at')
        .eq('board_id', cacheKey)
        .order('score', { ascending: false })

      if (cached && cached.length > 0) {
        const cacheAge = Date.now() - new Date(cached[0].created_at).getTime()
        if (cacheAge < 24 * 60 * 60 * 1000) {
          const productIds = cached.map((r: any) => r.product_id)
          const { data: products } = await supabase
            .from('designer_curator_picks')
            .select('id, title, subtitle, image_url, category, designer_id')
            .in('id', productIds)

          const dIds = [...new Set((products || []).map((p: any) => p.designer_id))]
          const { data: designers } = await supabase.from('designers').select('id, name').in('id', dIds)
          const dMap = new Map((designers || []).map((d: any) => [d.id, d.name]))

          const enriched = cached.map((r: any) => {
            const prod = (products || []).find((p: any) => p.id === r.product_id)
            return {
              product_id: r.product_id, score: Number(r.score), reason: r.reason,
              title: prod?.title || '', subtitle: prod?.subtitle || '',
              image_url: prod?.image_url || '', category: prod?.category || '',
              brand: dMap.get(prod?.designer_id) || '',
            }
          })

          return new Response(JSON.stringify({ recommendations: enriched, board_title: boardTitle }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Resolve board items from both tables
    const { data: tradeProducts } = await supabase
      .from('trade_products')
      .select('id, product_name, brand_name, category, subcategory, materials, dimensions')
      .in('id', boardProductIds)

    const foundTradeIds = new Set((tradeProducts || []).map((p: any) => p.id))
    const missingIds = boardProductIds.filter(id => !foundTradeIds.has(id))

    let curatorProducts: any[] = []
    if (missingIds.length > 0) {
      const { data } = await supabase
        .from('designer_curator_picks')
        .select('id, title, subtitle, category, subcategory, materials, designer_id')
        .in('id', missingIds)
      curatorProducts = data || []
    }

    const curatorDesignerIds = [...new Set(curatorProducts.map((p: any) => p.designer_id))]
    let curatorDesignerMap = new Map<string, string>()
    if (curatorDesignerIds.length > 0) {
      const { data: designers } = await supabase.from('designers').select('id, name').in('id', curatorDesignerIds)
      curatorDesignerMap = new Map((designers || []).map((d: any) => [d.id, d.name]))
    }

    // Build board context with detailed info
    const boardItems = [
      ...(tradeProducts || []).map((p: any) => ({
        name: p.product_name, brand: p.brand_name,
        category: p.category, materials: p.materials || 'not specified',
        dimensions: p.dimensions || '',
      })),
      ...curatorProducts.map((p: any) => ({
        name: p.title, brand: curatorDesignerMap.get(p.designer_id) || 'Unknown',
        category: p.category || '', materials: p.materials || 'not specified',
        dimensions: '',
      })),
    ]

    const boardContext = boardItems.map(p =>
      `- "${p.name}" by ${p.brand} — Category: ${p.category}, Materials: ${p.materials}${p.dimensions ? ', Dimensions: ' + p.dimensions : ''}`
    ).join('\n')

    if (!boardContext.trim()) {
      return new Response(JSON.stringify({ recommendations: [], reason: 'No product details found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    console.log('Board items:', JSON.stringify(boardItems))

    // Build catalog from both sources, excluding board items
    const boardTitles = new Set(boardItems.map(p => p.name?.toLowerCase()))

    const { data: catalog } = await supabase
      .from('designer_curator_picks')
      .select('id, title, subtitle, category, subcategory, materials, tags, designer_id')
      .limit(300)

    const allDesignerIds = [...new Set((catalog || []).map((p: any) => p.designer_id))]
    const { data: allDesigners } = await supabase.from('designers').select('id, name').in('id', allDesignerIds)
    const designerMap = new Map((allDesigners || []).map((d: any) => [d.id, d.name]))

    const { data: tradeCatalog } = await supabase
      .from('trade_products')
      .select('id, product_name, brand_name, category, subcategory, materials, dimensions')
      .eq('is_active', true)
      .not('image_url', 'is', null)
      .limit(300)

    const availableCatalog = [
      ...(catalog || [])
        .filter((p: any) => !boardTitles.has(p.title?.toLowerCase()) && !boardProductIds.includes(p.id))
        .map((p: any) => ({
          id: p.id, title: p.title, category: p.category || '', materials: p.materials || '',
          tags: p.tags || [], brand: designerMap.get(p.designer_id) || '', source: 'curator' as const,
        })),
      ...(tradeCatalog || [])
        .filter((p: any) => !boardTitles.has(p.product_name?.toLowerCase()) && !boardProductIds.includes(p.id))
        .map((p: any) => ({
          id: p.id, title: p.product_name, category: p.category || '', materials: p.materials || '',
          tags: [] as string[], brand: p.brand_name || '', source: 'trade' as const,
        })),
    ]

    if (availableCatalog.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const catalogList = availableCatalog.slice(0, 200).map((p, i) =>
      `${i}: "${p.title}" by ${p.brand} | ${p.category} | Materials: ${p.materials || 'n/a'}`
    ).join('\n')

    // Extract key materials and categories from board for the prompt
    const boardMaterials = boardItems.map(p => p.materials).filter(m => m !== 'not specified').join(', ')
    const boardCategories = boardItems.map(p => p.category).filter(Boolean).join(', ')

    const systemPrompt = `You are a luxury interior design consultant curating items for a cohesive room scheme. You must select items that would naturally coexist in the same interior space as the client's existing selections.

## How to select (in priority order):

1. ROOM PAIRING — Would this item naturally sit alongside the board items in the same room? A dining table needs dining chairs, pendant lighting, a sideboard, table accessories. A lounge chair needs a side table, floor lamp, rug, art.

2. MATERIAL & FINISH HARMONY — Prioritize items sharing material families with the board. E.g. if the board has travertine + ash wood, favour items in natural stone, light wood, linen, warm metals.

3. FUNCTIONAL COMPLETENESS — Fill the room: if the board has seating but no lighting, add lighting. If it has a table but no seating, add seating. Think about what a real room needs.

4. SCALE & PROPORTION — Items should work at the same scale. Don't pair monumental tables with tiny accessories exclusively.

5. BRAND DIVERSITY — Spread recommendations across different brands/designers.

## What NOT to do:
- Do NOT select random items with no spatial or material relationship
- Do NOT pick items just because they share a category name
- Do NOT ignore the specific materials listed`

    const userPrompt = `## Board: "${boardTitle}"
Items currently selected:
${boardContext}

Key materials on this board: ${boardMaterials || 'not specified'}
Categories present: ${boardCategories || 'mixed'}

## Available catalog:
${catalogList}

Think step by step:
1. What room type do these items suggest? (dining, living, bedroom, etc.)
2. What's missing to complete that room?
3. Which catalog items share materials/finishes with the board?
4. Select 8 items that would work together in the same space.

Return a JSON array: [{"index": number, "score": 1-100, "reason": "explain the spatial/material connection to a specific board item"}]`

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.2,
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('AI error:', aiResponse.status, errText)
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content || '[]'
    console.log('AI response:', content.substring(0, 500))

    let parsed: any[]
    try {
      const obj = JSON.parse(content)
      parsed = Array.isArray(obj) ? obj : obj.recommendations || obj.results || Object.values(obj).find(Array.isArray) || []
    } catch {
      console.error('Failed to parse AI response:', content)
      parsed = []
    }

    const recommendations = parsed
      .filter((r: any) => typeof r.index === 'number' && r.index >= 0 && r.index < availableCatalog.length)
      .slice(0, 8)
      .map((r: any) => ({
        product_id: availableCatalog[r.index].id,
        score: r.score || 50,
        reason: r.reason || '',
        source: availableCatalog[r.index].source,
      }))

    // Cache for project boards (curator picks only due to FK)
    if (cacheKey && recommendations.length > 0) {
      const curatorRecs = recommendations.filter((r: any) => r.source === 'curator')
      if (curatorRecs.length > 0) {
        await supabase.from('board_recommendations').delete().eq('board_id', cacheKey)
        await supabase.from('board_recommendations').insert(
          curatorRecs.map((r: any) => ({
            board_id: cacheKey, product_id: r.product_id, score: r.score, reason: r.reason,
          }))
        )
      }
    }

    // Enrich results
    const curatorIds = recommendations.filter((r: any) => r.source === 'curator').map((r: any) => r.product_id)
    const tradeIds = recommendations.filter((r: any) => r.source === 'trade').map((r: any) => r.product_id)

    let recCuratorProducts: any[] = []
    let recTradeProducts: any[] = []

    if (curatorIds.length > 0) {
      const { data } = await supabase
        .from('designer_curator_picks')
        .select('id, title, subtitle, image_url, category, designer_id')
        .in('id', curatorIds)
      recCuratorProducts = data || []
    }
    if (tradeIds.length > 0) {
      const { data } = await supabase
        .from('trade_products')
        .select('id, product_name, brand_name, image_url, category')
        .in('id', tradeIds)
      recTradeProducts = data || []
    }

    const enriched = recommendations.map((r: any) => {
      if (r.source === 'trade') {
        const prod = recTradeProducts.find((p: any) => p.id === r.product_id)
        return {
          product_id: r.product_id, score: r.score, reason: r.reason,
          title: prod?.product_name || '', subtitle: '',
          image_url: prod?.image_url || '', category: prod?.category || '',
          brand: prod?.brand_name || '',
        }
      }
      const prod = recCuratorProducts.find((p: any) => p.id === r.product_id)
      return {
        product_id: r.product_id, score: r.score, reason: r.reason,
        title: prod?.title || '', subtitle: prod?.subtitle || '',
        image_url: prod?.image_url || '', category: prod?.category || '',
        brand: designerMap.get(prod?.designer_id) || '',
      }
    })

    return new Response(JSON.stringify({ recommendations: enriched, board_title: boardTitle }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Board recommendations error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
