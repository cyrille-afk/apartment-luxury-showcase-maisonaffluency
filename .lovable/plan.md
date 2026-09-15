# Alinea Material Swatch Image Fix

## Scope
- Keep the existing dedicated Alinea material files; database inspection confirms the stone records already point to `/fabrics/alinea/` texture assets rather than product gallery images.
- Add an Alinea-specific swatch treatment that uses a neutral gray backing and contain-style image fitting, preventing any product-cutout silhouette from appearing as a harsh white tile inside the circular mask.
- Use image blending on light mode so white source backgrounds inherit the neutral swatch backing, while preserving normal rendering in dark mode.
- Leave all non-Alinea materials unchanged.

## Verification
- Run the TypeScript check.
- Verify the Alinea-filtered Material Library live at desktop size, including circular clipping and neutral backing.
