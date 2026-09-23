# Force square Curators’ Picks grids

## Change
- Update the actual public designer-profile Curators’ Picks card wrapper, which still applies desktop `3:4` or `4:3` aspect ratios, to a strict square at every viewport.
- Remove the mobile natural-height image path and the designer-specific portrait exception so every product image fills the same square wrapper with centered `object-cover` rendering.
- Apply the same forced square wrapper and full-cover image treatment to the standalone Curators’ Picks collection grid, where a separate `4:5` ratio remains.
- Set the relevant page frames to `max-w-6xl mx-auto` and keep consistent 24px mobile / 32px desktop grid spacing without changing card text or controls.

## Verification
- Inspect computed dimensions on a real public designer page and confirm every visible product image wrapper has equal width and height.
- Verify the standalone Curators’ Picks collection grid uses the same square geometry.
- Check desktop and mobile screenshots for centered crops and clean row flow.
- Run the focused TypeScript check.
