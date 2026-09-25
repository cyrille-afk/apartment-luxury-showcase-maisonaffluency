# Fix Room Dropdown Hover Persistence

## Goal
Keep the selected subcategory panel visible while the pointer moves anywhere inside the open room dropdown, without flashing the ambient image.

## Changes
- Remove row-level mouse-leave resets from all LIVING, DINING, BEDROOM, and LIGHTING category triggers.
- Treat each dropdown’s two-column wrapper as one continuous hover region with touching sibling hitboxes and spacing supplied only by internal padding.
- Reset to the ambient image only when the pointer leaves the complete dropdown panel, while preserving the existing delayed menu close behavior.
- Keep keyboard focus behavior, category switching, ambient fades, and navigation unchanged.

## Verification
- Move the pointer repeatedly from every left-column category across the divider into the right panel and confirm the text remains visible.
- Move between left-column rows and confirm the submenu updates without flashing.
- Leave the complete dropdown and reopen it to confirm the ambient image returns as the default.
- Check all four room menus and confirm the preview remains error-free.
