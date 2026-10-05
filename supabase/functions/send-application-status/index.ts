import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'
import { z } from 'npm:zod@3'

const Body = z.object({
  applicantEmail: z.string().trim().email().max(254),
  status: z.enum(['approved', 'rejected']),
})
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
})

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return response({ error: 'Method not allowed' }, 405)
  try {
    const url = Deno.env.get('SUPABASE_URL')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    if (!url || !anonKey || !serviceKey) return response({ error: 'Server configuration error' }, 500)
    const auth = req.headers.get('Authorization') ?? ''
    if (!auth.startsWith('Bearer ')) return response({ error: 'Unauthorized' }, 401)
    const client = createClient(url, anonKey, { global: { headers: { Authorization: auth } } })
    const { data: claims, error: authError } = await client.auth.getClaims(auth.slice(7))
    const callerId = claims?.claims?.sub
    if (authError || !callerId) return response({ error: 'Unauthorized' }, 401)
    const service = createClient(url, serviceKey)
    const { data: roles, error: roleError } = await service.from('user_roles').select('role')
      .eq('user_id', callerId).in('role', ['admin', 'super_admin'])
    if (roleError || !roles?.length) return response({ error: 'Forbidden' }, 403)
    const parsed = Body.safeParse(await req.json().catch(() => null))
    if (!parsed.success) return response({ error: 'Invalid application notification' }, 400)
    const { applicantEmail, status } = parsed.data
    const { data: account, error } = await service.from('trade_accounts')
      .select('id, email, contact_name, studio_name, status').eq('email', applicantEmail.toLowerCase()).maybeSingle()
    if (error || !account) return response({ error: 'Application not found' }, 404)
    if (account.status !== status) return response({ error: 'Save the application decision before notifying' }, 409)
    const templateName = status === 'approved' ? 'trade-approval' : 'trade-rejection'
    const { data, error: mailError } = await client.functions.invoke('send-transactional-email', {
      body: { templateName, recipientEmail: account.email, idempotencyKey: `${templateName}-${account.id}`,
        templateData: { name: account.contact_name ?? undefined, companyName: account.studio_name ?? undefined } },
    })
    if (mailError) return response({ error: 'Notification could not be queued' }, 502)
    return response(data)
  } catch {
    return response({ error: 'An unexpected error occurred' }, 500)
  }
})
