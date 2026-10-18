import { parsePairingFinishOptions } from "./pairingFinishPricing";

export function pairingHistoryChanges(before: Record<string, unknown> | null, after: Record<string, unknown> | null) {
  const changes: { field: string; before: string; after: string }[] = [];
  const fields = { source_category: "Primary category", target_category: "Complementary category", preferred_pick_id: "Preferred piece", sort_order: "Priority", enabled: "Active", finish_currency: "Price currency" };
  for (const [key, field] of Object.entries(fields)) {
    if (JSON.stringify(before?.[key]) !== JSON.stringify(after?.[key])) changes.push({ field, before: before?.[key] == null ? "—" : String(before[key]), after: after?.[key] == null ? "—" : String(after[key]) });
  }
  const oldOptions = parsePairingFinishOptions(before?.finish_options);
  const newOptions = parsePairingFinishOptions(after?.finish_options);
  const price = (cents: number | null, currency: unknown) => cents == null ? "Price upon Request" : `${String(currency || "USD")} ${(cents / 100).toFixed(2)}`;
  for (const id of new Set([...oldOptions, ...newOptions].map((option) => option.id))) {
    const oldOption = oldOptions.find((option) => option.id === id);
    const newOption = newOptions.find((option) => option.id === id);
    if (oldOption?.name !== newOption?.name) changes.push({ field: "Finish", before: oldOption?.name || "—", after: newOption?.name || "Removed" });
    if (oldOption?.price_cents !== newOption?.price_cents || (oldOption && newOption && before?.finish_currency !== after?.finish_currency)) changes.push({ field: `${newOption?.name || oldOption?.name} · retail price`, before: oldOption ? price(oldOption.price_cents, before?.finish_currency) : "—", after: newOption ? price(newOption.price_cents, after?.finish_currency) : "Removed" });
  }
  return changes;
}