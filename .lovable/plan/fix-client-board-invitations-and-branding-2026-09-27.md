# Fix Client Board Invitations and Branding

## Outcome
Client invitations will name the project, open a working board, and use the inviting studio’s identity by default. Maison Affluency branding remains an explicit toggle.

## Changes
1. **Invitation content**
   - Resolve the board’s linked project and show its name prominently in the email subject and body.
   - Use the board title as the curated selection name beneath the project.
   - Render the studio logo and studio name by default when available; show Maison Affluency only when the board’s branding toggle permits it.

2. **Branding defaults and controls**
   - New boards inherit the current studio name and logo and default to hiding Maison Affluency branding.
   - Existing boards continue to expose the Client Portal Branding switch, with clearer wording that directly controls Maison Affluency visibility.
   - Apply the same branding choice to both invite emails and the shared client board.

3. **Reliable Open the Board link**
   - Keep links on the canonical production domain.
   - Harden the shared-board loader so database errors do not appear as an empty page.
   - Verify a fresh token from invite creation against the public route, then revoke the temporary verification invite.

## Technical details
- Extend the token-gated shared-board response with project name and branding flags only; no internal pricing or logistics data is added.
- Extend the secured email lookup to join the project and studio, rebuilding all email content server-side.
- Update the email template to conditionally render studio or Maison Affluency branding.
- Preserve hashed invite tokens and the existing 30-day expiry.

## Verification
- Confirm email rendering includes “Singapore GCB workflow” and the board title.
- Confirm studio-first branding and the Maison Affluency toggle in both the email and public board.
- Create a temporary invite, open its exact public URL signed out, confirm products load, then revoke it.
