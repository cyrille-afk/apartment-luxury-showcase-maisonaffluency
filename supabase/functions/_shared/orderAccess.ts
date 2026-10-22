export function canReadOrder(
  caller: { id: string; email?: string | null; email_confirmed_at?: string | null } | null,
  order: { user_id?: string | null; customer_email?: string | null },
): boolean {
  if (!caller?.email_confirmed_at || !caller.email) return false;
  if (order.user_id) return order.user_id === caller.id;
  return Boolean(order.customer_email) && caller.email.toLowerCase() === order.customer_email?.toLowerCase();
}