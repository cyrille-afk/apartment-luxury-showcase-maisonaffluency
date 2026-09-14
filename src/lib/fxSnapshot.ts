/**
 * Shared formatter for the FX compliance snapshot.
 *
 * Consumed by both the on-screen totals block (QuoteDetail) and the printed
 * PDF (quotePdf) so the two surfaces cannot drift. If you change the wording,
 * timestamp locale, or rate precision here, both surfaces update together.
 */

export interface FxSnapshotPair {
  src: string;
  tgt: string;
  rate: number;
  source?: string | null;
}

export interface FxSnapshot {
  appliedAt: Date;
  pairs: FxSnapshotPair[];
}

const SGT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];

/**
 * Format the timestamp exactly like the QU-200169 production document:
 * "14 Sept 2026, 21:07 GMT+8" — always stated in Singapore desk time so the
 * on-screen ledger and the printed PDF quote the same moment.
 */
export function formatFxSnapshotStamp(appliedAt: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Singapore",
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(appliedAt);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const month = SGT_MONTHS[Number(get("month")) - 1] ?? get("month");
  return `${Number(get("day"))} ${month} ${get("year")}, ${get("hour")}:${get("minute")} GMT+8`;
}

/** Format a single pair: "EUR/SGD 1.4697 (frankfurter)". */
export function formatFxSnapshotPair(p: FxSnapshotPair): string {
  return `${p.src.toUpperCase()}/${p.tgt.toUpperCase()} ${p.rate.toFixed(4)}${
    p.source ? ` (${p.source})` : ""
  }`;
}


/** Full one-line audit string, identical to what the PDF prints. */
export function formatFxSnapshotLine(snap: FxSnapshot): string {
  const stamp = formatFxSnapshotStamp(snap.appliedAt);
  const pairsTxt = snap.pairs.map(formatFxSnapshotPair).join(" · ");
  return `FX applied ${stamp} — ${pairsTxt}`;
}
