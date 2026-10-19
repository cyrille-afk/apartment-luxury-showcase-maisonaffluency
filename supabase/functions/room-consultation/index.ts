import { createClient } from 'npm:@supabase/supabase-js@2';
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { z } from 'npm:zod@3';

const schema = z.object({
  room: z.enum(['living-room', 'dining-room', 'bedroom', 'office', 'outdoor']),
  name: z.string().trim().min(1).max(100),
  email: z.string().trim().email().max(255),
  company: z.string().trim().min(1).max(150),
  profession: z.enum(['architect', 'interior-designer']),
  phone: z.string().trim().max(50).regex(/^[+\d\s().-]*$/),
  project: z.string().trim().max(200),
  location: z.string().trim().max(200),
  message: z.string().trim().min(1).max(4000),
  website: z.string().max(0),
}).strict();
const rooms = { 'living-room': 'Living Room', 'dining-room': 'Dining Room', bedroom: 'Bedroom', office: 'Home Office', outdoor: 'Outdoor' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
});
// Same best-effort per-instance submission limiter as the public brief intake.
const buckets = new Map<string, { count: number; expires: number }>();

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  try {
    const text = await req.text();
    if (text.length > 16000) return json({ error: 'Your inquiry is too long.' }, 413);
    let body: unknown;
    try { body = JSON.parse(text); } catch { return json({ error: 'Invalid inquiry.' }, 400); }
    const parsed = schema.safeParse(body);
    if (!parsed.success) return json({ error: 'Please check your contact details and project brief.' }, 400);
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'unknown';
    const now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.expires <= now) buckets.delete(key);
    const bucket = buckets.get(ip) || { count: 0, expires: now + 15 * 60 * 1000 };
    if (bucket.count >= 6) return json({ error: 'Too many inquiries. Please try again later.' }, 429);
    bucket.count++;
    buckets.set(ip, bucket);
    const url = Deno.env.get('SUPABASE_URL');
    const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!url || !key) return json({ error: 'Inquiries are temporarily unavailable.' }, 503);
    const client = createClient(url, key);
    const data = parsed.data;
    const id = crypto.randomUUID();
    const subject = `Design consultation — ${rooms[data.room]}`;
    const message = [
      `Room: ${rooms[data.room]}`,
      `Profession: ${data.profession === 'architect' ? 'Architect' : 'Interior designer'}`,
      data.project ? `Project: ${data.project}` : '',
      data.location ? `Location: ${data.location}` : '',
      `Collection: https://www.maisonaffluency.com/shop-by-room/${data.room}`,
      '', data.message,
    ].filter(line => line !== '').join('\n');
    const { error } = await client.from('inquiries').insert({
      id, name: data.name, email: data.email.toLowerCase(), company: data.company,
      phone: data.phone || null, subject, message, source: 'room_consultation', status: 'new',
    });
    if (error) return json({ error: 'Your inquiry could not be saved. Please try again.' }, 500);
    // Store first; fixed-recipient template and queue handle both owner copies.
    let notificationQueued = false;
    try {
      const result = await client.functions.invoke('send-transactional-email', { body: {
        templateName: 'inquiry-notification', recipientEmail: 'concierge@maisonaffluency.com',
        idempotencyKey: `room-consultation-${id}`,
        templateData: { name: data.name, email: data.email, company: data.company, phone: data.phone, subject, message },
      } });
      notificationQueued = !result.error && result.data?.success === true;
    } catch { /* The saved inquiry remains available in the owner's inbox. */ }
    return json({ success: true, id, notificationQueued });
  } catch {
    return json({ error: 'Unable to send your inquiry. Please try again.' }, 500);
  }
});