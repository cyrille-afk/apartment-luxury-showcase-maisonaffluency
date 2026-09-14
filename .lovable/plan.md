# Visualiser Rendering Depth Upgrade

## Build
- Extend each canvas object with persistent perspective, lighting, and shadow settings while migrating existing saved compositions safely to neutral defaults.
- Replace uniform corner scaling with a two-mode transformer: proportional resize handles plus independent perspective handles that adjust horizontal skew, vertical tilt, and depth to align furniture with room vanishing lines.
- Add a compact `AMBIENT MATCH` panel inside the selected-object controls with warmth, brightness, and contrast sliders; apply changes live to that object only.
- Replace the current single blurred ellipse/drop-shadow with a sharp contact shadow and a separate elongated directional ambient shadow.
- Request the largest practical transparent Cloudinary source with automatic DPR and lossless-friendly quality, and use the same isolated asset treatment in the sourcing tray.

## Interaction
- Keep object movement, deletion, layer ordering, 15-object compositions, backdrop upload, reset, and session persistence unchanged.
- Prevent transformer handles and sliders from initiating object dragging.
- Keep controls restrained and technical so they do not obscure the composition; provide keyboard-accessible sliders and reset-safe defaults.

## Technical Details
- Model perspective through CSS `perspective()` with bounded `rotateX`, `rotateY`, and `skewX` values, producing stable transforms rather than arbitrary free-form matrix coordinates.
- Persist `tiltX`, `tiltY`, `skewX`, `brightness`, `contrast`, `warmth`, and directional-shadow values per object.
- Use high-resolution Cloudinary cutouts with `dpr_auto`, `c_limit`, and a larger source width to avoid upscaling small originals.

## Verification
- Verify mouse and touch dragging still work after adjusting perspective and lighting.
- Verify all perspective handles independently change the selected object without moving it.
- Verify warmth, brightness, and contrast update live and survive reload.
- Inspect contact and ambient shadows over the uploaded room backdrop at 1588×1182 and a Retina device scale.
- Confirm high-resolution cutout requests, reset behavior, selection controls, and zero browser console errors.
