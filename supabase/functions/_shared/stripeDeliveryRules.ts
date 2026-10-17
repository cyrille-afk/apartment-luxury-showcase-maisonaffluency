export const SIGNATURE_WINDOW_MINUTES = 15;
export interface DeliveryEvent { id: string; type: string; created: number; livemode: boolean }
export function missingLiveDeliveries(events: DeliveryEvent[], received: Set<string>, types: Set<string>, now: number): DeliveryEvent[] {
  return events.filter(e => e.livemode && (types.has('*') || types.has(e.type)) && now - e.created >= 120 && !received.has(e.id));
}
export function signatureSpike(count: number): boolean { return count >= 5; }
export function deliveryReasons(missing: DeliveryEvent[], signatures: number): string[] {
  const reasons: string[] = [];
  if (missing.length) reasons.push(`Live Stripe delivery failure: ${missing.length} event(s) have not reached this app. IDs: ${missing.slice(0, 10).map(e => e.id).join(', ')}`);
  if (signatureSpike(signatures)) reasons.push(`Signature verification spike: ${signatures} rejected signed requests in 15 minutes. Their live/test origin cannot be trusted before verification; check the endpoint signing secret.`);
  return reasons;
}
