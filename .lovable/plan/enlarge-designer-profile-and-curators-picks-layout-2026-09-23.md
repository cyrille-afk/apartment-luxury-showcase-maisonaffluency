# Enlarge designer profile and Curators’ Picks layout

## Changes
- Widen the public desktop navigation frame and designer-profile content frame to the same `1380px` maximum width while preserving centered `px-6` spacing.
- Keep the desktop navigation distributed edge-to-edge with its existing balanced `justify-between` structure.
- Let the three-column Curators’ Picks grids fill the wider frame, retaining strict square image cells and a desktop `gap-8`.
- Apply the same width to the standalone Curators’ Picks collection frame for consistent presentation.

## Verification
- Confirm the desktop header and designer content share the same computed outer width.
- Confirm three-column Curators’ Picks cards remain square and visibly enlarge.
- Check mobile remains unchanged and run the focused TypeScript check.
