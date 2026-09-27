import { createClient } from 'npm:@supabase/supabase-js@2'
import { z } from 'npm:zod@3.23.8'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

const Body = z.discriminatedUnion('action', [
  z.object({ action: z.literal('request'), slug: z.string().min(1).max(200), email: z.string().trim().email().max(255) }),
  z.object({ action: z.literal('verify'), slug: z.string().min(1).max(200), email: z.string().trim().email().max(255), code: z.string().regex(/^\d{6}$/) }),
])

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return json({ error: 'Invalid request' }, 400)
  const url = Deno.env.get('SUPABASE_URL')!
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const svc = createClient(url, key)
  const b = parsed.data

  if (b.action === 'request') {
    const { data, error } = await svc.rpc('board_access_request', { _slug: b.slug, _email: b.email })
    if (error) return json({ error: error.message.includes('wait') ? 'Please wait a moment before requesting another code.' : 'Could not issue a code.' }, 429)
    if (!data) return json({ error: 'This email has not been invited to this board.' }, 403)
    const d = data as any
    const res = await fetch(`${url}/functions/v1/send-transactional-email`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, apikey: key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateName: 'board-access-code', recipientEmail: d.email,
        idempotencyKey: `board-access-${crypto.randomUUID()}`,
        templateData: { code: d.code, studioName: d.studio_name, studioLogoUrl: d.studio_logo_url, hideMaisonBranding: d.hide_maison_branding !== false, projectName: d.project_name },
      }),
    })
    if (!res.ok) { console.error('send failed', res.status); return json({ error: 'Could not send the code.' }, 502) }
    return json({ ok: true })
  }

  const { data: token, error } = await svc.rpc('board_access_verify', { _slug: b.slug, _email: b.email, _code: b.code })
  if (error || !token) return json({ error: 'That code is incorrect or has expired.' }, 403)
  return json({ token })
})
