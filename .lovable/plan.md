# Refine Trade Designer Portrait Views

## Scope
- Change the desktop designer-card action label from **MORE INFO** to **DISCOVER PORTRAIT**.
- Keep card navigation behavior unchanged.
- Reframe expanded Trade Portal portraits to use the same centered editorial proportions as the public designer portrait page.
- Preserve mobile behavior and all existing biography media/content.

## Implementation
- Update the overlay action copy in the Designers & Ateliers directory card.
- Replace the expanded portrait’s full-width/negative-margin wrapper with a centered `max-w-6xl` content track matching the public portrait page.
- Add the same restrained masthead structure: back navigation, designer name, and tracked specialty label.
- Pass the same width, spacing, typography, and video constraints into the shared editorial biography layout.
- At desktop widths, retain at least 80px of internal workspace clearance from the persistent Trade Portal sidebar while centering the portrait within the remaining content viewport.

## Verification
- Verify the directory card label and click-through at desktop size.
- Compare the Trade portrait against the public portrait at the same viewport, checking content width, centered video proportions, text tracking, and sidebar clearance.
- Confirm the portrait remains usable below 1024px and no existing portrait media or close navigation regresses.
