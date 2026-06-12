# Elite Concierge: Greeting + Invisible Qualifier + Lead Capture

## 1. New greeting (public + trade)

Replace the current "Allow me to help you discover…" opener with the elite intake script, adapted per surface:

**Public (`/concierge` — new AI chat surface, see §2):**
> "Welcome to the Gallery. I am your private concierge. I can instantly source exceptional artisan objects, calculate global white-glove shipping, and unlock private pricing. May I have your name and city?"

**Trade (`AIConcierge.tsx`, Discover intent only):**
> "Welcome back{, [first name]}. Your private concierge — I can source exceptional pieces, calculate global white-glove shipping, and apply your trade pricing in real time. To tailor results, what city is this project in?"

Other intents (mood / tearsheet / quote / order / project) keep their existing greetings — they already have context, no intake needed.

## 2. Public concierge becomes a real AI chat

Today `/concierge` is just a prefilled contact form. Replace the body with the AI chat (reusing `AIConcierge.tsx` under the hood, public mode flag) so the elite greeting + qualifier actually run. The existing contact form stays as a fallback link ("Prefer email? Send a written brief →").

## 3. Invisible qualifier (intent tagging)

After the user's first reply, a lightweight server-side extraction call (Lovable AI Gateway, `google/gemini-3-flash-preview`, JSON output) parses:
- `name` (string, optional)
- `city` (string, optional)
- `country` (string, optional, inferred from city)
- `intent` (one of: `sourcing`, `bespoke`, `project_ffe`, `general`)
- `signals` (array: `high_value_location`, `named_designer`, `room_type:<x>`, `budget_hint`)
- `qualified_score` (0–100, heuristic)

High-value locations (hardcoded list: London Mayfair/Belgravia/Knightsbridge/Kensington/Chelsea, NYC UES/UWS/Tribeca/SoHo, Paris 7e/8e/16e, Monaco, Singapore Districts 9/10/11, Hong Kong Peak/Mid-Levels, Dubai Palm/Emirates Hills, LA Bel Air/Beverly Hills, Miami, Aspen) auto-flag `high_value_location`.

Result is stored in the session and injected as a system note for subsequent turns so the model can adapt tone/proposals without the user seeing the qualifier.

## 4. Lead capture (DB)

New table `public.concierge_leads`:
- `id`, `created_at`, `updated_at`
- `surface` ('public' | 'trade')
- `user_id` (nullable — anon public visitors have none)
- `session_id` (text, client-generated UUID stored in sessionStorage)
- `name`, `city`, `country` (text)
- `first_message` (text)
- `intent`, `signals` (jsonb), `qualified_score` (int)
- `path` (text — where they started)
- `user_agent`, `referrer`
- RLS: anon INSERT allowed; SELECT admin-only

Inserted by a new edge function `concierge-lead-capture` (service role, validates payload, dedupes by session_id within 24h).

## 5. Email notification to gallery inbox

Same edge function: after insert, if `qualified_score >= 60` or `high_value_location` is set, send a branded HTML email (Resend, existing infra) to the gallery inbox with name, city, intent, signals, first message, and a deep link to the lead row in admin.

## 6. Admin view

Minimal admin page `/trade/admin/concierge-leads` (admin role gate) listing leads with filters by surface / qualified_score / city. Reuses existing admin table styling.

## Technical notes

- **Files touched**:
  - `src/components/trade/conciergeGreeting.ts` — new opener strings for `discover` intent across all four tones; add `publicDiscover` variant.
  - `src/components/trade/AIConcierge.tsx` — accept `surface: 'public' | 'trade'` prop; on first user message, fire qualifier + lead-capture; render greeting accordingly.
  - `src/pages/ConciergePage.tsx` — replace ContactInquiry with `<AIConcierge surface="public" />` (keep contact form behind a collapsed "Prefer email?" link).
  - New: `supabase/functions/concierge-lead-capture/index.ts`
  - New: `supabase/functions/concierge-qualify/index.ts` (Gemini Flash JSON extract)
  - New migration: `concierge_leads` table + RLS + grants
  - New: `src/pages/TradeAdminConciergeLeads.tsx` + route
- **No changes** to trade-concierge streaming endpoint, RAG, or tearsheet logic.
- **Memory**: add `mem://features/elite-concierge-intake` documenting greeting script + qualifier rules.

## Risk

- AIConcierge is 1,204 lines and central to trade UX. I will only add a `surface` prop + first-message hook, not refactor.
- Qualifier call adds ~300ms to first turn; fired async, non-blocking on the streaming reply.
- Public AI chat is anon — credits could be abused. Add per-session-id rate limit (10 messages / hour) in the streaming endpoint when `surface=public`.
