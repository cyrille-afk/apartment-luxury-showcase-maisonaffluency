# Ambient-to-Catalogue Dropdown Transition

## What will change
- Add a distinct luxury interior photograph for each desktop room menu: Living, Dining, Bedroom, and Lighting.
- Show that photograph in the full right panel when the room menu first opens.
- Crossfade from the photograph to the relevant submenu whenever a left-column category or “Shop By Room” is hovered or focused.
- Reset to the photograph when the pointer leaves the left category list but remains inside the dropdown.

## Layout and interaction
- Preserve the existing anchored dropdown positions, two-column structure, taxonomy, navigation links, and top-baseline alignment.
- Give the dropdown a stable minimum height based on its category list so the photograph and text occupy the same fixed panel area without shifting.
- Keep both visual layers mounted and stacked in the right panel; only opacity and pointer access change during the 300ms transition.
- Keep keyboard focus behavior equivalent to hover, while pointer reset restores the photograph.

## Validation
- Check all four menus on desktop at the current preview width.
- Confirm initial photograph state, category crossfade, Shop By Room behavior, reset inside the dropdown, link navigation, no clipping, and no browser or build errors.

## Technical details
- Reuse suitable existing project photography rather than introducing external images.
- Implement the visual mapping and transition states in the existing navigation component using semantic design tokens and `transition-opacity duration-300`.
