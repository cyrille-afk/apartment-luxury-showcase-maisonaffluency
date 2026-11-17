/** Only the invitation's retail projection and confirmed retail finish price enter client cards. */
export function sharedBoardPrice(item: { msrp_cents: number | null; msrp_from?: boolean }, finish?: { price_cents: number | null } | null) {
  const configured = typeof finish?.price_cents === "number" && Number.isFinite(finish.price_cents) && finish.price_cents > 0;
  return { cents: configured ? finish.price_cents : item.msrp_cents, from: !configured && item.msrp_from === true };
}