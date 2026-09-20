# Destination-aware order tax and customs messaging

## Goal
Make every buyer-facing order confirmation and order email describe the tax, duties, customs handling, and delivery responsibility for the actual destination and selected DDP/DDU term—never a generic or hardcoded country assumption.

## Implementation

1. **Create one shared destination message model**
   - Add a small shared server utility that combines the existing tax treatment with destination and delivery-term data.
   - Produce explicit fields for the destination name, tax statement, import-charge label/amount, customs statement, and responsibility statement.
   - DDP wording will state that shown import duty, destination VAT/GST, clearance, and handling are prepaid/invoiced by Maison Affluency.
   - DDU wording will state that estimated destination charges are excluded and payable by the buyer to the carrier/customs authority.
   - Destinations without a configured landed-cost rule will say charges are determined by the destination authority, without inventing rates.

2. **Persist the buyer’s actual checkout facts**
   - Extend `shop_orders` with delivery country, delivery term, import duty, import tax, clearance, DDP handling, and deferred-import totals.
   - Pass these values from Checkout and the bank/pro-forma paths into order creation.
   - Keep stored values immutable for the confirmation so later rate/config changes cannot rewrite what the buyer agreed to.

3. **Update order confirmation emails**
   - Expand the Order Received and Payment Confirmed templates with destination-aware rows and a concise delivery/tax statement.
   - Send the stored order snapshot from card-webhook and bank-payment flows.
   - Remove the Singapore-only tax lookup in the bank payment confirmation and use the order’s stored country/tax data.
   - Ensure DDP and DDU messages cannot contradict whether customs charges are included in the displayed total.

4. **Update on-screen confirmations and documents**
   - Replace the generic “any duties applicable” confirmation copy with the same destination-aware summary used by email.
   - Keep the pro-forma PDF aligned with the stored tax/customs snapshot; include the delivery term and charge responsibility where relevant.

5. **Verification**
   - Add focused tests for London DDP, London DDU, Switzerland, UAE, Singapore GST, and an unsupported destination.
   - Verify rendered email data and confirmation copy contain the correct destination and never show Singapore/UK wording for another country.
   - Run the relevant tests and TypeScript checks, apply the database change, and deploy the changed email/payment functions.

## Technical details

- Existing authorities remain `taxRules` for sales tax and `shippingZones` for landed costs; the new utility only composes their results into a durable order snapshot.
- Existing orders remain compatible: missing new fields fall back to the stored `tax_statement`, then neutral destination-pending wording.
- No payment amount, tax rate, or freight calculation logic will be changed in this task.
