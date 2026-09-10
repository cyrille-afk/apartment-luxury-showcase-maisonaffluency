# Persist intent-funnel email into Secure Checkout

## Implementation
- Connect the three-step order-intent form to the existing global checkout form state.
- Pre-fill its Step 3 email field from the saved checkout email whenever the form opens.
- Save email changes immediately to both the shared state and browser-backed persistence.
- Re-save the trimmed, confirmed email before handing the order into the cart and Secure Checkout.

## Verification
- Run the focused TypeScript checks.
- Complete the mobile intent flow with an email and confirm Secure Checkout displays the same email without re-entry.
