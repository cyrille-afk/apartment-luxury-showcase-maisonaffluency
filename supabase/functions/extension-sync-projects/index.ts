// ChatGPT extension tool: get_synced_projects.
// Returns the signed-in member's active project folders, exactly as RLS
// exposes them in the portal (same scope as the /trade dashboard list).

import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'GET') return json({ error: 'Method not allowed' }, 405)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Missing auth' }, 401)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: claims } = await admin.auth.getClaims(token)
  const uid = claims?.claims?.sub
  if (!uid) return json({ error: 'Invalid token' }, 401)

  // RLS-scoped client: only projects the member can see in the portal.
  const scoped = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const limitParam = new URL(req.url).searchParams.get('limit')
  const limit = limitParam ? Math.max(1, Math.min(100, Number(limitParam) || 0)) : null

  let query = scoped
    .from('projects')
    .select('id, name, status')
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
  if (limit) query = query.limit(limit)

  const { data, error } = await query
  if (error) return json({ error: 'Could not load project folders' }, 500)

  const folders = (data ?? [])
    .filter((p) => typeof p.name === 'string' && p.name.trim().length > 0)
    .map((p) => ({ projectId: p.id, name: p.name, synced: true }))

  return json(folders)
})
