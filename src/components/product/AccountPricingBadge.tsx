import { useAccountDiscount } from "@/hooks/useAccountDiscount";

/**
 * Minimal luxury status badge shown only when the signed-in account
 * carries an admin role or an assigned trade tier with an active discount.
 * Renders nothing for guests or standard retail users.
 */
export function AccountPricingBadge() {
  const { eligible, badgeText } = useAccountDiscount();
  if (!eligible || !badgeText) return null;

  return (
    <span className="inline-flex items-center rounded-none border border-foreground/70 bg-foreground px-2.5 py-1 font-body text-[9px] font-medium uppercase tracking-[0.22em] text-background whitespace-nowrap">
      {badgeText}
    </span>
  );
}
