# Expand the editorial gallery grid

## Scope
- Set the gallery’s initial desktop layout to three columns while retaining the existing one-, three-, and four-column controls.
- Replace the current constrained `max-w-7xl` gallery wrapper with the same wide horizontal boundary used by the expanded desktop header.
- Apply that shared width to the introductory title/control row, gallery grids, and related gallery content so they align as one composition.
- Keep mobile behavior unchanged.

## Implementation
- Update the gallery column state default from four to three.
- Use a full-width desktop wrapper with matching outer gutters rather than a narrow fixed maximum width.
- Preserve the existing responsive three-column grid and 4:5 image proportions so cards grow fluidly at wider viewport sizes.
- Keep all toggle behavior intact, including switching to the single-image and four-column views.

## Verification
- Open the gallery at desktop width and confirm it initially renders three large cards across.
- Compare the gallery’s left and right boundaries with the expanded header.
- Exercise both grid controls and confirm one-, three-, and four-column views switch without layout breakage.
- Confirm the mobile gallery remains unchanged and check the latest preview build result.
