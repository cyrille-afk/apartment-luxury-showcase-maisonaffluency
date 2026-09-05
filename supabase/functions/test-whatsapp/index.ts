import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

Deno.serve(async () => {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
  if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
    return new Response(JSON.stringify({ error: "missing keys" }), { status: 500 });
  }
  const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": TWILIO_API_KEY,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      To: "whatsapp:+6591393850",
      From: "whatsapp:+14155238886",
      Body: "Test from Maison Affluency: your Twilio WhatsApp sandbox is working end-to-end.",
    }),
  });
  const text = await res.text();
  return new Response(JSON.stringify({ status: res.status, body: text }), {
    headers: { "Content-Type": "application/json" },
  });
});
