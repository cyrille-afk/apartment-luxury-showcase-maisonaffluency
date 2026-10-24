/** Pure grouping/evidence logic for the admin duplicate-account review. */
export interface AuthUserLike {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
  created_at?: string;
  last_sign_in_at?: string | null;
  banned_until?: string | null;
  identities?: { provider?: string; identity_data?: Record<string, unknown> | null }[] | null;
}

export interface AccountEvidence {
  userId: string;
  email: string;
  emailConfirmed: boolean;
  hasPassword: boolean;
  googleEmail: string | null;
  googleEmailVerified: boolean;
  createdAt: string | null;
  lastSignInAt: string | null;
  suspended: boolean;
}

export interface DuplicateGroup {
  key: string;
  accounts: AccountEvidence[];
}

/** Lowercase; for Gmail ignore dots and +tags (Google treats them as one inbox). */
export function emailKey(raw: unknown): string {
  if (typeof raw !== "string") return "";
  const e = raw.trim().toLowerCase();
  const at = e.lastIndexOf("@");
  if (at < 1) return "";
  let local = e.slice(0, at);
  let domain = e.slice(at + 1);
  if (domain === "googlemail.com") domain = "gmail.com";
  if (domain === "gmail.com") local = local.split("+")[0].replace(/\./g, "");
  return `${local}@${domain}`;
}

export function toEvidence(u: AuthUserLike, now = Date.now()): AccountEvidence {
  const ids = u.identities ?? [];
  const google = ids.find((i) => i.provider === "google");
  const gd = google?.identity_data ?? {};
  return {
    userId: u.id,
    email: (u.email ?? "").toLowerCase(),
    emailConfirmed: !!u.email_confirmed_at,
    hasPassword: ids.some((i) => i.provider === "email"),
    googleEmail: google ? String(gd.email ?? "").toLowerCase() || null : null,
    googleEmailVerified: google ? gd.email_verified === true || gd.email_verified === "true" : false,
    createdAt: u.created_at ?? null,
    lastSignInAt: u.last_sign_in_at ?? null,
    suspended: !!u.banned_until && new Date(u.banned_until).getTime() > now,
  };
}

/** Groups of 2+ distinct accounts sharing a normalized account or Google email. */
export function findDuplicateGroups(users: AuthUserLike[]): DuplicateGroup[] {
  const byKey = new Map<string, Set<string>>();
  const ev = new Map<string, AccountEvidence>();
  for (const u of users) {
    const e = toEvidence(u);
    ev.set(u.id, e);
    for (const k of new Set([emailKey(e.email), emailKey(e.googleEmail)])) {
      if (!k) continue;
      if (!byKey.has(k)) byKey.set(k, new Set());
      byKey.get(k)!.add(u.id);
    }
  }
  const groups: DuplicateGroup[] = [];
  for (const [key, ids] of byKey) {
    if (ids.size < 2) continue;
    groups.push({ key, accounts: [...ids].map((id) => ev.get(id)!) });
  }
  return groups.sort((a, b) => a.key.localeCompare(b.key));
}

export type ReviewDecision = "keep_both" | "suspend_duplicate" | "restore_duplicate";

/** Server-side rule for whether a decision may be applied. Returns an error message or null. */
export function validateDecision(input: {
  group: DuplicateGroup | undefined;
  primaryUserId: string;
  duplicateUserId: string;
  decision: ReviewDecision;
  passwordVerified: boolean;
  googleVerified: boolean;
  callerId: string;
  adminIds: Set<string>;
}): string | null {
  const { group, primaryUserId, duplicateUserId, decision } = input;
  if (!group) return "These accounts are no longer flagged as duplicates.";
  if (primaryUserId === duplicateUserId) return "Choose two different accounts.";
  const p = group.accounts.find((a) => a.userId === primaryUserId);
  const d = group.accounts.find((a) => a.userId === duplicateUserId);
  if (!p || !d) return "Both accounts must belong to the same duplicate group.";
  if (decision === "suspend_duplicate") {
    if (!input.passwordVerified || !input.googleVerified)
      return "Confirm both the email-and-password and Google identities before suspending.";
    const hasPw = [p, d].some((a) => a.hasPassword && a.emailConfirmed);
    const hasGoogle = [p, d].some((a) => a.googleEmail && a.googleEmailVerified);
    if (!hasPw) return "Neither account has a confirmed email-and-password sign-in.";
    if (!hasGoogle) return "Neither account has a Google identity verified by Google.";
    if (duplicateUserId === input.callerId) return "You cannot suspend your own account.";
    if (input.adminIds.has(duplicateUserId)) return "Admin accounts cannot be suspended here.";
    if (p.suspended) return "The account being kept is suspended.";
  }
  return null;
}
