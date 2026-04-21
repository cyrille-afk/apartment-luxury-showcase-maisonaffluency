
Fix the product-sheet spec selectors so they behave like real selectable controls on both Trade and Public product pages.

1. Replace the current fake collapsible spec UI with a real selector component
- Refactor `ExpandableSpec` so materials and dimensions can work as actual single-choice selectors, not just open/close disclosures.
- Use the existing app select primitives for accessibility and real selection behavior.
- Style the selector to match the benchmark: clean minimal field, left icon, subtle neutral outline, muted placeholder text, right chevron, no pill/badge look, no boxed accordion list styling.

2. Make the selector text behave correctly
- Collapsed state:
  - show `Select your material choice` for materials
  - show `Select your size` for dimensions
- After selection:
  - replace the placeholder with the selected material or size
- When there are multiple options, users must be able to click and actually choose one.
- When there is only one option, keep the simpler non-selector display.

3. Parse product data into selectable options more reliably
- Materials:
  - keep newline support
  - also split single-line values on commas/slashes where they represent distinct finish choices
  - preserve prefixes where needed
- Dimensions:
  - keep `formatDimensionsMultiline`
  - normalize multiple dimension variants into proper option rows
- Trade page:
  - when `size_variants` exists, use that as the authoritative size-selection source for pricing
  - keep the visible size selector label/value aligned with the price-driving variant

4. Remove the redundant second size selector on the Trade product page
- Delete the extra `SIZE` block currently shown below lead time.
- Keep only the top spec selectors for material and size.
- The selected size from the top selector should be the same one used to calculate and display the price below.

5. Wire the Trade pricing to the top size selector
- Move size selection state out of the duplicated lower block and connect it directly to the main dimensions selector.
- Selecting a size should update the active variant and therefore the displayed price.
- Keep the retail/trade toggle logic intact.

6. Bring Public and Trade pages into parity
- Apply the same selector UX to both:
  - `src/pages/TradeProductPage.tsx`
  - `src/pages/PublicProductPage.tsx`
- Public page gets the same selector look and selection behavior, but without trade pricing logic.
- Origin and lead time remain simple informational rows.

Files to update
- `src/components/ExpandableSpec.tsx`
- `src/pages/TradeProductPage.tsx`
- `src/pages/PublicProductPage.tsx`
- possibly `src/lib/formatDimensions.ts` if dimension parsing needs a stricter normalization pass

Technical notes
- No database changes.
- No backend changes.
- Main issue is architectural: `ExpandableSpec` currently manages only open/closed UI and never stores a selected option, so nothing is actually selectable.
- The Trade page currently duplicates size handling: once in the spec block and again in the pricing block. That duplication will be removed so one selector controls both display and price.
