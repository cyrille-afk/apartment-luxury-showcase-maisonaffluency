# Repair the iOS sticky purchase bar and restore the 3-step buying flow

## Outcome
- Keep the complete purchase bar at its first-load vertical position while Safari’s bottom controls retract, instead of recalculating and moving it during scroll.
- Replace the exposed white area beneath the bar with a dark fade that visually joins the purchase controls.
- Restore the visible, clickable **Next** action throughout Step 1, Step 2, and Step 3 without changing the existing step array or transition logic.

## Implementation
1. **Freeze the initial iOS bottom offset**
   - Measure Safari’s covered bottom area once when the product page mounts.
   - Store that initial offset for the lifetime of the page and position the root-level purchase bar from it.
   - Do not update the bar’s bottom position from `visualViewport` scroll or resize events while the browser controls retract.
   - Preserve the bar’s root-level portal, full width, safe-area padding, and existing desktop behavior.

2. **Paint the exposed browser area dark**
   - Add a dedicated, non-interactive dark gradient backing beneath the purchase bar down to the physical screen edge.
   - Scope it to mobile product pages so other light pages and desktop layouts are unchanged.
   - Keep the entire price row and black action button above the backing and fully visible.

3. **Restore the buying sheet controls**
   - Keep `STEPS`, `canAdvance`, `chooseProfile`, `next()`, and all checkout handoff functions unchanged.
   - Move both the intake sheet and its thank-you state above the root purchase bar in the stacking order.
   - Ensure the sheet’s own bottom action area is part of the visible sheet and cannot be covered by the page purchase bar.
   - Confirm selecting either **Interior Designer / Architect** or **Private Client** immediately enables the visible **Next** button.

4. **Regression verification**
   - Test on mobile WebKit at first load, during downward scrolling, after Safari-style viewport-height changes, at the page bottom, and while scrolling back up.
   - Verify the purchase bar does not change its initial vertical anchor, no white strip appears beneath it, and the three-dot control remains above it.
   - Run the full buying path: Step 1 profile → Step 2 location → Step 3 email → Place Order, including back navigation and the quote variant.
   - Run the existing mobile and layout suites plus the TypeScript check before completion.

## Technical details
- Current source confirms the buying logic is intact: Step 1 enables from `Boolean(profile)` and `next()` still advances the unchanged three-step array.
- The visible failure is a confirmed layer collision: the root purchase bar is `z-[9999]`, while both intake-sheet wrappers are only `z-[130]`, so the purchase bar covers the sheet’s sticky action area.
- The positioning fix will use one captured initial viewport inset rather than a live scroll-following viewport variable.
