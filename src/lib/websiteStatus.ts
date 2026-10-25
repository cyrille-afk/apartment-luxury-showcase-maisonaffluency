export const PUBLIC_STATUS_PAGES = [
  { path: "/", label: "Website" },
  { path: "/designers", label: "Designers" },
  { path: "/gallery", label: "Gallery" },
  { path: "/trade-program", label: "Trade Program" },
] as const;

export type Availability = "operational" | "unavailable" | "unknown";
export function availability(available: boolean, checkedAt: string, now: number): Availability {
  const checked = Date.parse(checkedAt);
  if (!Number.isFinite(checked) || now - checked > 10 * 60 * 1000 || checked > now + 60000) return "unknown";
  return available ? "operational" : "unavailable";
}