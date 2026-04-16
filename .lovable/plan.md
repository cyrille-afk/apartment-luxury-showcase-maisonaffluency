

## Problem

The description hover overlay on PickCard (in `DesignersDirectory.tsx`) uses a dark `bg-black/60` full-image overlay. The user wants it to match screenshot 1: a **white/cream floating card** positioned in the upper portion of the image, not a dark gradient covering the whole thing.

## Changes

### `src/components/DesignersDirectory.tsx` — PickCard description overlay

Replace the current dark overlay (lines ~862-867):
```
bg-black/60 inset-0 flex items-end
```

With a white/cream floating card matching the existing `ProductCardDescriptionOverlay` pattern:
- Positioned `left-3 right-3 top-12` (below the heart icon)
- `bg-background/90 backdrop-blur-sm rounded-lg shadow-lg` styling
- Dark text on light background
- `line-clamp-3` for truncation
- `pointer-events-none`, fades in on `group-hover`

This matches the exact pattern already used in `ProductCardDescriptionOverlay.tsx` and the user's screenshot 1.

No other files need changes. The PublicProductPage implementation (collapsible dropdown + hover overlay) is correct and separate from this issue.

