// ChatGPT extension tool: stage_product_to_project.
// Executes the verified data handshake: validates the bearer token, the
// catalogue product and the target project folder, then writes the staged
// piece to the member's board exactly as the in-portal sidebar does.
// Folder names resolve case-insensitively against the same normalization
// rule used by get_synced_projects (supabase/functions/_shared/projectFolders.ts).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { normalizeFolderName, pickCanonicalFolder } from '../_shared/projectFolders.ts'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Missing auth' }, 401)

  let body: { productId?: unknown; productName?: unknown; targetWorkflow?: unknown }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body' }, 400)
  }

  const productId = typeof body.productId === 'string' ? body.productId : ''
  const productName = typeof body.productName === 'string' ? body.productName.trim() : ''
  const targetWorkflow = typeof body.targetWorkflow === 'string' ? body.targetWorkflow.trim() : ''
  if (!UUID_RE.test(productId)) return json({ error: 'productId must be a UUID' }, 400)
  if (!productName || productName.length > 250) return json({ error: 'productName is required' }, 400)
  if (!targetWorkflow || targetWorkflow.length > 250) return json({ error: 'targetWorkflow is required' }, 400)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: claims } = await admin.auth.getClaims(token)
  const uid = claims?.claims?.sub
  if (!uid) return json({ error: 'Invalid token' }, 401)

  // RLS-scoped client: the member can only stage into folders they can access.
  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  // 1. Product must exist in the trade catalogue, be visible, and match by name.
  const { data: product, error: productError } = await scoped
    .from('trade_products')
    .select('id, product_name, is_hidden')
    .eq('id', productId)
    .maybeSingle()
  if (productError) return json({ error: 'Could not verify product' }, 500)
  if (!product || product.is_hidden) {
    return json({
      status: 'rejected', targetWorkflow,
      message: `Rejected: no visible catalogue product matches id ${productId}.`,
    })
  }
  if (String(product.product_name).trim().toLowerCase() !== productName.toLowerCase()) {
    return json({
      status: 'rejected', targetWorkflow,
      message: `Rejected: product name does not match the catalogue entry (${product.product_name}).`,
    })
  }

  // 2. Target folder must be an active project visible to this member.
  //    Name matching is case/whitespace-insensitive so "DE BEERS", "De Beers"
  //    and "de beers" all resolve to the same folder; the most recently
  //    updated matching row is the canonical one (same rule as the folder list).
  const { data: candidateProjects, error: projectError } = await scoped
    .from('projects')
    .select('id, name, status, studio_id, client_name')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  if (projectError) return json({ error: 'Could not verify project folder' }, 500)
  const project = candidateProjects
    ? pickCanonicalFolder(candidateProjects as { name: string }[], targetWorkflow)
    : undefined
  if (!project) {
    return json({
      status: 'rejected', targetWorkflow,
      message: `Rejected: no active project folder named "${targetWorkflow}" is synced for this member.`,
    })
  }

  // 3. Reuse the project's board, or create it like the portal sidebar does.
  const { data: existingBoard, error: boardError } = await scoped
    .from('client_boards')
    .select('id')
    .eq('project_id', project.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (boardError) return json({ error: 'Could not verify project board' }, 500)

  let boardId = existingBoard?.id
  if (!boardId) {
    const created = await scoped.from('client_boards').insert({
      user_id: uid, studio_id: project.studio_id ?? null, project_id: project.id,
      title: `${project.name} — Selection`, client_name: project.client_name || '',
      hide_maison_branding: true,
    } as never).select('id').single()
    if (created.error || !created.data) return json({ error: 'Could not create the project board' }, 500)
    boardId = created.data.id
  }

  // 4. Idempotent write: one record per product per board.
  const { data: duplicate, error: duplicateError } = await scoped
    .from('client_board_items')
    .select('id')
    .eq('board_id', boardId)
    .eq('product_id', productId)
    .limit(1)
    .maybeSingle()
  if (duplicateError) return json({ error: 'Could not verify staged pieces' }, 500)

  let boardItemId = duplicate?.id
  if (!duplicate) {
    const inserted = await scoped
      .from('client_board_items')
      .insert({ board_id: boardId, product_id: productId } as never)
      .select('id')
      .single()
    if (inserted.error || !inserted.data) return json({ error: 'Could not stage the piece' }, 500)
    boardItemId = inserted.data.id
  }

  return json({
    status: 'staged',
    boardItemId,
    // Canonical folder name as it exists in the portal, not the caller's casing.
    targetWorkflow: project.name.trim(),
    verifiedAt: new Date().toISOString(),
    message: `Success: ${product.product_name} added to ${project.name.trim()}`,
  })
})
