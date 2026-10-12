import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { detectedLocation } from './rules.ts';

Deno.serve(async (req) => {
  const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return respond({ error: 'Method not allowed' }, 405);
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
    if (!token) return respond({ error: 'Sign-in required' }, 401);
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '', { auth: { persistSession: false } });
    const { data, error } = await admin.auth.getClaims(token);
    const userId = data?.claims?.sub;
    if (error || typeof userId !== 'string') return respond({ error: 'Sign-in required' }, 401);
    const body = await req.json().catch(() => null);
    if (!body || body.functionalConsent !== true || Object.keys(body).some((key) => key !== 'functionalConsent')) {
      return respond({ error: 'Functional consent required; location input is not accepted' }, 400);
    }
    const { data: profile, error: readError } = await admin.from('profiles').select('ip_detected_country,ip_detected_currency,ip_detected_at').eq('id', userId).maybeSingle();
    if (readError) return respond({ error: 'Unable to read location' }, 500);
    if (profile?.ip_detected_at && Date.now() - Date.parse(profile.ip_detected_at) < 24 * 60 * 60 * 1000) {
      return respond({ country: profile.ip_detected_country, currency: profile.ip_detected_currency, detectedAt: profile.ip_detected_at, saved: true });
    }
    // Resolve the request IP server-side, never a submitted country, browser
    // locale, manual destination, or the server's own IP.
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    if (!ip || !/^[0-9a-fA-F:.]+$/.test(ip)) return respond({ saved: false, reason: 'Location unavailable' });
    const lookup = await fetch(`https://ipapi.co/${encodeURIComponent(ip)}/json/`, { signal: AbortSignal.timeout(3500) });
    if (!lookup.ok) return respond({ saved: false, reason: 'Location unavailable' });
    const geo = await lookup.json();
    const location = detectedLocation(geo.country_code);
    if (!location || geo.error) return respond({ saved: false, reason: 'Location unavailable' });
    const detectedAt = new Date().toISOString();
    const { data: saved, error: saveError } = await admin.from('profiles').update({
      ip_detected_country: location.country, ip_detected_currency: location.currency, ip_detected_at: detectedAt,
    }).eq('id', userId).select('id').maybeSingle();
    if (saveError || !saved) return respond({ error: 'Unable to save location' }, 500);
    return respond({ ...location, detectedAt, saved: true });
  } catch {
    return respond({ saved: false, reason: 'Location unavailable' });
  }
});