import { PUBLIC_STATUS_PAGES } from "./websiteStatus";

export const WEBSITE_SMS_RECIPIENT = "+6591393850";
export const WEBSITE_SMS_SENDER = "+15673913401";
export function websiteSmsMessage(kind: "outage" | "recovery", path: string) {
  const label = PUBLIC_STATUS_PAGES.find(page => page.path === path)?.label;
  if (!label) throw new Error("Unsupported status page");
  return `Maison Affluency: ${label} ${kind === "outage" ? "is unavailable" : "has recovered"}. https://www.maisonaffluency.com/status`;
}