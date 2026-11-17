# Visualiser Anchor loading and spatial layout

- Carry the pinned Mood Board Anchor through Project Studio into the Sandbox, falling back to the largest sofa or dining table by footprint, then the first saved piece when neither exists.
- Replace automatic grid coordinates with a pure `spatialLayoutEngine.ts`: sofa and dining-table vignettes use real metre dimensions, specified clearances and inward rotations, with deterministic collision checks and fallback placement for other categories.
- Change `SequentialFurniture` to finish the Anchor before admitting secondary GLBs; retain groups of three above four pieces and show subtle dimensioned wireframe boxes for secondary pieces while queued or fetching.
- Add focused regression tests for Anchor priority, exact sofa/dining spacing, rotations, dimensions and non-overlap. Verify the selected-board handoff in the browser and check the preview build.

## Technical notes

- Automatic arrangement applies to generated project/board intake only; existing manual transforms, curated saved scenes, finishes and procurement data remain unchanged.
- Missing dimensions use an explicit conservative placeholder size rather than inventing catalogue measurements.
