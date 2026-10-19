import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3.23.8';
import { recognizePrivateClient } from '../_shared/privateClientRecognition.ts';

const Body = z.object({
  action: z.enum(['request','verify','check']), email: z.string().trim().email().max(255),
  challengeId: z.string().uuid().optional(), code: z.string().regex(/^\d{6}$/).optional(),
  sessionId: z.string().regex(/^[0-9a-f-]{32,64}$/i).optional(),
  turnstileToken: z.string().max(2048).optional(),
  intent: z.enum(['recognize','forget','optin']).optional(),
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type':'application/json', 'Cache-Control':'no-store' },
});
async function hash(value: string) {
  const digest = await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
}
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok',{headers:corsHeaders});
  if (req.method !== 'POST') return json({error:'Method not allowed'},405);
  const parsed = Body.safeParse(await req.json().catch(()=>null));
  if (!parsed.success) return json({error:'Invalid request'},400);
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({error:'Service unavailable'},503);
  const svc = createClient(url,key);
  try {
    const b = parsed.data;
    let verifiedEmail: string | null = null;
    const bearer = req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
    if (b.action === 'check' && bearer) {
      const {data,error} = await svc.auth.getClaims(bearer);
      if (!error && data?.claims?.role === 'authenticated' && typeof data.claims.email === 'string') verifiedEmail = data.claims.email;
    }
    const ip = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    if (b.action === 'request') {
      const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
      if (!secret || !b.turnstileToken) return json({error:'Please complete the security check.'},403);
      const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{
        method:'POST',body:new URLSearchParams({secret,response:b.turnstileToken,remoteip:ip}),
      });
      const verification = await result.json();
      if (!verification.success) return json({error:'Please complete the security check.'},403);
    }
    const result = await recognizePrivateClient(b,verifiedEmail,await hash(ip),{
      request: async (email,ipHash) => {
        const {data,error} = await svc.rpc('private_client_code_request',{_email:email,_ip_hash:ipHash});
        if (error) throw error;
        return data;
      },
      verify: async (id,email,code) => {
        const {data,error} = await svc.rpc('private_client_code_verify',{_id:id,_email:email,_code:code});
        if (error) throw error;
        return data === true;
      },
      activity: async (email,session) => {
        const {data:out,error:outErr} = await svc.rpc('private_client_is_opted_out',{_email:email});
        if (outErr) throw outErr;
        if (out === true) return false;
        const {data,error} = await svc.rpc('private_client_has_activity',{_email:email,_exclude_session:session ? 'h_' + await hash('cart:' + session) : null});
        if (error) throw error;
        return data === true;
      },
      forget: async (email) => {
        const {error} = await svc.rpc('private_client_forget',{_email:email});
        if (error) throw error;
      },
      optin: async (email) => {
        const {error} = await svc.rpc('private_client_optin',{_email:email});
        if (error) throw error;
      },
      send: async (email,id,code) => {
        const response = await fetch(`${url}/functions/v1/send-transactional-email`,{
          method:'POST',headers:{Authorization:`Bearer ${key}`,apikey:key,'Content-Type':'application/json'},
          body:JSON.stringify({templateName:'private-client-code',recipientEmail:email,idempotencyKey:`private-client-code-${id}`,templateData:{code}}),
        });
        if (!response.ok) throw new Error('Email delivery unavailable');
      },
    });
    return json(result.body,result.status);
  } catch { return json({error:'Could not verify your email. Please try again.'},502); }
});