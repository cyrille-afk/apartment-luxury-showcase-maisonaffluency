/** Only the daily test's exact corruption can be repaired; verification still
 * requires a current signature under the configured TEST endpoint secret. */
export async function isExpectedSmokeRejection(
  body: string,
  signature: string,
  verifyTest: (body: string, repairedSignature: string) => Promise<unknown>,
  hasAcceptedReceipt: (eventId: string) => Promise<boolean>,
): Promise<boolean> {
  if (!/^t=\d+,v1=[a-f0-9]{64}0$/.test(signature)) return false;
  try {
    const verified = await verifyTest(body, signature.slice(0, -1));
    if (!verified || typeof verified !== 'object') return false;
    const event = verified as Record<string, unknown>;
    const data = event.data as { object?: { id?: string; metadata?: { smoke?: string } } } | undefined;
    if (event.livemode !== false || event.type !== 'invoice.paid' ||
      typeof event.id !== 'string' || !/^evt_smoke_\d+$/.test(event.id) ||
      !/^in_smoke_\d+$/.test(data?.object?.id ?? '') ||
      data?.object?.metadata?.smoke !== 'api-providers.spec') return false;
    return await hasAcceptedReceipt(event.id);
  } catch { return false; }
}