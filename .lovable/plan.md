# Worldwide Trade Billing — Dual-Mode Checkout

Add one switch at the quote/order level — **billing mode** — without touching the MSRP table or the 3-tier discount ladder. The US path is built around how NYC firms actually operate: they buy net from us, then add their own **Purchasing & Administration Fee** (15–35%) on their own studio invoice. Our job is not to give up margin to match a 30% trade discount — it is to deliver the **structural support** (white-label tearsheets + managed freight) that makes a smaller net discount attractive.

## Model

| Mode | Default region | Buyer (card on file) | Charged amount | Ship to | Invoice flow | Designer compensation |
|---|---|---|---|---|---|---|
| `agent_commission` | EU, UK, Switzerland, MENA, APAC | End-client | **100% MSRP** + local tax + white-glove | End-client home | Maison Affluency invoices end-client, MSRP-visible | Tier % wired post-delivery |
| `net_buy` | US, Canada, Mexico | Designer firm | **MSRP − tier discount** + freight | NYC/US receiving warehouse | Maison Affluency invoices the **designer firm only**. Designer issues their **own studio invoice** to the end-client with a separate "Purchasing & Administration Fee" line item (cost-plus). We never see the end-client invoice. | Net discount kept + their own cost-plus fee billed directly to client |

Tier ladder unchanged. In `agent_commission` it becomes the **payout %**; in `net_buy` it becomes the **net discount** the designer keeps.

## Why this shape (not a 30% global discount)

NYC firms cannot survive on a 15% discount **alone**, but they will buy at 15% if we hand them tools that save billable hours and let them mark up on their own paper. The platform's job in `net_buy` is to:

1. **Sell net** at the tier discount (no MSRP visible on anything the end-client sees).
2. **White-label tearsheets** — already built; reuse the existing white-label PDF pipeline (memory: *White-label Documentation Policy*).
3. **Door-to-drayage freight** — single managed quote from atelier to the US receiving warehouse (customs broker + ocean freight handled by us). This is the new value-add that replaces "more discount."
4. **Stay out of the cost-plus.** We do not generate, see, or store the designer's invoice to the end-client. Their markup is private to their studio.

This is the difference from the original plan: the US `net_buy` invoice we issue is **a normal commercial invoice to the designer firm** (MSRP stripped, only net + freight), not a "white-label invoice to the end-client." There is no end-client invoice on our side at all in this mode.

## Data changes

New columns on `trade_quotes` (and mirrored on the resulting order):

- `billing_mode` enum: `agent_commission` | `net_buy` (NOT NULL, default by country) ✅ migrated
- `payer_type` enum: `end_client` | `designer_firm` ✅ migrated
- `commission_pct` / `net_discount_pct` numeric (one is populated per mode) ✅ migrated
- `end_client_billing` JSONB (only when agent mode) ✅ migrated
- `designer_payout_account_id` FK → `studio_payout_accounts` ✅ migrated
- `resale_certificate_id` FK → `studio_resale_certificates` (gates `net_buy` for US studios, per ship-to state) ✅ migrated
- `managed_freight_quote_id` FK → existing `shipping_quotes` (mandatory in `net_buy` so the door-to-drayage cost is locked at checkout) ✅ migrated

New tables already in place: `studio_payout_accounts`, `studio_resale_certificates`.

No change to `trade_products`, `trade_product_pricing`, or `trade_tier_config`.

## Default-by-country logic

Reuse the country hook driving default trade currency (memory: *Default Trade Currency by Country*).

```text
US, CA, MX            → net_buy
GB, EU27, CH, NO      → agent_commission
AE, SA, QA, KW, BH    → agent_commission
SG, HK, JP, AU, TH, ID, MY, VN, CN → agent_commission
fallback              → agent_commission (safer: no resale-cert dependency)
```

Designer can flip the toggle on any individual quote.

## Checkout UI (new on `TradeQuoteCheckout`)

```text
┌─ Verified Trade Checkout ────────────────────────────────────┐
│                                                              │
│  ◉ Bill my client / receive agent commission                 │
│      Client pays 100% MSRP. You receive [tier %] wired.     │
│      [End-client name] [Email] [Billing address]            │
│                                                              │
│  ○ Buy net — I'll invoice my client myself                   │
│      You pay [100 − tier %] of MSRP + managed freight.      │
│      White-label tearsheets included. MSRP never shown.     │
│      [Receiving warehouse address]                           │
│      [Managed freight quote — auto, editable]                │
│      [Resale certificate for ship-to state — Required (US)] │
│                                                              │
│  Payment: [Stripe card field]                                │
└──────────────────────────────────────────────────────────────┘
```

Switching the radio recomputes the cart total live (MSRP vs MSRP − tier + freight).

## Invoice / PDF variants

Two templates, picked from `billing_mode`:

1. **Agent invoice** (`agent_commission`) — issued by Maison Affluency to end-client, full MSRP, line-item taxes. Designer receives a separate **Commission Statement** PDF (units, MSRP, %, net wire).
2. **Net commercial invoice** (`net_buy`) — issued by Maison Affluency to the **designer firm only**, MSRP stripped, shows line items at net trade price + managed freight. This is a B2B invoice between us and the studio — it never reaches the end-client. The designer's own studio software handles the end-client invoice with their cost-plus fee.

White-label **tearsheets** (separate from invoices) are generated for both modes on demand using the existing pipeline.

## Payments

Two Stripe paths inside `create-payment`:

- `agent_commission` → Checkout session billed to end-client email; on success a payout record is queued; settles on `order.delivered` via Stripe Connect destination charge to `studio_payout_accounts.stripe_connect_account_id`.
- `net_buy` → Checkout session billed to designer email for `(net subtotal) + (managed freight)`. No payout side-effect.

Tax: `automatic_tax: { enabled: true }` in both modes.

## Edge cases to lock down

- Tier never double-applies — pricing engine reads `billing_mode` first.
- Mixed cart on one quote isn't supported; designer splits into two quotes.
- US `net_buy` is hidden until a verified, non-expired resale cert exists for the ship-to state (DB trigger already enforces this).
- Refunds in agent mode claw back the queued payout if it hasn't settled.
- Managed freight is **mandatory** in `net_buy` — no "I'll arrange my own freight" path in v1; that's the whole point of the value-add.
- FX unchanged.

## Phasing

**Phase 1 (ship first) — schema done, app work next:**

1. **Studio settings UI** — payout accounts (Stripe Connect Express onboarding) + per-state resale cert upload.
2. **Checkout dual-mode UI** — radio + conditional fields + live recompute on `TradeQuoteCheckout`.
3. **Managed freight integration** — wire the existing `shipping_quotes` table into the `net_buy` flow so freight is locked at checkout.
4. **Stripe Connect + `create-payment` split** — destination charges for agent payouts; straight charge for net buys.
5. **Two invoice templates** — agent (to end-client) and net commercial (to designer firm).

**Phase 2:**

- Commission statement emails on delivery
- W-9 / VAT capture surfaced in the payout account form
- Multi-currency wires
- 1099 / T5 reporting export

## Out of scope

- We never generate the designer's end-client invoice. Their cost-plus fee is private to their studio.
- Subscription / retainer billing.
- Holding physical inventory.

## Recommended next slice

**Studio settings UI** (payout accounts + per-state resale certs). It gates everything else — without verified payout accounts no agent payout can route, and without per-state resale certs no US studio can pick `net_buy` at checkout (the trigger will block it).
