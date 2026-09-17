# Felix onboarding sequence lock

## Changes
- Introduce a single explicit onboarding gate with three required facts: Project Profile, Zone, and Budget. A fact counts only when it contains a real value, not a placeholder.
- Add Budget to the Architectural Brief Builder and require Project Profile, Zone, and Budget before submission. Record successful manual submission as the only Brief Builder completion signal.
- Keep conversational onboarding in Discover until the same three facts are captured and confirmed in sequence; procurement vocabulary such as “FF&E”, “sourcing”, or “working on” cannot advance the stage by itself.
- Detect high-level visual-direction statements before any proposal logic. For the Art Deco prewar co-op pattern, preserve the style DNA and return the specified Budget-and-Zoning follow-up instead of sourcing products.
- Send the verified gate state with each Felix request and enforce it again in the concierge function. Until the gate is complete, remove quote/tearsheet/FF&E tools and reject any proposal tool output before it reaches the browser.
- Gate the Felix header stage independently from the current page route: show Discover during incomplete onboarding, even while the user is viewing a quote page.
- Keep quote, FF&E, and product proposal cards completely unmounted while onboarding is incomplete; discard stale proposal timeline entries when loading an incomplete onboarding thread.
- Preserve existing quote pages and approved procurement workflows once the gate has been cleared.

## Technical details
- Add a typed brief-gate parser shared by the Brief Builder and Felix client, with explicit Project Profile, Zone, Budget, and completion status.
- Persist completion per Felix conversation/thread rather than globally, preventing one completed brief from unlocking a new conversation.
- Treat only an explicit valid Brief Builder submission or a deterministic sequential-confirmation state as completion; model prose cannot self-assert completion.
- Replace the conflicting prompt rules that currently say the Brief Builder “must never become a gate” and that three arbitrary sticky facts should immediately source pieces.
- Add defense in depth at three points: request construction, server tool allow-list/stream proposal filtering, and React rendering.

## Verification
- Add focused tests for brief parsing, placeholder rejection, high-level vision routing, and blocked quote/FF&E proposal tools.
- Verify the supplied scenario stays in Discover, renders only conversation bubbles, and returns the exact Art Deco Budget-and-Zoning follow-up.
- Verify “FF&E”, “sourcing”, and “working on” cannot mount a proposal table before completion.
- Verify a valid manual brief submission unlocks the next stage and proposal UI, while a new thread starts locked.
- Run the TypeScript check and the relevant Felix tests, deploy the updated concierge function, then validate the live interaction in the preview.
