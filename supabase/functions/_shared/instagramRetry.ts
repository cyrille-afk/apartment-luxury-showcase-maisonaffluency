import { resolveStudioSource } from "./studioSource.ts";

/** Only explicit applicant-handle failures are terminal; outages remain retryable. */
export function isPermanentInstagramHandleError(detail: string): boolean {
  if (/temporary|timeout|timed out|rate limit|too many requests|\b429\b|\b5\d\d\b|connection check failed|invalid.*token|expired.*token/i.test(detail)) return false;
  return /invalid user id|not found or not a business\/creator account|(?:username|user|profile|account|handle) (?:was )?not found/i.test(detail);
}

export function shouldRetryInstagramAccount(account: {
  status: string | null;
  radar_status: string | null;
  website_or_ig: string | null;
  instagram_retry_blocked_source: string | null;
}): boolean {
  return account.status !== "approved"
    && account.radar_status === "unverified"
    && Boolean(resolveStudioSource(account.website_or_ig).instagramHandle)
    && (account.instagram_retry_blocked_source === null || account.instagram_retry_blocked_source !== account.website_or_ig);
}

export async function retryWhenInstagramWorks(
  state: string,
  claim: () => Promise<Array<{ id: string }>>,
  analyze: (id: string) => Promise<void>,
) {
  if (state !== "working") return { paused: true, attempted: 0 };
  const accounts = await claim();
  await Promise.all(accounts.map(async (account) => {
    // Individual failures never prevent another studio's verification.
    try { await analyze(account.id); } catch { /* existing evidence/score remains untouched */ }
  }));
  return { paused: false, attempted: accounts.length };
}