/** Stable identities own sequence; navigation must not depend on old numbers. */
export const FELIX_STEP_ORDER = [
  "welcome", "collection", "quotes", "tier-tracking",
  "client-safe-presentations", "margin-protection", "quote-generation",
  "direct-client-billing", "projects", "tools", "settings",
  "portfolio-management", "client-view", "branding-panel", "white-label",
  "invite", "bespoke-commissions", "technical-assets", "felix-chat",
  "priority-concierge", "ai-extension-sync", "pwa-install", "beta-feedboard",
] as const;

export function orderFelixSteps<T extends { id: string }>(steps: T[]): T[] {
  return FELIX_STEP_ORDER.map(id => {
    const step = steps.find(step => step.id === id);
    if (!step) throw new Error(`Missing tour step: ${id}`);
    return step;
  });
}
