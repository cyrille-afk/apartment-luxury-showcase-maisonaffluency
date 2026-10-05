// Server-derived shipping: a checkout may only add shipping by citing an
// advisor-issued shipping quote (shipping_quotes.id) that is confirmed, not
// expired, in the order currency and owned by the
// signed-in buyer. The amount always comes from the quote row, never from the request.
// deno-lint-ignore-file no-explicit-any
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ShippingResolution =
  | { ok: true; cents: number; quoteId: string | null }
  | { ok: false; error: string };

export async function resolveConfirmedShipping(
  admin: any,
  opts: { confirmed: boolean; quoteRef: unknown; currency: string; userId: string | null },
): Promise<ShippingResolution> {
  if (!opts.confirmed) return { ok: true, cents: 0, quoteId: null };
  const ref = typeof opts.quoteRef === "string" ? opts.quoteRef.trim() : "";
  if (!UUID.test(ref)) {
    return { ok: false, error: "Enter the shipping quote reference issued by your advisor." };
  }
  const { data, error } = await admin
    .from("shipping_quotes")
    .select("id, user_id, total_cents, currency, status, valid_until")
    .eq("id", ref)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Shipping quote not found." };
  if (data.status !== "confirmed") return { ok: false, error: "This shipping quote is not confirmed yet." };
  // Ownership is mandatory: guests cannot prove they own a quote, so a
  // confirmed shipping quote can only be applied by its signed-in owner.
  if (!opts.userId || !data.user_id || data.user_id !== opts.userId) return { ok: false, error: "Shipping quote not found." };
  if (String(data.currency || "").toLowerCase() !== opts.currency.toLowerCase()) {
    return { ok: false, error: "Shipping quote currency does not match this order." };
  }
  if (data.valid_until && new Date(`${data.valid_until}T23:59:59Z`).getTime() < Date.now()) {
    return { ok: false, error: "This shipping quote has expired." };
  }
  const cents = Math.round(Number(data.total_cents) || 0);
  if (cents <= 0 || cents > 5_000_000) return { ok: false, error: "Shipping quote amount is invalid." };
  return { ok: true, cents, quoteId: data.id };
}
