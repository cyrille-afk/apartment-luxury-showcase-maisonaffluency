## Changes

### 1. Drop shadow on Explore CTA (Mobile/PWA only)
`src/components/Hero.tsx` — `heroPrimaryCtaClass` currently uses `shadow-[0_8px_30px_rgba(0,0,0,0.22)]` on all breakpoints. Strengthen it on mobile only by adding a more pronounced layered shadow that resets at `md:` back to the current desktop value, e.g. `shadow-[0_10px_28px_rgba(0,0,0,0.45),0_2px_6px_rgba(0,0,0,0.35)] md:shadow-[0_8px_30px_rgba(0,0,0,0.22)]`. Desktop appearance unchanged.

### 2. Increase dimming behind the subhead paragraph
Target: the subhead `<p>` "A curated collection of masterworks / reeditions and contemporary design / for global architectural projects." in `src/components/Hero.tsx`.

Rather than darkening the whole hero gradient (which would affect the headline), wrap the subhead in a subtle localized dim: add a soft radial/linear backdrop behind just this paragraph via a `::before` or wrapping div using `bg-black/25` with `backdrop-blur-[1px]` and generous padding + `rounded-sm`, feathered with a slight gradient mask so it doesn't read as a hard rectangle. Net effect: 5–10% more darkening under the paragraph text on mobile/PWA. Keep desktop as-is (or apply same, since it improves legibility identically) — will apply on all breakpoints since the request is purely for readability.

### 3. Refine mobile header margins (burger + flag away from logo)
`src/components/Navigation.tsx` line 334: the mobile row is `justify-between px-4` inside a parent that already has `px-5`. The burger uses `h-11 w-11` with a 9×9 icon, so its visual edge sits close to the centered logo on narrow screens.

Fix: reduce the burger icon size from `h-9 w-9` to `h-7 w-7` (still tappable via the 44px button box) and tighten button box to `h-11 w-11` unchanged, plus reduce the flag's compact rendering. Additionally, drop the extra inner `px-4` on line 334 so the outer container's `px-5` is the sole horizontal inset — this pulls burger and flag to the outer edges, increasing distance from the centered logo. Verify visually via Playwright on 390-wide viewport.

### 4. Move "(Trade Only)" tag
`src/components/Hero.tsx`:
- Remove the `<span className="font-medium text-white">{" "}(Trade Only)</span>` from the "Singapore Gallery Preview" button (line ~113).
- Append the same span to the "Book Private Appointment" button (line ~121), rendered after `<span className="link-underline-grow">Book Private Appointment</span>`.

### 5. "Singapore Gallery Preview" scrolls precisely to the Tour Our Gallery section
`src/components/Hero.tsx` line ~107 currently uses raw `document.getElementById("apartment-tour")?.scrollIntoView({ behavior: "smooth" })`, which ignores the fixed nav offset and can undershoot on mobile.

Replace with `scrollToSection("apartment-tour")` (already imported), which measures the nav + sticky bars and settles the target correctly under the header. This ensures the "Tour Our Gallery" heading lands directly under the header on both mobile and desktop.

## Verification
Run Playwright at 390×844 and 1280×800:
- Screenshot the hero — confirm CTA shadow is stronger on mobile, subhead has visibly higher contrast, `(Trade Only)` now sits with "Book Private Appointment".
- Confirm burger/flag are further from the centered logo on mobile.
- Click "Singapore Gallery Preview" and screenshot after scroll — confirm the "Tour Our Gallery" heading sits just below the fixed header.

No business logic changes; all edits are presentational.
