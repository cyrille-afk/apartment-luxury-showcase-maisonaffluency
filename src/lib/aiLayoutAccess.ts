// AI room layout access: admins always; gold and platinum trade members too.
// Silver members use the deterministic generator instead.
export interface AiLayoutAccessInput {
  isAdmin: boolean;
  tier: string;
}

export function canUseAiLayout(status: AiLayoutAccessInput | null | undefined): boolean {
  if (!status) return false;
  return status.isAdmin || status.tier === "gold" || status.tier === "platinum";
}
