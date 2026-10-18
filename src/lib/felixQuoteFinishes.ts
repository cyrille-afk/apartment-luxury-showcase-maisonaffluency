export interface FelixQuoteFinish {
  label: string;
  name: string;
  imageUrl?: string | null;
}

export function felixFinishLabel(placeholder: string | null | undefined, fallback: string) {
  return placeholder?.replace(/^select\s+(?:your|the)\s+/i, "").trim() || fallback;
}

export function felixQuoteFinishes(card: { finishes?: FelixQuoteFinish[]; fabricLabel?: string | null; baseLabel?: string | null; topLabel?: string | null }): FelixQuoteFinish[] {
  if (card.finishes) return card.finishes;
  return [
    { label: "Fabric", name: card.fabricLabel },
    { label: "Base", name: card.baseLabel },
    { label: "Top Finish", name: card.topLabel },
  ].filter((finish): finish is { label: string; name: string } => !!finish.name);
}