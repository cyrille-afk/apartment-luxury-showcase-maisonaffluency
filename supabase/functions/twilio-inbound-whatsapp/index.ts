import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors'

// TEMPORARY diagnostic endpoint: logs full inbound Twilio WhatsApp payloads
// so we can capture identifiers (e.g. group IDs) from raw webhook metadata.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    let payload: Record<string, string> = {}

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const form = await req.formData()
      form.forEach((value, key) => {
        payload[key] = String(value)
      })
    } else if (contentType.includes('application/json')) {
      payload = await req.json()
    } else {
      payload = { raw: await req.text() }
    }

    console.log('=== TWILIO INBOUND WHATSAPP PAYLOAD ===')
    console.log(JSON.stringify(payload, null, 2))
    // Highlighted extraction fields for quick scanning in logs:
    console.log('From:', payload.From ?? '(none)')
    console.log('To:', payload.To ?? '(none)')
    console.log('Body:', payload.Body ?? '(none)')
    console.log('Author:', payload.Author ?? '(none)')
    console.log('Participant:', payload.Participant ?? '(none)')
    console.log('=== END PAYLOAD ===')

    // Respond with valid TwiML so Twilio does not retry/error
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } },
    )
  } catch (err) {
    console.error('twilio-inbound-whatsapp error:', err)
    return new Response(
      '<?xml version="1.0" encoding="UTF-8"?><Response></Response>',
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'text/xml' } },
    )
  }
})
