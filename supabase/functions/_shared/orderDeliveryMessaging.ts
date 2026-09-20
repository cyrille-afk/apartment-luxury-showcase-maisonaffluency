export type DeliveryTerm = "DDP" | "DDU";

export interface OrderDeliverySnapshot {
  shippingCountry?: string | null;
  deliveryTerm?: string | null;
  taxStatement?: string | null;
  importDutyCents?: number | null;
  importTaxCents?: number | null;
  importClearanceCents?: number | null;
  ddpHandlingCents?: number | null;
  importTotalCents?: number | null;
  deferredImportCents?: number | null;
}

const amount = (value: number | null | undefined) =>
  Number.isFinite(Number(value)) ? Math.max(0, Math.round(Number(value))) : 0;

export function countryName(country: string | null | undefined): string | null {
  const code = String(country ?? "").trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return null;
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? code;
  } catch {
    return code;
  }
}

export function buildOrderDeliveryMessage(snapshot: OrderDeliverySnapshot) {
  const destination = countryName(snapshot.shippingCountry);
  const term: DeliveryTerm | null = snapshot.deliveryTerm === "DDP"
    ? "DDP"
    : snapshot.deliveryTerm === "DDU"
      ? "DDU"
      : null;
  const collectedImportCents = amount(snapshot.importTotalCents);
  const deferredImportCents = amount(snapshot.deferredImportCents);
  const destinationText = destination ? ` for delivery to ${destination}` : " for the delivery destination";

  let customsStatement: string | null = null;
  if (term === "DDP") {
    customsStatement = collectedImportCents > 0
      ? `Delivered Duty Paid (DDP)${destinationText}. The listed import duty, destination tax, customs clearance and handling are prepaid by Maison Affluency; no further listed customs charges are due on delivery.`
      : `Delivered Duty Paid (DDP)${destinationText}. Maison Affluency is responsible for customs clearance and the destination import charges included in this order.`;
  } else if (term === "DDU") {
    customsStatement = deferredImportCents > 0
      ? `Delivered Duty Unpaid (DDU)${destinationText}. The estimated border charges shown are excluded from the order total and are payable by the buyer to the carrier or customs authority.`
      : `Delivered Duty Unpaid (DDU)${destinationText}. Any import duty, destination tax or customs fee assessed at the border is excluded from the order total and payable by the buyer.`;
  }

  return {
    destination,
    deliveryTerm: term,
    taxStatement: snapshot.taxStatement ?? null,
    customsStatement,
    importDutyCents: amount(snapshot.importDutyCents),
    importTaxCents: amount(snapshot.importTaxCents),
    importClearanceCents: amount(snapshot.importClearanceCents),
    ddpHandlingCents: amount(snapshot.ddpHandlingCents),
    importTotalCents: collectedImportCents,
    deferredImportCents,
  };
}