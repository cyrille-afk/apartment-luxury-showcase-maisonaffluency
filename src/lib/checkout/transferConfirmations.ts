/**
 * Device-local record of issued bank transfer instructions + order summary,
 * so buyers can reopen them at /order-confirmation after leaving checkout.
 * Contains only what the buyer was already shown (their prices, our
 * receiving account details) — never card data or trade/net prices.
 */
export type TransferRow = { label: string; value: string };
export type TransferConfirmation = {
  reference: string;
  issuedAt: string;
  method: "wire" | "instant";
  currency: string;
  lines: { title: string; designer?: string; finishLabel?: string; quantity: number; unitCents: number }[];
  deliveryCents: number;
  taxLabel?: string;
  taxCents: number;
  totalCents: number;
  rails: { label: string; rows: TransferRow[] }[];
  hostedUrl?: string | null;
};

export const TRANSFER_CONFIRMATIONS_KEY = "ma_transfer_confirmations_v1";
export const MAX_CONFIRMATIONS = 10;
export const CONFIRMATION_TTL_DAYS = 90;

function valid(r: unknown): r is TransferConfirmation {
  const c = r as TransferConfirmation;
  return !!c && typeof c.reference === "string" && !!c.reference && typeof c.issuedAt === "string" &&
    Array.isArray(c.lines) && Array.isArray(c.rails) && Number.isFinite(c.totalCents);
}

export function listTransferConfirmations(now = Date.now()): TransferConfirmation[] {
  try {
    const raw = JSON.parse(localStorage.getItem(TRANSFER_CONFIRMATIONS_KEY) || "[]");
    if (!Array.isArray(raw)) return [];
    const cutoff = now - CONFIRMATION_TTL_DAYS * 86400000;
    return raw.filter(valid).filter(c => Date.parse(c.issuedAt) >= cutoff);
  } catch { return []; }
}

export function getTransferConfirmation(reference: string): TransferConfirmation | null {
  return listTransferConfirmations().find(c => c.reference === reference) ?? null;
}

/** Upserts by reference (latest issue wins, keeps newest first, caps the list). */
export function saveTransferConfirmation(record: TransferConfirmation, now = Date.now()) {
  if (!valid(record)) return;
  const rest = listTransferConfirmations(now).filter(c => c.reference !== record.reference);
  try {
    localStorage.setItem(TRANSFER_CONFIRMATIONS_KEY, JSON.stringify([record, ...rest].slice(0, MAX_CONFIRMATIONS)));
  } catch { /* private mode / quota — the on-screen details remain */ }
}
