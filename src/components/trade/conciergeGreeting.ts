export type Stage = "Discover" | "Tearsheet" | "Quote" | "Order" | "Project";

export type Tone = "formal" | "luxury" | "concise" | "designer";

export const TONES: { id: Tone; label: string; description: string }[] = [
  { id: "formal", label: "Formal", description: "Polished, professional, full sentences." },
  { id: "luxury", label: "Luxury", description: "Editorial, evocative, atelier voice." },
  { id: "concise", label: "Concise", description: "Brief, scannable, no flourish." },
  { id: "designer", label: "Designer-friendly", description: "Studio shorthand, peer-to-peer." },
];

export const DEFAULT_TONE: Tone = "luxury";

const TONE_STORAGE_KEY = "concierge:tone";

export const loadTone = (): Tone => {
  try {
    const raw = localStorage.getItem(TONE_STORAGE_KEY);
    if (raw && TONES.some((t) => t.id === raw)) return raw as Tone;
  } catch {}
  return DEFAULT_TONE;
};

export const saveTone = (tone: Tone) => {
  try { localStorage.setItem(TONE_STORAGE_KEY, tone); } catch {}
};

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

// ---- Intent map (route/stage -> shared meaning) ----
type Intent = "mood" | "tearsheet" | "quote" | "order" | "project" | "discover";

export const intentFor = (stage: Stage, pathname: string): Intent => {
  if (pathname.startsWith("/trade/mood-boards")) return "mood";
  if (pathname.startsWith("/trade/tearsheets") || pathname.startsWith("/trade/boards")) return "tearsheet";
  if (stage === "Quote") return "quote";
  if (stage === "Order") return "order";
  if (stage === "Project") return "project";
  return "discover";
};

// ---- Greetings: same intent, different voice ----
const GREETINGS: Record<Tone, Record<Intent, string>> = {
  formal: {
    mood: "Allow me to assist you in refining this mood board. I will propose complementary pieces grounded in what is already pinned — palette, scale, materiality — and explain the reasoning behind each suggestion.",
    tearsheet: "Allow me to assist you in shaping this tearsheet. I can add complementary pieces, suggest alternatives, or assemble a new draft from a brief — please indicate the direction.",
    quote: "Allow me to assist you in reviewing this quote. I can clarify trade pricing, lead times and deposits, and propose alternatives where appropriate.",
    order: "Allow me to assist you in following this order. I can outline production timelines, shipping milestones, and current status.",
    project: "Allow me to assist you in advancing this project. I can build tearsheets, draft quotes, or pull references against the brief.",
    discover: "Allow me to assist you in exploring the catalogue. Please describe what you are looking for and I will guide you to the most relevant pieces and designers.",
  },
  luxury: {
    mood: "Allow me to help you fine-tune your mood board — suggesting complementary pieces grounded in what's already pinned (palette, scale, materiality) and explaining why each fits. Tell me the direction you'd like to push and I'll refine.",
    tearsheet: "Allow me to help you shape this tearsheet — adding complementary pieces, swapping items for alternatives, or assembling a new draft from a brief. Tell me what you'd like to adjust and I'll propose options.",
    quote: "Allow me to help you refine this quote — clarifying trade pricing, lead times, and deposits, or proposing alternatives where it makes sense. Tell me what you'd like to review.",
    order: "Allow me to help you follow this order — production timelines, shipping milestones, and status updates. Tell me what you'd like to check.",
    project: "Allow me to help you advance this project — building tearsheets, drafting quotes, or pulling references against the brief. Tell me where you'd like to start.",
    discover: "Allow me to help you discover the catalogue — surfacing pieces, designers, or references aligned with the brief you have in mind. Tell me what you're looking for and I'll guide you.",
  },
  concise: {
    mood: "Mood board mode. I'll suggest complements based on palette, scale and materiality. Tell me the direction.",
    tearsheet: "Tearsheet mode. I can add, swap, or draft from a brief. What's needed?",
    quote: "Quote mode. Pricing, lead times, deposits, alternatives. What to review?",
    order: "Order mode. Production, shipping, status. What to check?",
    project: "Project mode. Tearsheets, quotes, references. Where to start?",
    discover: "Discovery mode. Tell me what you're after — piece, designer, or reference.",
  },
  designer: {
    mood: "Let's tune this board. I'll riff on what's pinned — palette, scale, materiality — and flag pieces that work. Tell me the move (warmer, more sculptural, lighter…) and I'll pull options.",
    tearsheet: "Let's shape this tearsheet. I can drop in complements, swap out anything off-brief, or build a fresh draft from your prompt. What direction?",
    quote: "Let's work this quote. I can break down pricing, lead times and deposits, or propose swaps. What do you want to look at?",
    order: "Let's track this order. Production, shipping milestones, status — what do you need to know?",
    project: "Let's push this project forward. Tearsheets, quotes, references — where do we start?",
    discover: "Let's find what you need. Tell me the brief — piece, designer, vibe — and I'll pull references.",
  },
};

export const greetingForContext = (stage: Stage, pathname: string, tone: Tone = DEFAULT_TONE): string => {
  const intent = intentFor(stage, pathname);
  return GREETINGS[tone]?.[intent] ?? GREETINGS[DEFAULT_TONE][intent];
};

export const DEFAULT_GREETING = greetingForContext("Discover", "/trade", DEFAULT_TONE);

// Style guidance appended to the model context so streamed answers also
// match the user's selected tone (not just the opener).
export const toneSystemNote = (tone: Tone): string => {
  switch (tone) {
    case "formal":
      return "[Style] Respond in a formal, polished register. Full sentences, precise vocabulary, no slang or emoji.";
    case "concise":
      return "[Style] Respond concisely. Prefer short sentences and tight bullets. No filler, no flourish, no emoji.";
    case "designer":
      return "[Style] Respond in a peer-to-peer designer voice — warm, fluent in studio shorthand (palette, scale, materiality, brief). Direct but never curt.";
    case "luxury":
    default:
      return "[Style] Respond in an editorial, atelier voice — evocative yet specific. Avoid clichés and avoid emoji.";
  }
};
