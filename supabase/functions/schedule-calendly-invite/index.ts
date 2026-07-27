// Placeholder edge function for the "Yes, Schedule Morning Call" flow.
//
// TODO — Full Calendly + HubSpot integration:
//
// 1. Credentials (store via the Lovable secrets tool, NEVER hardcode):
//    - CALENDLY_API_KEY        → Lovable App User Connector (Calendly).
//      Once connected, gateway calls go through:
//        https://connector-gateway.lovable.dev/calendly/...
//      with headers:
//        Authorization: Bearer ${LOVABLE_API_KEY}
//        X-Connection-Api-Key: ${CALENDLY_API_KEY}
//    - HUBSPOT_API_KEY         → HubSpot connector (workspace-level).
//      Gateway base:
//        https://connector-gateway.lovable.dev/hubspot/...
//
// 2. Endpoints to call for automatic invite drops:
//    - Calendly (create single-use scheduling link scoped to a slot):
//        POST /scheduling_links
//        body: { max_event_count: 1, owner: <event_type_uri>, owner_type: "EventType" }
//      Then email the returned booking_url to the designer, prefilled with:
//        ?email=<designer_email>&name=<designer_name>&a1=<project_city>&timezone=<tz>
//    - HubSpot (log the scheduling activity + upsert contact):
//        POST /crm/v3/objects/contacts   (upsert by email)
//        POST /crm/v3/objects/meetings   (create meeting engagement)
//        POST /crm/v3/objects/notes      (attach project_city + local morning window)
//
// 3. Trigger:
//    Client fires this function from AIConcierge.tsx immediately after
//    `notify-escalation` succeeds with intent = "schedule_local_morning_call".
//    Payload: { project_city, local_tz, local_window: "09:00-11:00", contact_email }
//
// Until the connectors are linked, this function acknowledges the request
// so the client flow (badge → "Appointment Requested") remains reliable.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let payload: Record<string, unknown> = {};
  try { payload = await req.json(); } catch { /* no-op */ }

  const calendlyReady = !!Deno.env.get("CALENDLY_API_KEY");
  const hubspotReady = !!Deno.env.get("HUBSPOT_API_KEY");

  // TODO: when calendlyReady && hubspotReady, replace the stub below with the
  // gateway calls documented at the top of this file.
  console.log("[schedule-calendly-invite] placeholder invoked", {
    calendlyReady,
    hubspotReady,
    payload,
  });

  return new Response(
    JSON.stringify({
      status: "queued",
      integration: {
        calendly: calendlyReady ? "connected" : "pending",
        hubspot: hubspotReady ? "connected" : "pending",
      },
      note: "Placeholder — human curator will send the invite until Calendly + HubSpot are wired.",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
