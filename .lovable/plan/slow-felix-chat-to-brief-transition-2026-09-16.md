# Slow Felix Chat-to-Brief Transition

## Goal
Make Felix’s project-scale intake feel deliberate: show a short thinking state, reveal Felix’s response gently, then open the clean Brief Builder automatically.

## Changes
- Keep the submitted user message visible immediately and show Felix’s existing typing indicator for about 1.8 seconds.
- Reveal Felix’s structured-brief response and its manual “Open Architectural Brief” fallback with a 500ms eased fade/raise animation.
- Wait another 1 second, then automatically preload and open the Brief Builder.
- Animate the chat history upward and out before switching views; bring the active-context row and Brief Builder upward from below.
- Keep the utility actions and message controls docked at the bottom throughout.
- Cancel pending timers safely if the panel closes, resets, changes conversation, or unmounts, and respect reduced-motion preferences.

## Verification
- Run the TypeScript check.
- Use the live preview to submit the GCB living/dining request and confirm timing, indicator, response reveal, automatic opening, clean history removal, and anchored controls.
