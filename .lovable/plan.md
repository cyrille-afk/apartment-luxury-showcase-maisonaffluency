# Mobile Homepage Rendering Optimization

## Goal
Reduce mobile main-thread work before first paint without changing desktop bundling, routes, or visible homepage behavior.

## Changes
- Defer non-critical homepage engagement listeners and overlay initialization through idle scheduling with safe timeout fallbacks and cleanup.
- Add a reusable below-fold rendering class using `content-visibility: auto` and intrinsic-size placeholders, then apply it to homepage sections below the hero.
- Keep the hero and navigation synchronous so the successful desktop and above-the-fold rendering remain unchanged.
- Audit homepage inline graphics; externalize only genuinely complex SVG payloads. Leave tiny lazy-loaded control icons unchanged because external requests would cost more than their parser work.

## Verification
- Confirm the homepage hero and navigation still render immediately at mobile and desktop widths.
- Confirm below-fold wrappers compute to `content-visibility: auto`.
- Confirm deferred listeners initialize after the first paint and clean up correctly.
- Run targeted checks and validate the homepage in Chromium at mobile width.

## Technical details
- Use `requestIdleCallback` where supported with a bounded `setTimeout` fallback.
- Use a conservative `contain-intrinsic-size` estimate to avoid scroll-height collapse and layout shifts.
- No route splitting, bundler configuration, or desktop bundle changes.
