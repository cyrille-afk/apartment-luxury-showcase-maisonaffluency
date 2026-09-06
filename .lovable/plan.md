# Tablet Direct Chat Optimization

## Changes
- Make the open Direct Chat panel use the dynamic viewport height on mobile and tablet so the on-screen keyboard cannot push the composer off-screen.
- Keep the existing desktop behavior, while fitting iPad portrait and landscape within the viewport with safe edge insets.
- Replace the three bracketed quick actions with square shadcn buttons, 44–48px touch targets, uppercase tracked labels, and a left-aligned responsive grid.
- Reflow the attachment, moodboard, brief, preview, message, and send controls into a non-truncating touch layout on smaller screens.

## Verification
- Check the open panel at iPad portrait and landscape sizes.
- Confirm the chat stream remains scrollable, the composer stays visible, quick actions align left, and every bottom control remains reachable without truncation.
