import { createClient } from 'npm:@supabase/supabase-js@2'

import { rankCatalogCandidates, selectCandidateShortlist, summarizeBoardIntent } from './relevance.ts'

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
        category: p.category, subcategory: p.subcategory || '', materials: p.materials || 'not specified',
        dimensions: p.dimensions || '',
      })),
      ...curatorProducts.map((p: any) => ({
        name: p.title, brand: curatorDesignerMap.get(p.designer_id) || 'Unknown',
        category: p.category || '', subcategory: p.subcategory || '', materials: p.materials || 'not specified',
        dimensions: '',
      })),
    ]

    const boardContext = boardItems.map((p, i) =>
      `[B${i}] "${p.name}" by ${p.brand} — Category: ${p.category}, Materials: ${p.materials}${p.dimensions ? ', Dimensions: ' + p.dimensions : ''}`
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
          subcategory: p.subcategory || '', tags: p.tags || [], brand: designerMap.get(p.designer_id) || '', source: 'curator' as const,
        })),
      ...(tradeCatalog || [])
        .filter((p: any) => !boardTitles.has(p.product_name?.toLowerCase()) && !boardProductIds.includes(p.id))
        .map((p: any) => ({
          id: p.id, title: p.product_name, category: p.category || '', materials: p.materials || '',
          subcategory: p.subcategory || '', dimensions: p.dimensions || '', tags: [] as string[], brand: p.brand_name || '', source: 'trade' as const,
        })),
    ]

    if (availableCatalog.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const boardIntent = summarizeBoardIntent(
      boardItems.map((item, index) => ({
        id: `board-${index}`,
        title: item.name,
        brand: item.brand,
        category: item.category,
        subcategory: item.subcategory,
        materials: item.materials,
        dimensions: item.dimensions,
      }))
    )

    const rankedCatalog = rankCatalogCandidates(
      boardItems.map((item, index) => ({
        id: `board-${index}`,
        title: item.name,
        brand: item.brand,
        category: item.category,
        subcategory: item.subcategory,
        materials: item.materials,
        dimensions: item.dimensions,
      })),
      availableCatalog,
    )

    const shortlist = selectCandidateShortlist(rankedCatalog, 60)

    // Shuffle the entire shortlist so the AI sees candidates in a different order each refresh.
    // Pre-scores are still visible in the prompt, but positional bias drives variety.
    for (let i = shortlist.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shortlist[i], shortlist[j]] = [shortlist[j], shortlist[i]]
    }
    // Take only 30 random candidates so the AI must pick from a different subset each time
    const trimmed = shortlist.slice(0, 30)

    if (trimmed.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const catalogList = trimmed.map((p, i) =>
      `${i}: "${p.title}" by ${p.brand} | Role: ${p.role} | Category: ${p.category || 'n/a'} | Materials: ${p.materials || 'n/a'} | Fit: ${p.fitNote} | Pre-score: ${Math.round(p.score)}`
    ).join('\n')

    // Extract key materials and categories from board for the prompt
    const boardMaterials = boardItems.map(p => p.materials).filter(m => m !== 'not specified').join(', ')
    const boardCategories = boardItems.map(p => p.category).filter(Boolean).join(', ')

    const systemPrompt = `You are a luxury interior design consultant curating items for a cohesive room scheme. You are selecting from a shortlist that has already been relevance-ranked for same-room pairing.

## How to select (in priority order):

1. DIRECT PAIRING — Choose items that directly pair with a specific board item in the same room. A dining table needs dining chairs, pendant lighting, a sideboard, a rug. A chair needs a side table, floor lamp, rug, or sofa context.

2. SAME-ROOM COMPLETENESS — Fill in the room naturally. Do not select pieces that belong to a different room type.

3. MATERIAL & FINISH HARMONY — Prioritize items sharing material families, tones, or finishes with the board.

4. USE THE PRE-SCORE — If two options are close, trust the higher pre-score because the shortlist has already been screened for role and room fit.

5. BRAND DIVERSITY — Spread recommendations across different brands/designers.

## What NOT to do:
- Do NOT select random items with no direct pairing logic
- Do NOT choose multiple extra tables unless they clearly complete the room
- Do NOT ignore the fit notes or pre-scores
- Every reason must mention the anchor board item or the room function it completes`

    const userPrompt = `## Board: "${boardTitle}"
Items currently selected:
${boardContext}

Likely room(s): ${boardIntent.dominantRooms.join(', ') || 'mixed'}
Pieces already on the board: ${boardIntent.presentRoles.join(', ') || 'mixed'}
Most needed complement roles: ${boardIntent.desiredRoles.join(', ') || 'mixed'}
Key materials on this board: ${boardMaterials || boardIntent.materialTokens.join(', ') || 'not specified'}
Categories present: ${boardCategories || 'mixed'}

## Pre-ranked shortlist:
${catalogList}

Think step by step:
1. Identify the strongest anchor item(s) on the board.
2. Choose items that directly pair to those anchors or complete the same room.
3. Prefer higher pre-scores when options are otherwise similar.
4. Select 8 items that would realistically sit in the same room.

Return a JSON object with a recommendations array: {"recommendations": [{"index": number, "score": 1-100, "reason": "mention which board item it pairs with or what room gap it solves"}]}`

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
        temperature: 0.6,
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

    const fallbackRecommendations = trimmed.slice(0, 8).map((item) => ({
      product_id: item.id,
      score: Math.max(50, Math.min(100, Math.round(item.score))),
      reason: item.fitNote,
      source: item.source,
    }))

    const aiRecommendations = parsed
      .filter((r: any) => typeof r.index === 'number' && r.index >= 0 && r.index < trimmed.length)
      .slice(0, 8)
      .map((r: any) => ({
        product_id: trimmed[r.index].id,
        score: r.score || Math.max(50, Math.min(100, Math.round(trimmed[r.index].score))),
        reason: r.reason || trimmed[r.index].fitNote,
        source: trimmed[r.index].source,
      }))

    const recommendations: Array<{ product_id: string; score: number; reason: string; source?: 'curator' | 'trade' }> = []
    const seenProductIds = new Set<string>()

    for (const recommendation of [...aiRecommendations, ...fallbackRecommendations]) {
      if (seenProductIds.has(recommendation.product_id)) continue
      seenProductIds.add(recommendation.product_id)
      recommendations.push(recommendation)
      if (recommendations.length >= 8) break
    }

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
