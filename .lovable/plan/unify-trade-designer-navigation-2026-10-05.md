# Unify Trade Designer Navigation

## Changes
- Point every designer-name link on trade product pages to the designer-filtered Trade Gallery.
- Redirect legacy `/trade/designers/:slug` links to the same gallery while preserving query parameters.
- Keep the destination inside the existing trade dashboard shell so folders, currencies, and trade pricing remain available.
- Add focused route/link coverage and verify Alexander Lamont in the running preview.

## Technical details
- Use `/trade/gallery/:slug` as the canonical trade designer catalogue route.
- Preserve the public `/designers/:slug` route unchanged.
- Record the canonical trade route rule in the project architecture notes.
