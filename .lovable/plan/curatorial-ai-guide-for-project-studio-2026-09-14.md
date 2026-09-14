# Curatorial AI Guide for Project Studio

## Goal
Add a floating, editorial AI co-designer inside Project Studio that presents contextual product recommendations as a visual curation stream instead of a conventional chat window.

## Changes
- Add a compact `AI CURATORIAL ASSISTANT // CO-DESIGNER` launcher and an adjustable bottom drawer within Project Studio.
- Build a horizontally scrollable recommendation stream using real catalogue imagery and product records, anchored to the active project composition.
- Show analysis status, source-piece context, match rating, rationale, and `[ + ADD TO COMPOSITION ]` on every recommendation.
- Draw a subtle dashed visual connector from the active canvas piece to the curation stream while recommendations are open.
- Make canvas and ledger items selectable as the source context without conflicting with the existing specification drawer.
- Add recommendations to the project’s linked composition through the existing project board workflow, then refresh the canvas and ledger.
- Bind all copy and commercial detail to the existing global Client View state:
  - Client View: aesthetics, spatial balance, proportion, and material harmony only.
  - Studio View: include lead-time risk and trade opportunity signals where available.
- Keep the existing Felix concierge available globally; this feature becomes the Project Studio’s visual sourcing surface rather than a second chat system.

## Verification
- Test opening, resizing, minimizing, horizontal scrolling, source-piece switching, and closing at 1350×1182 and mobile width.
- Confirm recommendation cards use live catalogue images and open the correct product specification.
- Add a recommendation and verify it appears in the active project composition without duplication.
- Toggle Client View from both Project Studio and the global header; confirm trade language disappears immediately and returns in Studio View.
- Verify the dashed connector follows the active source item and does not block clicks.
- Confirm keyboard focus, Escape close, reduced-motion behavior, and a clean browser console.

## Technical Details
- Reuse `useTradePriceMode` as the single privacy state and the existing project/board records as the composition source of truth.
- Keep recommendations catalogue-grounded and reuse existing product-card/specification patterns; no new chat history or parallel AI conversation store will be added.
