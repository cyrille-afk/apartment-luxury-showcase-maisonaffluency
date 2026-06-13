# Worldwide Trade Billing — Dual-Mode Checkout

Add one switch at the quote/order level — **billing mode** — without touching the MSRP table or the 3-tier discount ladder.

## Model

| Mode | Default region | Buyer (card on file) | Charged amount | Ship to | Invoice shown | Designer compensation |
|---|---|---|---|---|---|---|
| `agent_commission` | EU, UK, Switzerland, MENA, APAC | End-client | **100% MSRP** + local tax + white-glove | End-client home | Maison Affluency, MSRP-visible | Tier % wired post-delivery |
| `net_buy` | US, Canada, Mexico | Designer firm | **MSRP − tier discount** + freight only | Receiving warehouse | White-label, MSRP stripped | Margin kept at sale |

Tier ladder unchanged (8% baseline → higher tiers). In `agent_commission` it becomes the **payout %**; in `net_buy` it becomes the **net discount**. Same number, different placement.

## Data changes

New columns on `trade_quotes` (and mirrored on the resulting order):

- `billing_mode` enum: `agent_commission` | `net_buy` (NOT NULL, default by country)
- `payer_type` enum: `end_client` | `designer_firm`
- `payout_pct` numeric (mirrors tier % when agent mode, 0 in net mode)
- `ship_to_kind` enum: `end_client` | `receiving_warehouse`
- `end_client_billing` JSONB (name, email, billing address — only when agent mode)
- `designer_payout_account_id` FK → new `studio_payout_accounts` table (IBAN/routing, encrypted at rest, US W-9 / EU VAT)
- `resale_certificate_url` (gates `net_buy` for US studios — required by state)

New table `studio_payout_accounts` (one per studio, RLS scoped to studio members).

No change to `trade_products`, `trade_product_pricing`, or `trade_tier_config`.

## Default-by-country logic

Reuse the same country hook that drives default trade currency (memory: *Default Trade Currency by Country*).

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
┌─ Verified Trade Checkout ────────────────────────────┐
│                                                      │
│  ◉ Bill my client / receive agent commission         │
│      (Pays 100% MSRP. You receive 8% wired.)        │
│      [End-client name] [Email] [Billing address]    │
│                                                      │
│  ○ Buy net at the trade price                        │
│      (Pays 92% MSRP. You invoice the client.)       │
│      [Receiving warehouse address]                   │
│      [Resale certificate (US only) — Required]      │
│                                                      │
│  Payment: [Stripe card field]                        │
└──────────────────────────────────────────────────────┘
```

The radio defaults from country but the designer can switch with no friction. Switching recomputes the cart total live.

## Invoice / PDF variants

Two templates, picked from `billing_mode`:

1. **Agent invoice** (`agent_commission`) — issued to end-client, Maison Affluency branding, full MSRP, line-item taxes. Designer receives a separate **Commission Statement** PDF showing units, MSRP, % and net wire.
2. **Net invoice** (`net_buy`) — issued to designer firm, **white-label** (reuses existing white-label PDF rule from memory), MSRP stripped, only net + freight shown. No mention of Maison Affluency margin.

## Payments

Two Stripe paths inside `create-payment`:

- `agent_commission` → Checkout session billed to end-client email, success triggers a queued **payout** record. Payouts settle on `order.delivered`. Phase 1 = manual wires from an admin queue; Phase 2 = Stripe Connect destination charges to `studio_payout_accounts`.
- `net_buy` → Checkout session billed to designer email, no payout side-effect.

Tax: `automatic_tax: { enabled: true }` in both modes (US state tax is the reason this exists, and EU VAT still needs calculation on agent mode).

## Edge cases to lock down

- **Tier doesn't double-apply.** In agent mode the discount is paid out, not deducted — pricing engine must read `billing_mode` before applying the discount.
- **Mixed cart on one quote** isn't supported in v1 — billing mode is quote-level. If a designer wants both, they split into two quotes.
- **US resale cert gating** — `net_buy` is hidden until the studio uploads a valid certificate; surfaces a clear "Upload resale certificate to unlock net pricing" CTA.
- **Refunds** in agent mode must claw back the queued payout if it hasn't settled.
- **FX** unchanged — manual price overrides still bypass FX (per existing memory).

## Phasing

**Phase 1 (ship first):**
- Schema + RLS for new columns and `studio_payout_accounts`
- Default-by-country toggle in checkout UI
- Two invoice templates
- Stripe Checkout split + manual payout admin queue
- Resale-cert upload + gating

**Phase 2:**
- Stripe Connect onboarding for automated wires
- W-9 / VAT capture flow
- Commission statement emails

## Out of scope
- Multi-currency wires (Phase 2)
- 1099/T5 tax reporting (Phase 2)
- Subscription/retainer billing
- Physical inventory / shipping management (still per quote, not stocked)

## Open questions before build
1. Stripe Connect now or manual wires for launch? (affects timeline by ~2 weeks)
2. Confirm the tier ladder values to use as the payout % per tier (8% baseline today — same for net discount?)
3. For US `net_buy`, do we require resale cert per state or accept a single multi-state cert (MTC/SST)?