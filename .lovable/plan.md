# Expandable Desktop Designer Search

## Goal
Turn the desktop designer search into one continuous interaction: the existing left-side trigger expands into a centered search bar, then reveals the centered A–Z navigation and four-column directory below it. Mobile and tablet behavior stays unchanged.

## Changes
- Keep the closed search control in its current left-column position and dimensions.
- On click or focus, measure the trigger’s desktop position and animate a fixed search surface from that exact rectangle into the centered header-width layout.
- Use the requested `all 0.4s cubic-bezier(0.25, 1, 0.5, 1)` transition for position, width, and supporting visual properties.
- Reveal the horizontal alphabet row and four-column designer grid after the search bar begins expanding, centered directly beneath it.
- Preserve the current two-row visible card area, internal overflow scrolling, body scroll lock, backdrop blur, and responsive card proportions.
- On close, Escape, or backdrop click, reverse the animation back to the original trigger rectangle before unmounting the expanded directory.
- Keep the existing mobile/tablet sheet and two-column directory unchanged below 1024px.

## Technical details
- Add a short closing phase so the reverse transition remains visible instead of unmounting immediately.
- Recalculate the trigger rectangle on desktop resize and use a centered maximum width matching the site header container.
- Keep focus management accessible: focus enters the expanded input, Escape dismisses, and focus returns to the original trigger.
- Verify opening, searching, alphabet filtering, internal scrolling, backdrop dismissal, close-button dismissal, and the reverse animation at desktop widths; confirm no visual regression below 1024px.
