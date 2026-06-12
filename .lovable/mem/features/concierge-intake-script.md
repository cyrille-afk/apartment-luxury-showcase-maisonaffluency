---
name: Concierge Elite Intake Script
description: Public/trade AI concierge greeting, invisible qualifier, lead capture, and turn 2+ profile injection
type: feature
---

# Concierge Elite Intake

## Greeting (public surface `/concierge`)
`PUBLIC_GREETING` in `src/components/trade/conciergeGreeting.ts`:
> "Welcome to the Gallery. I am your private concierge. I can instantly source exceptional artisan objects, calculate global white-glove shipping, and unlock private pricing. May I have your name and city?"

Trade surface uses the existing `greetingForContext(...)` based on stage/tone/lang.

## Invisible qualifier (turn 1)
On the first user message, `AIConcierge.tsx` fires `concierge-capture` edge function with `{ surface, session_id, first_message, path, referrer }`. The function:
- runs heuristic + Gemini 3 Flash extraction → `{ name, city, country, intent, signals[], qualified_score }`
- writes a row to `public.concierge_leads` (RLS: anon INSERT, admin SELECT)
- emails `concierge@myaffluency.com` when `qualified_score >= 60` or `signals` contains `high_value_location`
- dedupes by `session_id` within 24h

The profile JSON is stored client-side in `sessionStorage["concierge:profile"]`.

## Turn 2+ adaptation
`AIConcierge.tsx` reads `concierge:profile` from sessionStorage and prepends `qualifierSystemNote(...)` (from `conciergeGreeting.ts`) as an internal `user` message before the chat history. The model adapts tone (high-value city → elevated specificity, name-drop relevant designers, reference white-glove from Europe) without ever revealing the profile or re-asking qualifying questions.

## Public streaming endpoint
- Anon visitors stream through `supabase/functions/concierge-public-stream/index.ts` (NOT `trade-concierge`).
- No catalog tools, RAG, or user-scoped data — text-only conversational reply.
- Rate limits: 60 req/hr per IP + 15 req/hr per `x-concierge-sid`. Returns 429 with `retry_in` seconds.
- Trade (authenticated) surface continues to use `trade-concierge` with its existing per-user 20/min limit and daily token cap.

## Admin
`/trade/admin/concierge-leads` (`TradeAdminConciergeLeads.tsx`) — admin-only browse/filter of captured leads.

## High-value locations
Defined in `concierge-capture/index.ts` (`HIGH_VALUE_AREAS`): Mayfair, Belgravia, Knightsbridge, UES, Tribeca, Hamptons, Paris 7e/8e/16e, Monaco, Sentosa Cove, Districts 9/10/11 (SG), Hong Kong Peak, Dubai Palm/Emirates Hills, Bel Air, Beverly Hills, Aspen, Palm Beach, etc.
