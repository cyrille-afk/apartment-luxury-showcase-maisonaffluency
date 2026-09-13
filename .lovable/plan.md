# Expand the mobile purchasing intent sheet

## Outcome
- Open the three-step purchasing funnel directly below the mobile navigation and use the full remaining visible height.
- Keep the product preview, question, both profile choices, and Next button fully visible and naturally scrollable.
- Preserve the existing step array, profile state, validation, and transition functions.

## Implementation
1. Replace the mobile bottom-sheet geometry and `max-h` constraint with a fixed full-width panel using the navigation-height offset and `100dvh`.
2. Give the panel one natural vertical scroll flow with `px-6 py-4`, while keeping the action button reachable with safe-area spacing.
3. Keep the existing centered desktop presentation unchanged through desktop-only overrides.
4. Verify at 295×640 and 390×844 that both profile choices and the enabled Next action are fully accessible, then advance through all three steps.

## Technical details
- Reuse the existing `--header-h` navigation token rather than hardcoding a second header measurement.
- Do not modify `STEPS`, `canAdvance`, `chooseProfile`, or `next()`.
