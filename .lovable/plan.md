
What I found

- The queue is not actually “stalling” because the worker is frozen. It is repeatedly waking up, reading the same bad email jobs, failing, and shutting down.
- The backend logs show the real failure:
  - `Email API error: 400`
  - `Missing run_id or idempotency_key`
- This means the queue processor is trying to send transactional emails whose payloads are incomplete.

Why this keeps happening

- `process-email-queue` expects each transactional email job to include a consistent payload, especially:
  - `message_id`
  - `idempotency_key` or `run_id`
  - `from`
  - `sender_domain`
  - `purpose`
  - `label`
  - `queued_at`
- Several email-producing functions do not enqueue that full shape. The ones I found are:
  - `supabase/functions/notify-3d-upload/index.ts`
  - `supabase/functions/scrape-competitors/index.ts`
  - `supabase/functions/send-weekly-digest/index.ts`
  - `supabase/functions/send-axo-status-notification/index.ts`
- Two of those paths appear to omit even `message_id`, which is worse: the retry-budget logic in `process-email-queue` cannot properly count failed attempts, so those jobs can loop forever.
- That is likely why you see “failed to unpause queue”: the system resumes processing, immediately hits the same poison messages, and falls back into error again.

Implementation plan

1. Standardize queued email payloads
- Update every enqueueing function so transactional emails always include the same required fields:
  - `to`
  - `from`
  - `sender_domain`
  - `subject`
  - `html` and/or `text`
  - `purpose: 'transactional'`
  - `label`
  - `message_id`
  - `idempotency_key`
  - `queued_at`

2. Harden the queue processor
- Add explicit payload validation at the top of `process-email-queue`.
- If a queued message is missing required fields, do not retry it.
- Move invalid messages straight to the dead-letter queue with a clear reason like:
  - `Invalid payload: missing idempotency_key`
  - `Invalid payload: missing message_id`

3. Clean up the currently poisoned queue
- Identify the already-enqueued invalid jobs in `transactional_emails`.
- Move or purge those bad jobs so the queue can recover instead of re-reading them forever.

4. Improve error visibility
- Replace the vague failure path with better logging around:
  - which function created the bad payload
  - which required fields are missing
- If there is a UI/admin status surface for this queue, show the actual last error instead of only “failed to unpause queue”.

5. Verify end to end
- Trigger each affected workflow:
  - 3D upload notification
  - competitor scrape summary
  - weekly digest
  - axonometric status notification
- Confirm queued emails move from `pending` to `sent`
- Confirm invalid legacy jobs no longer retry forever
- Confirm the processor logs stop showing repeated 400s

Technical details

- Primary file to fix: `supabase/functions/process-email-queue/index.ts`
- Secondary files to fix:
  - `supabase/functions/notify-3d-upload/index.ts`
  - `supabase/functions/scrape-competitors/index.ts`
  - `supabase/functions/send-weekly-digest/index.ts`
  - `supabase/functions/send-axo-status-notification/index.ts`
- Most likely no schema change is required unless we choose to add a stronger audit field for source function / queue error classification.

Expected outcome

- The queue will stop reprocessing malformed jobs forever.
- New emails will enqueue with the correct payload shape.
- “Failed to unpause queue” should disappear because the underlying poison-message loop will be removed.
