export type SendLogRow = {
  message_id: string | null;
  template_name: string;
  recipient_email: string;
  status: string;
  error_message: string | null;
  created_at: string;
};
export type SuppressionRow = { email: string; reason: string; created_at: string };

export type Verdict = "blocked" | "bouncing" | "spam_complaint" | "failing" | "stuck" | "healthy";

export type RecipientReport = {
  email: string;
  verdict: Verdict;
  total: number;
  sent: number;
  failed: number;
  suppressed: number;
  pending: number;
  lastSentAt: string | null;
  lastError: string | null;
  suppressionReason: string | null;
  templates: string[];
};

/** Admin alerts and internal copies (not customer-facing mail). */
export function isAdminAlertTemplate(name: string): boolean {
  return /alert|internal|copy|notification|unhealthy|parked|failure/i.test(name);
}

/** Latest row per message_id (email_send_log stores one row per state change). */
export function latestPerMessage(rows: SendLogRow[]): SendLogRow[] {
  const map = new Map<string, SendLogRow>();
  for (const r of rows) {
    if (!r.message_id) continue;
    const prev = map.get(r.message_id);
    if (!prev || r.created_at > prev.created_at) map.set(r.message_id, r);
  }
  return [...map.values()];
}

const STUCK_MS = 15 * 60 * 1000;

export function buildRecipientReports(
  rows: SendLogRow[],
  suppressions: SuppressionRow[],
  now = Date.now(),
): RecipientReport[] {
  const sup = new Map<string, SuppressionRow>();
  for (const s of suppressions) sup.set(s.email.toLowerCase(), s);
  const by = new Map<string, SendLogRow[]>();
  for (const r of latestPerMessage(rows)) {
    const k = r.recipient_email.toLowerCase();
    by.set(k, [...(by.get(k) ?? []), r]);
  }
  const out: RecipientReport[] = [];
  for (const [email, list] of by) {
    list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    const c = (pred: (s: string) => boolean) => list.filter((r) => pred(r.status)).length;
    const sent = c((s) => s === "sent");
    const failed = c((s) => ["dlq", "failed", "bounced", "complained"].includes(s));
    const suppressed = c((s) => s === "suppressed");
    const pendingRows = list.filter((r) => r.status === "pending");
    const s = sup.get(email);
    const latest = list[0];
    let verdict: Verdict = "healthy";
    if (s && /complain/i.test(s.reason)) verdict = "spam_complaint";
    else if (s && /bounce/i.test(s.reason)) verdict = "bouncing";
    else if (s || latest.status === "suppressed") verdict = "blocked";
    else if (["dlq", "failed", "bounced", "complained"].includes(latest.status)) verdict = "failing";
    else if (pendingRows.some((r) => now - Date.parse(r.created_at) > STUCK_MS)) verdict = "stuck";
    out.push({
      email,
      verdict,
      total: list.length,
      sent,
      failed,
      suppressed,
      pending: pendingRows.length,
      lastSentAt: list.find((r) => r.status === "sent")?.created_at ?? null,
      lastError: list.find((r) => r.error_message)?.error_message ?? null,
      suppressionReason: s?.reason ?? null,
      templates: [...new Set(list.map((r) => r.template_name))].sort(),
    });
  }
  const rank: Record<Verdict, number> = { spam_complaint: 0, bouncing: 1, blocked: 2, failing: 3, stuck: 4, healthy: 5 };
  return out.sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.email.localeCompare(b.email));
}
