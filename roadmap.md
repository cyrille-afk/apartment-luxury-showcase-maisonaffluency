# Roadmap

- [x] Checkout: "Delivery & Payment Options" alignment/spacing (done)
- [x] Wire tab: bank details grid with copy buttons (done, verified in preview)
- [x] Removed leftover "Secure Card Payment" caption in OrderSummary aside
- [x] Verified no redundant card-branding block remains on checkout (Stripe iframe branding is native and cannot be removed from our side)
- [ ] User must return to latest preview (was viewing older commit) to see all of the above
- [x] Verify the redesigned mobile Trade Program hero and 2×2 metrics layout
- [x] Refine mobile collection cards: contained imagery, touch alternate view, and editorial metadata hierarchy
- [x] Repair mobile quote submission: secure verification token, database delivery, exact error logging, and in-drawer success state
- [x] Clarify USD/SGD amounts in checkout and show the SGD equivalent in the Tax block
- [x] Prevent PaymentIntent creation until checkout FX rates are resolved
- [x] Re-enable secure basket persistence when a returning customer starts a new order
- [x] Verify immutable cart removal and region-preserving cache rewrites across Cart/Checkout
- [x] Add Chromium/WebKit latency coverage for cart removal and Swiss basket rehydration
- [x] Blocking Lighthouse mobile CI gate: median-of-3 runs, FCP/LCP/CLS/TBT budgets + perf/a11y scores
