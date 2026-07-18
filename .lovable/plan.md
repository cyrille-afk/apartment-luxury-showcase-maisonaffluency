# CN Concierge — Phases 2 → 4

Builds bespoke Mandarin intake, curated response, and human hand-off on top of the existing `/concierge?lang=zh` flow.

## Phase 2 — Multimodal intake

**Frontend (`src/components/trade/AIConcierge.tsx`)**
- Add attach button (paperclip) next to the composer, active when `lang === "zh"` (and non-CN by default too — no reason to hide it).
- Accept: images (`image/*`), PDFs (`application/pdf`), audio recordings.
- Voice input: reuse Web Audio → WAV recorder pattern (per `ai-speech-to-text`). Small mic pill; on stop, POST to a new `concierge-transcribe-audio` edge function, insert the returned transcript into the composer for review, then send.
- Images/PDFs: attach as thumbnails in the composer; on send, upload to a private Supabase Storage bucket (`concierge-uploads`, 60s signed URLs), then include signed URLs in the user message payload sent to the concierge stream.

**Backend**
- New edge function `concierge-transcribe-audio` — proxies to Lovable AI `/v1/audio/transcriptions` with `openai/gpt-4o-mini-transcribe`, streams SSE back.
- Extend `concierge-stream` / `concierge-public-stream`: when the user message includes `attachments: [{ kind: "image"|"pdf", signed_url, mime }]`, forward them as chat-completions multimodal content blocks (`image_url` for images, `file` for PDFs). Prepend an "Intent Deciphering" system instruction to the CN prompt so Gemini extracts style, spatial constraints, lighting, aesthetic gaps into a structured JSON preamble before curating.

**Storage**
- New bucket `concierge-uploads` (private). RLS: authenticated users can insert into their own `{uid}/…` prefix; portal-session anon uploads go through a signed-upload URL minted by the edge function.

## Phase 3 — Curated Mandarin delivery

**Data model (single migration)**
- `trade_products` add:
  - `in_situ_sg boolean not null default false`
  - `available_from date null` (null = immediately available if `in_situ_sg`)
  - `provenance_cn text null` (Mandarin provenance snippet override)
  - `asia_lead_time_days int null` (override; falls back to global brand table)

**Frontend**
- New CN response card component `CnCuratedPacket.tsx` rendered inside the concierge message stream when the assistant returns a `<curated_packet>` JSON block.
- Card contents (Mandarin, editorial styling matching existing concierge cards):
  - Piece name, designer, provenance line
  - `即刻可提` badge when `in_situ_sg = true` (with `available_from` if set)
  - Localized Asia lead time
  - Climate/adaptability line (from `descriptor_taxonomy` or model-generated fallback)
  - CTA button: `预约新加坡第九区鉴赏` → opens the Phase-4 viewing modal

**Concierge prompt (CN)**
- Extend the Mandarin system prompt to instruct: after intent parsing, retrieve up to 6 curated picks from the existing catalog RAG, and emit them as `<curated_packet>{items:[...]}</curated_packet>` — one JSON tag the client parses and renders as the card. Text outside the tag stays conversational.

## Phase 4 — Hand-off

**Data model (same migration)**
- New table `cn_director_briefs`:
  - `session_id` (fk `portal_sessions.id`, nullable for authenticated users)
  - `user_id` (nullable)
  - `invited_name text`
  - `project_summary text`, `aesthetic text`, `budget_band text`, `sentiment text`
  - `pieces_of_interest jsonb` (array of `{product_id, name, reason}`)
  - `viewing_requested_at timestamptz null`
  - `status text` default `'new'` — `new | contacted | booked | closed`
  - `admin_notes text`
  - standard timestamps

**Trigger logic (in `concierge-stream`)**
- After each assistant turn on `lang=zh`, run a lightweight "intent classifier" pass (Gemini flash, JSON output): does the user express deep interest / viewing intent / concrete project spec?
- If yes AND no brief exists for this session in the last 24h, insert a row into `cn_director_briefs` with the model's structured summary, then invoke `send-transactional-email` with a new template `cn-director-brief` to the concierge inbox (configured via `CN_DIRECTOR_EMAIL` secret).

**Viewing CTA**
- Clicking the `预约新加坡第九区鉴赏` button opens a small modal: prefilled name/date-range, "白手套专车 24小时" copy. Submit sets `viewing_requested_at` on the latest brief row (or creates one) and re-fires the email with subject prefixed `[VIEWING REQUEST]`.

**Admin surface (`/trade/admin/cn-briefs`)**
- New page: split view (list + detail) styled like `/trade/admin/collector-applications`.
- List: status pill, invited name, updated_at, viewing badge.
- Detail: full brief JSON pretty-printed, pieces of interest as product cards linking to the trade product page, status dropdown, notes textarea, "Reply via email" mailto shortcut.
- RLS: admins/super_admins only.
- Add a nav link on `/trade/admin/portal-invites` page header.

## Rollout order

1. Migration (schema + bucket + RLS).
2. Edge functions (transcribe, extend stream, brief insert + email).
3. `send-transactional-email` template `cn-director-brief`.
4. Frontend concierge: attach + voice + curated card + viewing modal.
5. Admin page + nav link.
6. Verify end-to-end via `?lang=zh&preview=1` flow, then via a real portal invite redemption.

## Technical notes (not user-facing)

- Keep everything additive — no changes to existing EN concierge behavior, no changes to `AIConcierge.tsx` public API.
- All model calls go through Lovable AI Gateway (`google/gemini-3-flash-preview` for chat + JSON intent classifier; `google/gemini-2.5-pro` only if the flash preview refuses images with spatial constraints — fall back on 400).
- Voice STT uses `openai/gpt-4o-mini-transcribe` with `stream: "true"`.
- PDF/image size caps: 8MB image, 15MB PDF, 5MB audio (WAV, 16kHz mono).
- Reuse `concierge_rate_limits` for anon-session throttling on the transcribe endpoint.
- No changes to `src/integrations/supabase/client.ts`.
