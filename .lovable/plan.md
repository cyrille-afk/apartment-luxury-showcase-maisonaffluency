# Unify Curators’ Picks Product Grid

## Implementation
- Replace variable product-image sizing with one fixed portrait 4:5 frame and consistent desktop height.
- Use the warm product-canvas token across every frame and center all primary and alternate images with `object-contain`.
- Keep each card as a fixed vertical stack with reserved brand, title, and price rows so every caption aligns horizontally.
- Preserve grid toggles, product links, badges, alternate-image interaction, and mobile usability.

## Verification
- Check the Jean-Michel Frank grid at desktop width for identical frame sizes and aligned captions.
- Confirm wide sofas, tables, chairs, and tall lamps remain fully visible without cropping.
- Check mobile for overflow or broken card proportions.
- Run the TypeScript check.
