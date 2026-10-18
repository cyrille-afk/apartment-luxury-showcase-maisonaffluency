/**
 * Checkout recovery after a server-side price or availability rejection.
 *
 * The server returns a structured `recovery` hint alongside its 409. The
 * buyer's configured lines — including Curated Pairing rule/option references,
 * finishes, quantities and provenance — are kept intact; only an explicitly
 * accepted new unit price is ever applied, and only to the rejected line.
 */
export type RecoveryReason = "price_changed" | "finish_unavailable" | "unavailable";

export interface CheckoutRecovery {
  pickId: string;
  reason: RecoveryReason;
  /** Current server price in the order currency, when one unambiguous price exists. */
  currentUnitCents?: number;
  pairing?: { ruleId: string; optionId: string } | null;
}

export interface CheckoutFailure {
  message: string;
  recovery: CheckoutRecovery | null;
}

const REASONS: RecoveryReason[] = ["price_changed", "finish_unavailable", "unavailable"];

export function parseRecovery(raw: unknown): CheckoutRecovery | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.pickId !== "string" || !r.pickId) return null;
  if (!REASONS.includes(r.reason as RecoveryReason)) return null;
  const cents = Number(r.currentUnitCents);
  const p = r.pairing as Record<string, unknown> | null | undefined;
  return {
    pickId: r.pickId,
    reason: r.reason as RecoveryReason,
    currentUnitCents: Number.isInteger(cents) && cents > 0 ? cents : undefined,
    pairing: p && typeof p.ruleId === "string" && typeof p.optionId === "string" ? { ruleId: p.ruleId, optionId: p.optionId } : null,
  };
}

/** Reads the JSON body of a non-2xx function response. */
export async function readFunctionFailure(err: unknown, data: unknown, fallback: string): Promise<CheckoutFailure> {
  let body: any = data && typeof data === "object" ? data : null;
  const ctx = (err as any)?.context;
  if (!body?.error && ctx && typeof ctx.clone === "function") {
    try { body = await ctx.clone().json(); } catch { /* not JSON */ }
  }
  return {
    message: (typeof body?.error === "string" && body.error) || (err as any)?.message || fallback,
    recovery: parseRecovery(body?.recovery),
  };
}

type Line = { pickId?: string | null; pairing?: { ruleId: string; optionId: string } | null; unitCents: number };

const samePairing = (a: Line["pairing"], b: CheckoutRecovery["pairing"]) =>
  (!a && !b) || (!!a && !!b && a.ruleId === b.ruleId && a.optionId === b.optionId);

/** Index of the line the server rejected, matching pairing references exactly. */
export function findRecoveryLine<T extends Line>(lines: T[], recovery: CheckoutRecovery): number {
  return lines.findIndex((l) => l.pickId === recovery.pickId && samePairing(l.pairing ?? null, recovery.pairing ?? null));
}

/** Applies an accepted price to the rejected line only; every other field is preserved. */
export function acceptRecoveredPrice<T extends Line>(lines: T[], recovery: CheckoutRecovery): T[] | null {
  if (recovery.reason !== "price_changed" || !recovery.currentUnitCents) return null;
  const idx = findRecoveryLine(lines, recovery);
  if (idx < 0) return null;
  return lines.map((l, i) => (i === idx ? { ...l, unitCents: recovery.currentUnitCents! } : l));
}
