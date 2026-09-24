# Visual Theme Analysis UI Framework

## Goal
Turn each completed studio analysis in the Trade Applications review queue into a refined editorial profile that makes the AI findings and scraped visual evidence easy to assess at a glance.

## What will change
- Add a dedicated `VisualThemeAnalysis` presentation component inside each trade application row.
- Replace the current compressed “Studio Aesthetic DNA” text block with a responsive two-column editorial split:
  - **Curatorial Insights:** Design Dialect, Historical Affinities, Materiality Profile, and AI Summary Notes.
  - **Visual Evidence Matrix:** the first six scraped portfolio or Instagram images in a responsive three-column square grid.
- Add a four-swatch palette track beneath the image matrix, derived from the stored `dominant_tones` array, with readable tone labels.
- Preserve the existing pending, failed, empty-image, and re-run analysis states.
- Keep account details, AI Critical Radar, and approval controls intact while giving the visual analysis enough horizontal space to remain legible.

## Data and behavior
- Extend the existing `trade_accounts` query to include `studio_aesthetic_dna.image_urls`.
- Parse array fields defensively so missing or malformed analysis data cannot break the review queue.
- Map common descriptive tone names to stable palette colors, with a deterministic neutral fallback for unfamiliar AI-generated names.
- Show graceful placeholders when fewer than six valid images were scraped; broken images remain contained without shifting the grid.

## Technical details
- Use the project’s existing semantic design tokens for ink, canvas, borders, and typography.
- Add a semantic visual-evidence canvas token matching the requested `#FBFBFA`, rather than hardcoding the value in the component.
- Use strict `aspect-square overflow-hidden` image frames and responsive `grid-cols-3` layout.
- Keep the UI frontend-only; no database schema or analysis-worker changes are needed because `image_urls`, summary, tones, affinities, and materials are already stored.

## Verification
- Check the admin Trade Applications queue at desktop and mobile widths.
- Confirm completed, processing, failed, missing-image, and broken-image states render without overlap.
- Confirm all existing approval, hold, and re-run controls still work.
