# Align room dropdown columns

## Changes
- Replace the current offset-based dropdown grids with two direct flex sibling panels: categories on the left and subcategories on the right.
- Give both panels identical top and bottom padding so their first text baselines align.
- Keep the right panel empty until a category is hovered or focused, then render its content from the fixed top baseline.
- Add a slightly emphasized contextual heading at the top of every revealed submenu, followed by the existing destination links.
- Let dropdown height follow the taller column so all links remain inside the white panel without clipping.
- Preserve the current room navigation order, links, styling, and hover-close behavior.

## Verification
- Check Living, Dining, Bedroom, and Lighting in the desktop preview.
- Confirm each menu opens with an empty right panel, then aligns its submenu heading with the first left-column row after hover.
- Confirm long submenu lists remain enclosed and no build or browser errors occur.
