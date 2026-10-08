/**
 * Portal email activity: which studios were sent a tracked trade-portal link,
 * and which of them actually opened it.
 *
 * A studio counts as "not opened" only when a tracked link was sent to them and
 * nobody clicked it — studios that were never emailed are not counted either way.
 */

export type PortalLinkRow = {
  recipient_email: string;
  click_count: number | null;
  last_clicked_at: string | null;
};

export type PortalStats = {
  /** Lowercased email -> total clicks and most recent click time. */
  clicked: Record<string, { count: number; last: string }>;
  /** Lowercased emails that were sent at least one tracked portal link. */
  sent: Set<string>;
};

export type PortalFilter = "all" | "opened" | "not_opened";

const keyFor = (email: string) => email.trim().toLowerCase();

export function buildPortalStats(rows: PortalLinkRow[]): PortalStats {
  const clicked: Record<string, { count: number; last: string }> = {};
  const sent = new Set<string>();

  for (const row of rows) {
    const key = keyFor(row.recipient_email);
    if (!key) continue;
    sent.add(key);
    const count = row.click_count ?? 0;
    if (count <= 0) continue;
    const current = clicked[key] ?? { count: 0, last: "" };
    const last = row.last_clicked_at ?? "";
    clicked[key] = {
      count: current.count + count,
      last: last > current.last ? last : current.last,
    };
  }

  return { clicked, sent };
}

/** True when a tracked link sent to this email was opened at least once. */
export function hasOpenedPortal(email: string, stats: PortalStats): boolean {
  return Boolean(stats.clicked[keyFor(email)]);
}

/** True when a tracked link was sent to this email but never opened. */
export function hasNotOpenedPortal(email: string, stats: PortalStats): boolean {
  const key = keyFor(email);
  return stats.sent.has(key) && !stats.clicked[key];
}

export function accountMatchesPortalFilter(
  email: string,
  stats: PortalStats,
  filter: PortalFilter,
): boolean {
  if (filter === "all") return true;
  if (filter === "opened") return hasOpenedPortal(email, stats);
  return hasNotOpenedPortal(email, stats);
}

export function filterAccountsByPortalActivity<T extends { email: string }>(
  accounts: readonly T[],
  stats: PortalStats,
  filter: PortalFilter,
): T[] {
  if (filter === "all") return [...accounts];
  return accounts.filter((a) => accountMatchesPortalFilter(a.email, stats, filter));
}

export function portalFilterCounts(
  accounts: readonly { email: string }[],
  stats: PortalStats,
): { opened: number; notOpened: number } {
  let opened = 0;
  let notOpened = 0;
  for (const a of accounts) {
    if (hasOpenedPortal(a.email, stats)) opened += 1;
    else if (hasNotOpenedPortal(a.email, stats)) notOpened += 1;
  }
  return { opened, notOpened };
}
