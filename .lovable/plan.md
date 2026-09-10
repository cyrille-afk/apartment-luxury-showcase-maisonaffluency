# Fix cart eviction and preserve regional checkout state

## Goal
Keep the shopping basket intact across navigation, funnel close/reopen, refreshes, and new tabs. Empty storage or unhydrated component state must never overwrite a valid basket. Only a confirmed order may clear persisted cart data.

## Changes
- Harden the global cart store so startup reads the primary local cache and durable backup before exposing state.
- Ignore accidental empty cross-tab storage events unless an order-completion marker proves the basket was intentionally finalized.
- Separate explicit user line removal from order completion, while preserving the last valid basket until a genuine order succeeds.
- Strengthen the secure checkout basket reader/writer with validated lazy hydration, non-empty write guards, and recovery from either browser cache.
- Store the locked destination and settlement currency with secure basket records, then restore Switzerland/CHF (and other selected regions) when checkout is reopened.
- Keep all existing successful payment and confirmed bank-transfer paths as the only order-finalization clear points.

## Validation
- Add focused tests covering populated-cache hydration, empty-mount protection, cross-tab recovery, regional metadata restoration, and finalized-order clearing.
- Run TypeScript checks and the targeted tests.
- Verify in the live app that a basket survives route navigation and a fresh tab while Switzerland/CHF remains selected, then verify a simulated finalized order clears it.

## Technical details
- Persist a versioned basket envelope containing `lines` and regional metadata, while continuing to read legacy array-only data for backward compatibility.
- Use explicit hydration status and validated storage parsing rather than synchronizing an initial empty render back to storage.
- Treat malformed or empty primary cache data as recoverable from the durable backup unless the finalized-order marker is present.
