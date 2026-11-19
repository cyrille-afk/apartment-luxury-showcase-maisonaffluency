export type InviteActivityKind = "attempt" | "sent" | "validation_error" | "send_failed";
export interface InviteActivityDay { day: string; attempt: number; sent: number; validation_error: number; send_failed: number }

/** Buckets rows into one entry per local calendar day for the last `days` days, oldest first. */
export function bucketInviteActivity(rows: { kind: string; created_at: string }[], days: number, now = new Date()): InviteActivityDay[] {
  const key = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const out: InviteActivityDay[] = [];
  for (let i = days - 1; i >= 0; i--) { const d = new Date(now); d.setDate(d.getDate() - i); out.push({ day: key(d), attempt: 0, sent: 0, validation_error: 0, send_failed: 0 }); }
  const byDay = new Map(out.map(row => [row.day, row]));
  for (const row of rows) {
    const bucket = byDay.get(key(new Date(row.created_at)));
    if (bucket && (row.kind === "attempt" || row.kind === "sent" || row.kind === "validation_error" || row.kind === "send_failed")) bucket[row.kind] += 1;
  }
  return out;
}
