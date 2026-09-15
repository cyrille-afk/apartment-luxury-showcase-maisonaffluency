# Resources desktop layout and breadcrumb

## Changes
- Expand the Resources workspace at 1440px and above to a fluid 90vw-equivalent content width, capped at 1800px within the Trade Portal workspace.
- Replace the fixed document card columns with an adaptive grid using `repeat(auto-fill, minmax(320px, 1fr))` on desktop, while preserving the compact mobile layout.
- Add a tracked uppercase breadcrumb above the Resources banner: `TOOLS / RESOURCES`.
- When a brand folder is selected, append its name to the breadcrumb, for example `TOOLS / RESOURCES / ALEXANDER LAMONT`.
- Make `TOOLS` navigate to the Tools dashboard and `RESOURCES` clear the active folder and return to the Resources root without using the sidebar.
- Keep the selected folder reflected in the existing URL query so direct links and browser navigation remain coherent.

## Verification
- Check type safety.
- Verify the root and selected-folder states in the live desktop preview at 1591px and 2560px widths.
- Confirm the wide grid reaches four or five columns where the available workspace permits, and both breadcrumb return links work.
