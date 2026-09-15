# Desktop Designer Directory Bottom Dock

## Goal
Replace the desktop-only sidebar search with a persistent floating dock and make the existing designer directory rise from the bottom above it. Preserve the current mobile and tablet experience unchanged.

## Changes
- Remove the desktop Directory search field, count copy, and divider from the left designer column while keeping the featured designer lists aligned in place.
- Add a desktop-only bottom-center glass dock with two compact controls: `[ SEARCH DIRECTORY ]` and `[ A - Z ]`.
- Make `[ SEARCH DIRECTORY ]` open the panel with the search field focused; make `[ A - Z ]` open the same panel in alphabetical browsing mode with the horizontal alphabet bar visible.
- Reposition the desktop panel as a wide, header-aligned 4-column directory above the dock, with a capped height and internal scrolling.
- Animate the panel upward from below the viewport using the requested premium easing; reverse the motion on close.
- Keep the soft darkened 4px backdrop blur, body scroll lock, outside-click dismissal, close control, and Escape-key dismissal.
- Keep the dock visible and sharp above the blurred page while the directory is open.

## Responsive Boundary
- Apply the dock and bottom-up panel only at `min-width: 1024px`.
- Preserve the existing mobile/tablet Directory trigger, full-width sheet, two-column cards, touch scrolling, and safe-area behavior.

## Verification
- Desktop: verify the sidebar search is absent, dock remains bottom-centered, both controls open the correct state, the panel rests above the dock, four columns render, internal scrolling works, and outside click/close/Escape animate dismissal.
- Tablet and mobile: verify the existing trigger and two-column sheet remain unchanged.
- Run type-check and production build.
