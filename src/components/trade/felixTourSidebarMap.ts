/**
 * Global step → sidebar mapping for the 23-step Trade onboarding tour.
 *
 * FelixTour publishes the mapped anchor on <html data-felix-tour-sidebar="…">
 * alongside data-felix-tour-step; styles.css pulses the matching
 * [data-tour-sidebar-anchor] item and the tour card prints the label so
 * members know where the feature lives in their navigation tree.
 * Both attributes are removed on pause/skip/finish, so cleanup is automatic.
 */
export type TourSidebarAnchor =
  | "dashboard"
  | "collection"
  | "quotes"
  | "projects"
  | "tools"
  | "settings"
  | "concierge"
  | "extension-sync"
  | "beta-feedboard"
  | "pwa";

export interface TourSidebarRef {
  anchor: TourSidebarAnchor;
  /** Human label shown inside the tour card ("Find it later in your sidebar"). */
  label: string;
}

export const FELIX_STEP_SIDEBAR: Record<string, TourSidebarRef> = {
  welcome: { anchor: "dashboard", label: "Dashboard" },
  collection: { anchor: "collection", label: "The Collection" },
  quotes: { anchor: "collection", label: "The Collection" },
  projects: { anchor: "projects", label: "Projects & Interventions → Projects" },
  "tier-tracking": { anchor: "dashboard", label: "Dashboard" },
  "client-safe-presentations": { anchor: "collection", label: "The Collection" },
  "margin-protection": { anchor: "collection", label: "The Collection" },
  "quote-generation": { anchor: "quotes", label: "Quotes & Proformas" },
  "direct-client-billing": { anchor: "quotes", label: "Quotes & Proformas" },
  tools: { anchor: "tools", label: "Tools" },
  settings: { anchor: "settings", label: "Settings" },
  "portfolio-management": { anchor: "projects", label: "Projects & Interventions → Projects" },
  "bespoke-commissions": { anchor: "tools", label: "Tools → Custom Requests" },
  "felix-chat": { anchor: "concierge", label: "Trade Concierge" },
  "client-view": { anchor: "projects", label: "Projects & Interventions → Projects" },
  "branding-panel": { anchor: "projects", label: "Projects & Interventions → Projects" },
  "white-label": { anchor: "projects", label: "Projects & Interventions → Projects" },
  invite: { anchor: "projects", label: "Projects & Interventions → Projects" },
  "technical-assets": { anchor: "tools", label: "Tools" },
  "priority-concierge": { anchor: "concierge", label: "Trade Concierge" },
  "ai-extension-sync": { anchor: "extension-sync", label: "AI Extension Sync" },
  "pwa-install": { anchor: "pwa", label: "Mobile App Workspace" },
  "beta-feedboard": { anchor: "beta-feedboard", label: "Beta Feedboard" },
};
