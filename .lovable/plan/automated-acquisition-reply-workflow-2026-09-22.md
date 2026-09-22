# Automated acquisition reply workflow

## Goal
Turn a verified positive reply to an acquisition email into a tracked interested lead, send that studio its private portal link once, and show the change immediately in Acquisitions.

## Build
1. **Track the full reply lifecycle**
   - Extend acquisition leads with canonical reply/activation timestamps, inbound sender/thread identifiers, the outbound provider message identifier, and the key-delivery result.
   - Add a private webhook-event ledger with unique provider event IDs so duplicate deliveries cannot trigger duplicate emails.
   - Keep existing records compatible while displaying the requested states as `OUTBOUND_SENT`, `REPLIED_INTERESTED`, and `PORTAL_ACTIVATED`.

2. **Secure Resend inbound listener**
   - Add a public Edge Function endpoint for Resend inbound webhooks.
   - Verify Resend’s webhook signature against a server-only signing secret before reading or changing data.
   - Validate event shape and size, ignore unsupported events, deduplicate retries, and preserve a minimal audit record without exposing email bodies in the dashboard.
   - Match a studio first from trusted reply/thread metadata and then from a normalized sender address among the actual outbound recipients. Ambiguous matches will be logged for review, never guessed.

3. **Positive-intent detection and one-time follow-up**
   - Extract the plain-text reply and classify short affirmative responses with a conservative anchored phrase matcher (`yes`, `sure`, `please do`, `send it over`, `sounds good`, and close punctuation/signature variants).
   - Do not treat quoted copies of the original invitation as a positive reply; uncertain or negative replies remain unactivated.
   - Atomically claim the lead, move it to `REPLIED_INTERESTED`, and enqueue the requested high-touch response through the existing resilient email queue.
   - Send one portal URL in the form `/trade/activate?token=<private-token>&studio=<studio-slug>`. Repeated webhook deliveries cannot send it twice.
   - Move the lead to `PORTAL_ACTIVATED` only after key delivery succeeds; retain `REPLIED_INTERESTED` plus an error for failed delivery so it can be retried safely.

4. **Outbound correlation**
   - Add lead metadata to each acquisition send and store the recipient addresses used.
   - Preserve the current acquisition letter and button behavior while making future replies reliably attributable by thread metadata or sender address.

5. **Live dashboard feedback**
   - Subscribe the Acquisitions screen to acquisition-lead changes through the existing single realtime connection instead of adding another channel or polling loop.
   - Show distinct interested and activated badges, reply/key-delivery timestamps, and a restrained pulse only for a newly completed automatic activation.

6. **Verification and setup**
   - Add tests for signature rejection, duplicate events, ambiguous senders, quoted-text false positives, accepted affirmative phrases, and one-time key delivery.
   - Deploy and probe the listener with invalid and valid signed fixtures.
   - Register the deployed endpoint for Resend inbound events and save its webhook signing secret securely. If Resend requires receiving-domain DNS confirmation, surface that single external setup step rather than weakening verification.

## Technical details
- Database writes use service-role access inside the verified webhook only; no browser can mutate reply states.
- New public-schema tables receive explicit grants, RLS, service-role policies, and indexes in the same migration.
- The existing activation endpoint remains responsible for provisioning the trade account. Successful portal use stamps the final activation timestamp without sending another key email.
- No LLM is needed for the requested examples; conservative deterministic parsing is faster, cheaper, auditable, and avoids accidental activation.
