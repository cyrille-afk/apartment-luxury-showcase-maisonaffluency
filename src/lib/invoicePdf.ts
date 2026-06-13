/**
 * Invoice variants for the dual-mode trade billing system.
 *
 * Two artifacts:
 *   - "tax_invoice"        → agent_commission mode. Issued to the END CLIENT
 *                             at full MSRP. Maison Affluency is the seller of
 *                             record; the designer's commission is settled
 *                             separately via Stripe Connect.
 *   - "proforma_net_buy"   → net_buy mode. Issued to the DESIGNER FIRM at the
 *                             net price (MSRP − net_discount_pct). Includes a
 *                             "FOR RESALE" notice referencing the studio's
 *                             resale certificate. The designer invoices their
 *                             own client on their own paper, separately.
 *
 * Both are rendered by the same engine as the quote PDF — we only swap the
 * header title, totals labels, recipient block, and (for net_buy) the resale
 * notice. This keeps the visual system consistent.
 */

import type { QuotePdfArgs, QuotePdfLine } from "./quotePdf";
import { buildQuotePdf, downloadQuotePdf } from "./quotePdf";

export type InvoiceMode = "tax_invoice" | "proforma_net_buy";

export interface BuildInvoiceOptions {
  mode: InvoiceMode;
  /** End-client billing block (agent mode) OR designer firm billing block (net mode). */
  recipient: {
    company?: string | null;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: {
      line1?: string | null;
      line2?: string | null;
      city?: string | null;
      region?: string | null;
      postalCode?: string | null;
      country?: string | null;
    } | null;
  };
  /** For net_buy invoices to US ship-to. */
  resaleCertNumber?: string | null;
  /** Net discount percentage (0..100) applied to line items in net_buy. */
  netDiscountPct?: number;
  /** Optional explicit invoice number; defaults to the quote number with INV-/PRO- prefix. */
  invoiceNumber?: string;
}

/**
 * Apply mode-specific overrides on top of an existing QuotePdfArgs object.
 * The caller is responsible for building the base args from the trade_quote
 * (same code path the quote PDF uses) — we just specialize it.
 */
export function specializeQuoteArgsForInvoice(
  base: QuotePdfArgs,
  opts: BuildInvoiceOptions,
): QuotePdfArgs {
  const { mode, recipient, resaleCertNumber, netDiscountPct, invoiceNumber } = opts;

  const isNetBuy = mode === "proforma_net_buy";

  // In net_buy we replace the displayed unit prices with their net equivalents
  // so the designer sees what they're actually paying. The trade discount block
  // is suppressed because the discount is already baked into the line price.
  let lines: QuotePdfLine[] = base.lines;
  let subtotalCents = base.subtotalCents;

  if (isNetBuy && netDiscountPct && netDiscountPct > 0) {
    const factor = 1 - netDiscountPct / 100;
    lines = base.lines.map((l) => ({
      ...l,
      unitPriceCents: l.unitPriceCents != null ? Math.round(l.unitPriceCents * factor) : null,
      lineTotalCents: l.lineTotalCents != null ? Math.round(l.lineTotalCents * factor) : null,
    }));
    subtotalCents = Math.round(base.subtotalCents * factor);
  }

  const number =
    invoiceNumber ??
    (isNetBuy ? `PRO-${base.quoteNumber.replace(/^QU-?/i, "")}` : `INV-${base.quoteNumber.replace(/^QU-?/i, "")}`);

  return {
    ...base,
    quoteNumber: number,
    documentKind: mode,
    statusLabel: isNetBuy ? "Proforma" : "Invoice",
    clientName: recipient.company ?? recipient.name ?? base.clientName ?? null,
    clientCompany: recipient.company ?? base.clientCompany ?? null,
    clientBilling: recipient.address
      ? {
          line1: recipient.address.line1 ?? null,
          line2: recipient.address.line2 ?? null,
          city: recipient.address.city ?? null,
          region: recipient.address.region ?? null,
          postalCode: recipient.address.postalCode ?? null,
          country: recipient.address.country ?? null,
        }
      : base.clientBilling,
    clientContact: {
      name: recipient.name ?? null,
      role: null,
      email: recipient.email ?? null,
      phone: recipient.phone ?? null,
    },
    lines,
    subtotalCents,
    // Net mode: discount is already baked in, so don't render the discount row again.
    tradeDiscountApplied: isNetBuy ? false : base.tradeDiscountApplied,
    tradeDiscountPct: isNetBuy ? 0 : base.tradeDiscountPct,
    tierLabel: isNetBuy ? null : base.tierLabel,
    tierBreakdown: isNetBuy ? undefined : base.tierBreakdown,
    forResaleNotice: isNetBuy,
    resaleCertNumber: isNetBuy ? resaleCertNumber ?? null : null,
  };
}

export async function buildInvoicePdf(base: QuotePdfArgs, opts: BuildInvoiceOptions) {
  const args = specializeQuoteArgsForInvoice(base, opts);
  return buildQuotePdf(args);
}

export async function downloadInvoicePdf(base: QuotePdfArgs, opts: BuildInvoiceOptions) {
  const args = specializeQuoteArgsForInvoice(base, opts);
  return downloadQuotePdf(args);
}
