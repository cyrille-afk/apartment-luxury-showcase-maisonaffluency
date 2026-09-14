# Connect Materials to the 3D Visualiser

## Build
- Add a shared, persistent 3D finish selection state so the Material Library and Visualiser use the same active finish.
- Make Material Library swatches selectable and provide a direct action to open the Visualiser with that finish active.
- Add a compact finish browser to the selected-object controls, using the same live material library data.
- Apply the selected swatch image as the model’s surface colour texture in real time; configure physically based roughness, metalness, and colour by material category, while supporting dedicated map URLs whenever the library provides them.
- Persist the assigned finish per placed object so different furniture pieces can retain different materials.

## Canvas and Layout
- Keep the WebGL canvas transparent and antialiased over the uploaded room photograph.
- Replace the opaque floor coverage with a transparent soft-shadow catcher so rug and flooring detail remains visible.
- Keep the bottom console horizontally centered and fixed 32px above the Visualiser edge across the current desktop viewport.

## Verification
- Verify a library swatch opens in the Visualiser and updates a selected GLB model immediately.
- Verify material changes persist after reload and do not alter unselected objects.
- Check the room backdrop remains visible through the floor shadow layer, toolbar alignment at 1588×1182, and zero browser console errors.
