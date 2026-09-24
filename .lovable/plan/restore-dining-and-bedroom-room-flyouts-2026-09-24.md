# Restore Dining and Bedroom room flyouts

## Changes
- Add explicit room-flyout data for DINING → Dining and BEDROOM → Bedroom.
- Render “Shop By Room” as the final left-column row for both dropdowns, matching LIVING’s height, arrow, active styling, and divider structure.
- Reveal the matching single link in the right panel only while “Shop By Room” is active.
- Keep the right panel aligned to the dropdown’s top baseline and preserve all existing category flyouts.

## Verification
- Confirm DINING and BEDROOM each show “Shop By Room” at the bottom.
- Hover each row and confirm only Dining or Bedroom appears in the right panel.
- Click each link and confirm it opens the matching room search.
- Check the preview build is clean.
