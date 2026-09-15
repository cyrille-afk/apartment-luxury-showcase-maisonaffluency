# Specification workspace large-screen refactor

## Changes
- Expand Mood Board Builder, Markup & Annotation, and Tearsheet Builder at 1440px and above to a fluid 90%-viewport workspace capped at 1800px, while preserving their current smaller-screen behavior.
- Add a shared tracked uppercase local breadcrumb above each page title: `TOOLS / [TOOL NAME]`, with `TOOLS` linking to the Tools dashboard.
- Rebalance Mood Board Builder into a wider primary collage canvas and a restrained product rail on large screens; increase usable canvas depth without overwhelming the sourcing controls.
- Scale Markup & Annotation’s upload and product-photo drop zones across the available width and give them proportionally greater height on large screens; preserve the annotation editor’s side panel once an image is selected.
- Let Tearsheet Builder’s product selection grid and generated technical sheet use the wider workspace, with adaptive columns and roomier specification/finish/description layouts to reduce truncation.
- Record the completed workspace refactor in the project roadmap.

## Verification
- Check type safety.
- Verify all three routes at 1591px and 2560px widths.
- Confirm each workspace reaches the intended large-screen width, its internal proportions adapt correctly, and the `TOOLS` breadcrumb returns to `/trade/tools`.
