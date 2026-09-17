# Verified Trade Felix Drawer Morph

## Goal
Keep the existing right-hand request drawer open after Step 3 and branch by membership status:
- Guests and unverified visitors see the existing static “Specifications Recorded” Step 4.
- Verified Trade Members transition directly into the live Felix workspace inside the same drawer.

## Implementation
1. Add an embedded-drawer mode to the existing Felix chat panel so it reuses the real conversation, composer, project history, and four-stage pipeline without creating a second floating window or backdrop.
2. On verified submission, keep the drawer mounted, fade Step 3 out over 250ms, then replace only its internal content with embedded Felix.
3. Lock the embedded pipeline at `01 DISCOVER` for the initial reveal and animate it into the header.
4. Queue the exact product, selected finish, specifications, location, and swatch metadata into the existing persistent Felix synchronization store.
5. Show Felix’s thinking state for 1.5 seconds, then append the tailored synchronization message to the live project history with an upward reveal.
6. Keep guest behavior isolated: no Felix mount, no chat execution, and the static in-drawer success canvas remains.

## Verification
- Verify the three-step desktop flow remains intact.
- Verify a guest submission lands on the static success canvas.
- Verify a Trade Member submission never closes the drawer, shows the 250ms morph, mounts Felix, displays `01 DISCOVER`, shows the 1.5-second thinking state, and records the dynamic piece/finish/context message once.
- Run the project typecheck and inspect the final desktop drawer visually.
