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

    const { board_id } = await req.json()
    if (!board_id) {
      return new Response(JSON.stringify({ error: 'board_id required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Verify board ownership
    const { data: board } = await supabase
      .from('client_boards')
      .select('id, title, user_id')
      .eq('id', board_id)
      .single()

    if (!board || (board.user_id !== user.id)) {
      return new Response(JSON.stringify({ error: 'Board not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Get board items with product details
    const { data: boardItems } = await supabase
      .from('client_board_items')
      .select('product_id')
      .eq('board_id', board_id)

    if (!boardItems || boardItems.length === 0) {
      return new Response(JSON.stringify({ recommendations: [], reason: 'Board has no items' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const boardProductIds = boardItems.map((i: any) => i.product_id)

    // Get product details for board items (from trade_products since that's what client_board_items references)
    const { data: boardProducts } = await supabase
      .from('trade_products')
      .select('id, product_name, brand_name, category, subcategory, materials, dimensions')
      .in('id', boardProductIds)

    // Get catalog products (designer_curator_picks) excluding board items by title match
    const boardTitles = new Set((boardProducts || []).map((p: any) => p.product_name?.toLowerCase()))
    
    const { data: catalog } = await supabase
      .from('designer_curator_picks')
      .select('id, title, subtitle, category, subcategory, materials, tags, designer_id')
      .limit(500)

    // Get designer names for catalog items
    const designerIds = [...new Set((catalog || []).map((p: any) => p.designer_id))]
    const { data: designers } = await supabase
      .from('designers')
      .select('id, name')
      .in('id', designerIds)

    const designerMap = new Map((designers || []).map((d: any) => [d.id, d.name]))

    // Filter out products already on the board
    const availableCatalog = (catalog || [])
      .filter((p: any) => !boardTitles.has(p.title?.toLowerCase()))
      .map((p: any) => ({
        id: p.id,
        title: p.title,
        subtitle: p.subtitle,
        category: p.category || '',
        subcategory: p.subcategory || '',
        materials: p.materials || '',
        tags: p.tags || [],
        brand: designerMap.get(p.designer_id) || '',
      }))

    if (availableCatalog.length === 0) {
      return new Response(JSON.stringify({ recommendations: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Build AI prompt
    const boardContext = (boardProducts || []).map((p: any) =>
      `- ${p.product_name} by ${p.brand_name} (${p.category}${p.materials ? ', ' + p.materials : ''})`
    ).join('\n')

    const catalogList = availableCatalog.slice(0, 200).map((p: any, i: number) =>
      `${i}: ${p.title} by ${p.brand} | ${p.category} | ${p.materials} | ${(p.tags || []).join(', ')}`
    ).join('\n')

    const systemPrompt = `You are a luxury interior design consultant for Maison Affluency. Given a client's project board, recommend complementary products from the catalog. Consider:
- Material harmony (e.g. bronze with brass, marble with stone)
- Stylistic coherence (don't mix brutalist with rococo)
- Functional completeness (if board has seating but no lighting, suggest lighting)
- Brand diversity (don't suggest only from one brand)
Return exactly 8 recommendations as a JSON array.`

    const userPrompt = `## Client Board: "${board.title}"
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

    // Map AI output to catalog products
    const recommendations = parsed
      .filter((r: any) => typeof r.index === 'number' && r.index < availableCatalog.length)
      .slice(0, 8)
      .map((r: any) => ({
        product_id: availableCatalog[r.index].id,
        score: r.score || 50,
        reason: r.reason || '',
      }))

    // Delete old recommendations for this board, then insert new ones
    await supabase.from('board_recommendations').delete().eq('board_id', board_id)

    if (recommendations.length > 0) {
      await supabase.from('board_recommendations').insert(
        recommendations.map((r: any) => ({
          board_id,
          product_id: r.product_id,
          score: r.score,
          reason: r.reason,
        }))
      )
    }

    // Return enriched recommendations
    const recProductIds = recommendations.map((r: any) => r.product_id)
    const { data: recProducts } = await supabase
      .from('designer_curator_picks')
      .select('id, title, subtitle, image_url, category, materials, designer_id')
      .in('id', recProductIds)

    const enriched = recommendations.map((r: any) => {
      const prod = (recProducts || []).find((p: any) => p.id === r.product_id)
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

    return new Response(JSON.stringify({ recommendations: enriched, board_title: board.title }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('Board recommendations error:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
