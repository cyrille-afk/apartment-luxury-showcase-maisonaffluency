/**
 * Server-side resolution of the account-level checkout discount.
 *
 * Eligibility and rate are re-derived from `user_roles`, `profiles` and
 * `trade_tier_config` — a discount sent by the client is never trusted.
 * Mirrors `src/hooks/useAccountDiscount.ts` so the UI total and the amount
 * charged by Stripe agree to the cent.
 */
export interface ResolvedDiscount {
  pct: number;
  label: string | null;
}

export async function resolveAccountDiscount(
  supabaseAdmin: any,
  userId: string | null,
): Promise<ResolvedDiscount> {
  if (!userId) return { pct: 0, label: null };

  const [rolesRes, profileRes] = await Promise.all([
    supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    supabaseAdmin.from("profiles").select("trade_tier, trade_status").eq("id", userId).maybeSingle(),
  ]);

  const roles: string[] = (rolesRes.data || []).map((r: any) => String(r.role));
  const isAdmin = roles.includes("admin") || roles.includes("super_admin");
  const eligible = isAdmin || roles.includes("trade_user") || profileRes.data?.trade_status === "approved";
  if (!eligible) return { pct: 0, label: null };

  const rawTier = String(profileRes.data?.trade_tier || "silver");
  const tier = ["silver", "gold", "platinum"].includes(rawTier) ? rawTier : "silver";
  const { data: cfg } = await supabaseAdmin
    .from("trade_tier_config")
    .select("tier, discount_pct, label")
    .eq("tier", tier)
    .maybeSingle();

  const pctRaw = Number(cfg?.discount_pct);
  const fallback: Record<string, number> = { silver: 0.08, gold: 0.10, platinum: 0.15 };
  const pct = Number.isFinite(pctRaw) && pctRaw > 0 ? pctRaw : fallback[tier];
  const pretty = `${(pct * 100).toFixed((pct * 100) % 1 === 0 ? 0 : 1)}%`;
  const scope = isAdmin ? "Administrator" : `Trade · ${cfg?.label || tier}`;

  return { pct, label: `${scope} Discount (${pretty})` };
}
