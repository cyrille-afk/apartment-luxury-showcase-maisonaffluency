# Desktop Quote and Order Intake Drawer

## Goal
Replace the desktop-centered three-step popup with one full-height right-side workspace while preserving the current mobile sheet and all existing submission rules.

## Changes
- Recompose the desktop intake as a 460–500px right-edge drawer with a light backdrop, hairline border, target-piece summary, and persistent 01 Profile / 02 Context / 03 Contact tracker.
- Keep Profile, Context, and Contact as distinct steps inside the same drawer, with spacious desktop layouts and the selected product finish prefilled in Context.
- Replace the plain phone input with the existing localized, text-only dialing-code field.
- Add the existing premium drag-and-drop reference upload control to Contact, including validation, filename, size, and removal.
- Carry location, finish, specifications, and uploaded-file metadata through the existing order or bespoke handoff without duplicating contact entry.
- For verified Trade members, preserve secure submission, then close the intake, open Felix at 01 Discover, show a typing state, and append the synchronized confirmation to the project log.
- Keep guest users out of Felix and preserve the existing concierge submission path.

## Verification
- Desktop: confirm both Place Order and Bespoke actions open the right drawer, all three steps fit and transition correctly, and no centered popup remains.
- Mobile: confirm the existing full-screen/bottom-sheet behavior remains unchanged.
- Confirm localized dialing codes, finish inheritance, file add/remove, order handoff, bespoke handoff, and verified Felix synchronization.
- Run the project typecheck and targeted browser checks at desktop and mobile sizes.
