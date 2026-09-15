# Unified materials data and wide layouts

## Changes
- Make the user Material Library read active entries directly from the same `fabrics` collection managed by Admin Fabrics & Finishes.
- Map the shared fabric fields into the existing swatch presentation and Visualiser selection format, using supplier as the displayed maker and category as material type.
- Subscribe the Material Library to live fabric changes so admin additions, edits, activation changes, and removals refresh the grid immediately.
- Preserve circular swatches and expand the Material Library to a fluid large-screen width capped at 1800px.
- Use an adaptive desktop grid of `repeat(auto-fill, minmax(200px, 1fr))`, retaining practical smaller-screen columns.
- Remove the Admin Fabrics & Finishes width cap so its controls and tables use the full right-side workspace width.

## Verification
- Check type safety.
- Compare the active Material Library count against the active admin fabric count.
- Verify Material Library and admin widths, column count, circular swatches, and horizontal overflow at 1591px and 2560px.
