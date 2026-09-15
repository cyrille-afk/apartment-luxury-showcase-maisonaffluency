# Product Comparator Large-Screen Refactor

## Scope
- Add a compact editorial breadcrumb above the page title: `TOOLS / PRODUCT COMPARATOR`, with `TOOLS` linking to `/trade/tools`.
- Expand the comparator workspace at 1440px and above to a fluid wide layout capped at 1800px, while preserving current smaller-screen behavior.
- Move the favourites search and selected-product controls into a stable top selection strip so adding products does not shift the comparison area vertically.
- Place the comparison matrix immediately below that strip and distribute one to four selected products evenly across the available width.
- Keep product selection accessible in the top section, with chosen products represented as removable chips and the favourites results contained in a fixed-height area.
- Record the completed change in the project roadmap.

## Technical details
- Reuse the shared compact `Breadcrumbs` component already used by the other Tools workspaces.
- Use a large-screen wrapper equivalent to 90% viewport width with an 1800px maximum.
- Give the matrix a fixed specification-label column and equal `minmax(0, 1fr)` product columns, retaining horizontal overflow as a narrow-screen fallback.
- Preserve the existing four-product limit, favourite-only source, price visibility mode, and add/remove behavior.

## Verification
- Run the TypeScript check.
- Verify `/trade/comparator` at 1591px and 2560px with Playwright: breadcrumb navigation, wrapper width, stable selection/matrix order, and symmetric one-to-four product columns.
