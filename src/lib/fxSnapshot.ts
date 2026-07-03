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

/** Format the timestamp exactly like the PDF ("en-GB", short month, tz). */
export function formatFxSnapshotStamp(appliedAt: Date): string {
  return appliedAt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

/** Format a single pair: "EUR→SGD 1.4762 (frankfurter)". */
export function formatFxSnapshotPair(p: FxSnapshotPair): string {
  return `${p.src.toUpperCase()}→${p.tgt.toUpperCase()} ${p.rate.toFixed(4)}${
    p.source ? ` (${p.source})` : ""
  }`;
}

/** Full one-line audit string, identical to what the PDF prints. */
export function formatFxSnapshotLine(snap: FxSnapshot): string {
  const stamp = formatFxSnapshotStamp(snap.appliedAt);
  const pairsTxt = snap.pairs.map(formatFxSnapshotPair).join(" · ");
  return `FX applied ${stamp} — ${pairsTxt}`;
}
