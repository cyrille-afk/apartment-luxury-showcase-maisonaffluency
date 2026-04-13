import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    // Authenticate caller
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

    // Two modes: board_id (project folders) OR product_ids (mood board)
    let boardTitle = 'Mood Board'
    let boardProductIds: string[] = []
    let cacheKey: string | null = null

    if (board_id) {
      // === Mode 1: Project board ===
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
      // === Mode 2: Direct product IDs (mood board) ===
      boardProductIds = product_ids.slice(0, 20) // Cap at 20
      boardTitle = source === 'mood_board' ? 'Your Mood Board' : 'Selection'
    } else {
      return new Response(JSON.stringify({ error: 'board_id or product_ids required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Check cache if we have a cache key (project boards only)
    if (cacheKey) {
      const { data: cached } = await supabase
        .from('board_recommendations')
        .select('product_id, score, reason, created_at')
        .eq('board_id', cacheKey)
        .order('score', { ascending: false })

      if (cached && cached.length > 0) {
        const cacheAge = Date.now() - new Date(cached[0].created_at).getTime()
        const twentyFourHours = 24 * 60 * 60 * 1000

        if (cacheAge < twentyFourHours) {
          const productIds = cached.map((r: any) => r.product_id)
          const { data: products } = await supabase
            .from('designer_curator_picks')
            .select('id, title, subtitle, image_url, category, designer_id')
            .in('id', productIds)

          const designerIds = [...new Set((products || []).map((p: any) => p.designer_id))]
          const { data: designers } = await supabase
            .from('designers')
            .select('id, name')
            .in('id', designerIds)

          const designerMap = new Map((designers || []).map((d: any) => [d.id, d.name]))

          const enriched = cached.map((r: any) => {
            const prod = (products || []).find((p: any) => p.id === r.product_id)
            return {
              product_id: r.product_id,
              score: Number(r.score),
              reason: r.reason,
              title: prod?.title || '',
              subtitle: prod?.subtitle || '',
              image_url: prod?.image_url || '',
              category: prod?.category || '',
              brand: designerMap.get(prod?.designer_id) || '',
            }
          })

          return new Response(JSON.stringify({ recommendations: enriched, board_title: boardTitle }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          })
        }
      }
    }

    // Get product details — try trade_products first, then curator_picks
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

    // Get designer names for curator products
    const curatorDesignerIds = [...new Set(curatorProducts.map((p: any) => p.designer_id))]
    let curatorDesignerMap = new Map<string, string>()
    if (curatorDesignerIds.length > 0) {
      const { data: designers } = await supabase
        .from('designers')
        .select('id, name')
        .in('id', curatorDesignerIds)
      curatorDesignerMap = new Map((designers || []).map((d: any) => [d.id, d.name]))
    }

    // Build unified board context
    const boardContext = [
      ...(tradeProducts || []).map((p: any) =>
        `- ${p.product_name} by ${p.brand_name} (${p.category}${p.materials ? ', ' + p.materials : ''})`
      ),
      ...curatorProducts.map((p: any) =>
        `- ${p.title} by ${curatorDesignerMap.get(p.designer_id) || 'Unknown'} (${p.category || ''}${p.materials ? ', ' + p.materials : ''})`
      ),
    ].join('\n')

    if (!boardContext.trim()) {
      return new Response(JSON.stringify({ recommendations: [], reason: 'No product details found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get catalog products from BOTH sources excluding board items
    const boardTitles = new Set([
      ...(tradeProducts || []).map((p: any) => p.product_name?.toLowerCase()),
      ...curatorProducts.map((p: any) => p.title?.toLowerCase()),
    ])

    // Source 1: designer_curator_picks
    const { data: catalog } = await supabase
      .from('designer_curator_picks')
      .select('id, title, subtitle, category, subcategory, materials, tags, designer_id')
      .limit(300)

    const allDesignerIds = [...new Set((catalog || []).map((p: any) => p.designer_id))]
    const { data: allDesigners } = await supabase
      .from('designers')
      .select('id, name')
      .in('id', allDesignerIds)

    const designerMap = new Map((allDesigners || []).map((d: any) => [d.id, d.name]))

    // Source 2: trade_products (active, with images)
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
          id: p.id,
          title: p.title,
          subtitle: p.subtitle,
          category: p.category || '',
          subcategory: p.subcategory || '',
          materials: p.materials || '',
          tags: p.tags || [],
          brand: designerMap.get(p.designer_id) || '',
          source: 'curator' as const,
        })),
      ...(tradeCatalog || [])
        .filter((p: any) => !boardTitles.has(p.product_name?.toLowerCase()) && !boardProductIds.includes(p.id))
        .map((p: any) => ({
          id: p.id,
          title: p.product_name,
          subtitle: '',
          category: p.category || '',
          subcategory: p.subcategory || '',
          materials: p.materials || '',
          tags: [] as string[],
          brand: p.brand_name || '',
          source: 'trade' as const,
        })),
    ]

    if (availableCatalog.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build AI prompt
    const catalogList = availableCatalog.slice(0, 200).map((p: any, i: number) =>
      `${i}: ${p.title} by ${p.brand} | ${p.category} | ${p.materials} | ${(p.tags || []).join(', ')}`
    ).join('\n')

    const systemPrompt = `You are a luxury interior design consultant for Maison Affluency. Given a client's project board, recommend complementary products from the catalog. Consider:
- Material harmony (e.g. bronze with brass, marble with stone)
- Stylistic coherence (don't mix brutalist with rococo)
- Functional completeness (if board has seating but no lighting, suggest lighting)
- Brand diversity (don't suggest only from one brand)
Return exactly 8 recommendations as a JSON array.`

    const userPrompt = `## Client Board: "${boardTitle}"
Current items:
${boardContext}

## Available Catalog (index: product | category | materials | tags):
${catalogList}

Return a JSON array of objects with: {"index": number, "score": number (1-100), "reason": string (one sentence)}
Order by score descending. Pick 8 complementary products.`

    // Call Lovable AI
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
        temperature: 0.7,
      }),
    })

    if (!aiResponse.ok) {
      const errText = await aiResponse.text()
      console.error('AI error:', errText)
      return new Response(JSON.stringify({ error: 'AI service error' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const aiData = await aiResponse.json()
    const content = aiData.choices?.[0]?.message?.content || '[]'

    let parsed: any[]
    try {
      const obj = JSON.parse(content)
      parsed = Array.isArray(obj) ? obj : obj.recommendations || obj.results || Object.values(obj).find(Array.isArray) || []
    } catch {
      console.error('Failed to parse AI response:', content)
      parsed = []
    }

    // Map AI output to catalog products, preserving source info
    const recommendations = parsed
      .filter((r: any) => typeof r.index === 'number' && r.index < availableCatalog.length)
      .slice(0, 8)
      .map((r: any) => ({
        product_id: availableCatalog[r.index].id,
        score: r.score || 50,
        reason: r.reason || '',
        source: availableCatalog[r.index].source,
      }))

    // Cache if project board (only curator picks can be cached due to FK constraint)
    if (cacheKey && recommendations.length > 0) {
      const curatorRecs = recommendations.filter((r: any) => r.source === 'curator')
      if (curatorRecs.length > 0) {
        await supabase.from('board_recommendations').delete().eq('board_id', cacheKey)
        await supabase.from('board_recommendations').insert(
          curatorRecs.map((r: any) => ({
            board_id: cacheKey,
            product_id: r.product_id,
            score: r.score,
            reason: r.reason,
          }))
        )
      }
    }

    // Enrich from both sources
    const curatorIds = recommendations.filter((r: any) => r.source === 'curator').map((r: any) => r.product_id)
    const tradeIds = recommendations.filter((r: any) => r.source === 'trade').map((r: any) => r.product_id)

    let recCuratorProducts: any[] = []
    let recTradeProducts: any[] = []

    if (curatorIds.length > 0) {
      const { data } = await supabase
        .from('designer_curator_picks')
        .select('id, title, subtitle, image_url, category, materials, designer_id')
        .in('id', curatorIds)
      recCuratorProducts = data || []
    }
    if (tradeIds.length > 0) {
      const { data } = await supabase
        .from('trade_products')
        .select('id, product_name, brand_name, image_url, category, materials')
        .in('id', tradeIds)
      recTradeProducts = data || []
    }

    const enriched = recommendations.map((r: any) => {
      if (r.source === 'trade') {
        const prod = recTradeProducts.find((p: any) => p.id === r.product_id)
        return {
          product_id: r.product_id,
          score: r.score,
          reason: r.reason,
          title: prod?.product_name || '',
          subtitle: '',
          image_url: prod?.image_url || '',
          category: prod?.category || '',
          brand: prod?.brand_name || '',
        }
      }
      const prod = recCuratorProducts.find((p: any) => p.id === r.product_id)
      return {
        product_id: r.product_id,
        score: r.score,
        reason: r.reason,
        title: prod?.title || '',
        subtitle: prod?.subtitle || '',
        image_url: prod?.image_url || '',
        category: prod?.category || '',
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