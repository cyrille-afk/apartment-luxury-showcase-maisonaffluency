/**
 * Resolves the account-level checkout discount for the signed-in user.
 *
 * Eligibility comes from real backend state — never from client storage:
 *   - `user_roles` → admin / super_admin / trade_user (via `useAuth`)
 *   - `trade_applications` status === "approved" (via `useAuth().tradeStatus`)
 * The rate itself comes from `profiles.trade_tier` × `trade_tier_config`
 * (see `useTradeDiscount`), so admins can edit tiers without a code change.
 *
 * The same rule is re-evaluated server-side in the `create-cart-checkout`
 * edge function — this hook only drives the display.
 */
import { useAuth } from "@/hooks/useAuth";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";

export interface AccountDiscount {
  /** True when a discount row should appear in the order summary. */
  eligible: boolean;
  /** Fractional rate, e.g. 0.08. Zero when not eligible. */
  pct: number;
  /** Row label, e.g. "Trade Discount · Silver (8%)". */
  label: string;
  /** Badge text, e.g. "Admin Pricing Active" or "Trade Silver Active". Empty when ineligible. */
  badgeText: string;
  /** Discount amount in minor units for a given subtotal. */
  amountFor: (subtotalCents: number) => number;
  /** Subtotal minus the discount. */
  totalFor: (subtotalCents: number) => number;
}

export function useAccountDiscount(): AccountDiscount {
  const { user, isTradeUser, isAdmin, isSuperAdmin, tradeStatus } = useAuth();
  const { discountPct, tierLabel, discountLabel } = useTradeDiscount();

  const eligible =
    !!user &&
    discountPct > 0 &&
    (isTradeUser || isAdmin || isSuperAdmin || tradeStatus === "approved");

  const pct = eligible ? discountPct : 0;
  const isAdminAccount = isAdmin || isSuperAdmin;
  const scope = isAdminAccount ? "Administrator" : `Trade · ${tierLabel}`;

  const amountFor = (subtotalCents: number) =>
    pct > 0 ? Math.round((subtotalCents || 0) * pct) : 0;

  return {
    eligible,
    pct,
    label: `${scope} Discount (${discountLabel})`,
    badgeText: eligible
      ? isAdminAccount
        ? "Admin Pricing Active"
        : `Trade ${tierLabel} Active`
      : "",
    amountFor,
    totalFor: (subtotalCents: number) => (subtotalCents || 0) - amountFor(subtotalCents),
  };
}
