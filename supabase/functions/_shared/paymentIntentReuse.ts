// Decides whether an open PaymentIntent may be updated by this caller.
// The caller must hold the intent's client secret and, when signed in, match
// the user that created it; otherwise a fresh intent is created instead.
export interface ReusableIntent {
  status: string;
  client_secret: string | null;
  currency: string;
  payment_method_types?: string[] | null;
  metadata?: Record<string, string> | null;
}

export function canReusePaymentIntent(
  existing: ReusableIntent,
  opts: { clientSecret: unknown; userId: string | null; currency: string; method: string },
): boolean {
  const updatable =
    existing.status === "requires_payment_method" || existing.status === "requires_confirmation";
  const sameMethod = (existing.payment_method_types ?? []).includes(opts.method);
  const secret = typeof opts.clientSecret === "string" ? opts.clientSecret : "";
  const owned =
    !!secret && !!existing.client_secret && secret === existing.client_secret &&
    (existing.metadata?.user_id ?? "") === (opts.userId ?? "");
  return owned && updatable && existing.currency === opts.currency && sameMethod;
}
