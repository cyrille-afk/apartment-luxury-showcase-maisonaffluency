# Fix compact product-gallery corner controls

## Scope
- Keep share, favorite/save, and presentation controls at a constant 40px size in both normal and compact gallery states.
- Anchor each control directly to a corner of the resizing image frame so positions follow its changing outer bounds.
- Give controls an opaque semantic surface, subtle blur, border, and shadow for separation from the photograph.
- Preserve gallery behavior, menus, favorites, and presentation actions.

## Verification
- Reproduce the mobile scroll-collapse state and confirm all controls retain their dimensions and corner offsets.
- Check the expanded state and ensure controls remain aligned without covering one another.
