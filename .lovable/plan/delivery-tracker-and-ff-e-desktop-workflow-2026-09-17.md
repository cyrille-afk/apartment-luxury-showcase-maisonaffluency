# Delivery Tracker and FF&E Desktop Workflow

## Changes
- Expand Delivery Tracker and FF&E Schedule into fluid large-screen workspaces capped at 1800px, while preserving compact mobile behavior.
- Replace wide fixed-content tables with constrained, adaptive column layouts that fit standard desktop widths without page-level horizontal scrolling.
- Convert Delivery Tracker’s “Set on FF&E” and quote references into compact actions that open a right-side quote drawer instead of navigating away.
- Show the selected line’s quote reference, client/project context, product details, PO and cost-code fields, quantity, lead time, delivery deadline, and status inside the drawer.
- Save editable line-item configuration directly from the drawer and refresh both Delivery Tracker and FF&E Schedule data after changes.
- Use the same drawer interaction for quote references on the FF&E Schedule, keeping users in context.
- Dim and blur the background while the drawer is open so the focused quote workspace is visually isolated.

## Technical details
- Reuse the existing Sheet component and semantic design tokens.
- Keep tables inside `min-w-0` containers, use fixed table layout with intentional width allocation, wrap long labels, and collapse lower-priority columns at narrower desktop breakpoints.
- Preserve existing quote, delivery, pricing, export, project-filter, and deadline calculations.

## Verification
- Run the TypeScript check.
- Verify both pages at standard and wide desktop widths with Playwright.
- Confirm there is no page-level horizontal overflow, both actions open the correct line-item drawer, edits persist, and the background dim/blur clears when closed.
