# Correct Bond Street Stool Materials

## Build
- Identify the Bond Street Stool’s actual `Base` and `Upholstery` GLB nodes and assign materials only to those isolated meshes.
- Reset its upholstery to a clean, untextured neutral matte material when no fabric is selected; preserve the bronze swivel base independently.
- Replace unrelated generic finish choices with a product-specific Man of Parts finish set: Powdercoated Bronze Metal Swivel for the base, plus Sahco Coney 0003 and Balboa 0019 for upholstery.
- Persist base and upholstery selections separately on each placed stool so changing fabric never overwrites the metal base or another object.

## Texture Quality
- Load authentic high-resolution diffuse maps and dedicated normal/roughness maps where verified assets exist.
- Apply correct color spaces, anisotropic filtering, repeat density, and PBR roughness/metalness values for Retina rendering.
- Never reuse a colour photograph as a fake normal, roughness, or metalness map.

## Interface
- Show separate Base and Upholstery finish groups in the selected-object panel for Bond Street Stool.
- Keep the general Material Library browser for other products, but prevent unrelated swatches such as Karakorum Dune from appearing for this stool.

## Verification
- Confirm the live GLB contains `Base` and `Upholstery` nodes and that only the intended node changes per finish selection.
- Verify the neutral default has no generic fabric pattern, base and upholstery persist independently after reload, and no browser console or asset-loading errors occur.
- Inspect the rendered stool at the current 1588×1182 Retina viewport.

## Technical Details
- Clone every cached GLB scene before mutation and clone mesh materials per instance.
- Extend visualiser finish metadata with optional diffuse, normal, roughness, target-slot, repeat, and PBR values without altering generated backend files manually.
- Dispose cloned textures/materials on replacement or unmount to prevent GPU memory leaks.
