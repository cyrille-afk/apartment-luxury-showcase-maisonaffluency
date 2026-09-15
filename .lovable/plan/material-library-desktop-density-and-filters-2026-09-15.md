# Material Library desktop density and filters

## Changes
- Add low-contrast `All Suppliers` and `All Designers` dropdowns beside the existing category controls.
- Derive supplier choices from the same active `fabrics` records used by Admin Fabrics & Finishes.
- Reuse the Admin relationship chain (`product_fabrics` → `designer_curator_picks` → `designers`) so designer options and material filtering match the admin table.
- Keep search, category, supplier, and designer filters combinable, and refresh their source data when linked fabric data changes.
- Use exactly five equal columns from 1024px and six equal columns from 1440px, while preserving the compact mobile grid and circular swatches.
- Widen the desktop workspace within the Trade shell while retaining at least 80px separation from the persistent sidebar.
- Record the completed refactor in the project roadmap.

## Verification
- Run type safety checks.
- Verify at 1024px, 1591px, and 2560px that the grid has 5, 6, and 6 columns respectively, without horizontal overflow.
- Confirm supplier and designer dropdown values match Admin data and combine correctly with category/search filters.
- Confirm the workspace maintains the intended sidebar clearance and active material selection still works.
