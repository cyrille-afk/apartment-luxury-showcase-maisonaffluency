export type Stage = "Discover" | "Tearsheet" | "Quote" | "Order" | "Project";

export const stageFromPath = (pathname: string): Stage => {
  if (pathname.startsWith("/trade/quotes") || pathname.includes("/quote/")) return "Quote";
  if (
    pathname.startsWith("/trade/boards") ||
    pathname.startsWith("/trade/tearsheets") ||
    pathname.startsWith("/trade/mood-boards")
  )
    return "Tearsheet";
  if (pathname.startsWith("/trade/orders") || pathname.startsWith("/trade/order")) return "Order";
  if (pathname.startsWith("/trade/projects")) return "Project";
  return "Discover";
};

export const DEFAULT_GREETING =
  "Allow me to help you discover the catalogue — surfacing pieces, designers, or references aligned with the brief you have in mind. Tell me what you're looking for and I'll guide you.";

export const greetingForContext = (stage: Stage, pathname: string): string => {
  if (pathname.startsWith("/trade/mood-boards")) {
    return "Allow me to help you fine-tune your mood board — suggesting complementary pieces grounded in what's already pinned (palette, scale, materiality) and explaining why each fits. Tell me the direction you'd like to push and I'll refine.";
  }
  if (pathname.startsWith("/trade/tearsheets") || pathname.startsWith("/trade/boards")) {
    return "Allow me to help you shape this tearsheet — adding complementary pieces, swapping items for alternatives, or assembling a new draft from a brief. Tell me what you'd like to adjust and I'll propose options.";
  }
  if (stage === "Quote") {
    return "Allow me to help you refine this quote — clarifying trade pricing, lead times, and deposits, or proposing alternatives where it makes sense. Tell me what you'd like to review.";
  }
  if (stage === "Order") {
    return "Allow me to help you follow this order — production timelines, shipping milestones, and status updates. Tell me what you'd like to check.";
  }
  if (stage === "Project") {
    return "Allow me to help you advance this project — building tearsheets, drafting quotes, or pulling references against the brief. Tell me where you'd like to start.";
  }
  return DEFAULT_GREETING;
};
