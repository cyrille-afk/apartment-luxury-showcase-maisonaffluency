

## Problem

The description hover tooltip on trade gallery grid cards is not appearing on hover, despite descriptions being correctly saved and displayed in the lightbox. Two issues identified:

1. **Stacking context conflict**: The hover image uses `transform` (via `scale-105 group-hover:scale-100`), which creates a new stacking context that can visually overlay the tooltip despite the tooltip having `z-10`.

2. **Overflow clipping**: The tooltip sits inside a container with `overflow-hidden`, which can clip the tooltip if it extends beyond the card boundaries.

## Fix

### Files to edit

**`src/pages/TradeGallery.tsx`** (grid card tooltip)
- Move the description tooltip **outside** the `overflow-hidden` image container, or increase z-index and ensure the hover image has a lower explicit z-index
- Give the hover image `z-0` explicitly so the tooltip at `z-10` renders above it reliably

**`src/components/trade/ShowroomGridView.tsx`** (same pattern)
- Apply the same fix for consistency

### Specific changes

In both files, add explicit `z-0` to the hover image element so the tooltip's `z-10` is respected regardless of transform-induced stacking contexts. This is a minimal, targeted fix that avoids layout restructuring.

