export function manualFreightCents(amount: string): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(amount.trim())) return null;
  const cents = Math.round(Number(amount) * 100);
  return Number.isSafeInteger(cents) && cents > 0 && cents <= 2147483647 ? cents : null;
}

export function packingMissing(cbm: number | null, kg: number | null): boolean {
  return !(Number(cbm) > 0 || Number(kg) > 0);
}