Plan:

1. Fix the mobile Safari layout in `DesignersHoverHero.tsx`
- Keep the hero background tall enough to cover the full iOS toolbar-collapse range so no white strip can show.
- Stop anchoring the visible content to the `100lvh` bottom edge, because that is what pushes the directory/line under Safari’s bottom toolbar.
- Add a mobile “visible safe frame” for the text/list/directory so the designer list stays higher and the Directory row clears the iOS navigation bar.
- Raise the designer list slightly so the bottom names no longer sit behind or get crossed by the Directory line.
- Keep desktop unchanged.
- Keep the PWA branch separate so browser Safari and installed/PWA mode do not fight each other.

2. Preserve visual intent
- The hero image remains full bleed behind the iOS toolbar.
- The list remains in the same left editorial position.
- The Directory label and horizontal rule remain aligned together, but lifted enough to clear Safari’s bottom controls.

3. Verify after implementation
- Run a mobile viewport matrix for common iPhone sizes and Safari toolbar states:
  - iPhone SE
  - iPhone 12/13/14
  - iPhone 14/15 Pro
  - iPhone 14/15 Pro Max
  - toolbar visible / toolbar collapsed approximations
- For each case, check:
  - hero/background reaches the bottom of the viewport
  - no white pixels appear in the bottom strip
  - Directory/rule sits above the simulated iOS bottom toolbar zone
  - the last designer name is not crossed or hidden
- Capture screenshots and DOM measurements before reporting completion.