export type FelixBriefFacts = {
  projectProfile: string;
  zone: string;
  budget: string;
};

export type FelixOnboardingGate = {
  completed: boolean;
  facts: FelixBriefFacts;
  missing: Array<keyof FelixBriefFacts>;
  source: "manual_brief" | "sequential_confirmation" | "incomplete";
};

const PLACEHOLDER_RE = /\[[^\]]*\]|^(?:n\/?a|none|unknown|tbd|e\.g\.)$/i;
const ZONE_RE = /\b(living(?: room)?|dining(?: room| area)?|salon(?: seating)?|master(?: bedroom| suite| lounge)?|bedroom|kitchen|foyer|hallway|lounge|study|library|office|bathroom|powder room|terrace|family room|media room)\b/i;
const PROFILE_RE = /\b(pre[- ]?war co-?op|co-?op|apartment|townhouse|penthouse|villa|bungalow|residence|house|home|hotel|restaurant|loft|chalet|yacht|gcb|good class bungalow)\b/i;
const BUDGET_RE = /(?:\b(?:budget|allowance|investment|spend)\b[^\n,.!?;:]{0,36})?(?:[$€£¥]|USD|EUR|GBP|SGD|CHF|AED|HKD|AUD)\s*[\d,.]+\s*(?:k|m|million|thousand)?|\b(?:open|flexible|unlimited|to be confirmed)\s*[- ]?budget\b/i;
const CONFIRM_RE = /\b(confirm(?:ed)?|lock(?:ed)?(?:\s+in)?|approved|that(?:'s| is) right|correct|proceed|yes)\b/i;

export const hasRealBriefValue = (value: string | null | undefined): boolean => {
  const clean = String(value || "").trim();
  return clean.length > 1 && !PLACEHOLDER_RE.test(clean);
};

const field = (text: string, label: string): string =>
  text.match(new RegExp(`^\\s*${label}\\s*[:—-]\\s*(.+)$`, "im"))?.[1]?.trim() || "";

export function briefFactsFromText(text: string): FelixBriefFacts {
  return {
    projectProfile: field(text, "PROJECT PROFILE"),
    zone: field(text, "ZONE"),
    budget: field(text, "BUDGET"),
  };
}

export function deriveConversationFacts(userMessages: string[]): FelixBriefFacts {
  const joined = userMessages.join("\n");
  const structured = briefFactsFromText(joined);
  const projectMatch = joined.match(PROFILE_RE);
  const zoneMatch = joined.match(ZONE_RE);
  const budgetMatch = joined.match(BUDGET_RE);
  return {
    projectProfile: structured.projectProfile || projectMatch?.[0] || "",
    zone: structured.zone || zoneMatch?.[0] || "",
    budget: structured.budget || budgetMatch?.[0] || "",
  };
}

export function evaluateFelixOnboardingGate(
  draftText: string,
  userMessages: string[],
  manualCompleted: boolean,
): FelixOnboardingGate {
  const draft = briefFactsFromText(draftText);
  const conversation = deriveConversationFacts(userMessages);
  const facts: FelixBriefFacts = {
    projectProfile: hasRealBriefValue(draft.projectProfile) ? draft.projectProfile : conversation.projectProfile,
    zone: hasRealBriefValue(draft.zone) ? draft.zone : conversation.zone,
    budget: hasRealBriefValue(draft.budget) ? draft.budget : conversation.budget,
  };
  const missing = (Object.keys(facts) as Array<keyof FelixBriefFacts>).filter((key) => !hasRealBriefValue(facts[key]));
  const sequentiallyConfirmed = missing.length === 0 && userMessages.some((message) => CONFIRM_RE.test(message));
  const completed = missing.length === 0 && (manualCompleted || sequentiallyConfirmed);
  return {
    completed,
    facts,
    missing,
    source: completed ? (manualCompleted ? "manual_brief" : "sequential_confirmation") : "incomplete",
  };
}

export const isHighLevelVisionStatement = (text: string): boolean => {
  const normalized = text.trim();
  if (!normalized || BUDGET_RE.test(normalized)) return false;
  const procurement = /\b(ff\s*&\s*e|sourc(?:e|ing)|gathering|working on|ideas?)\b/i.test(normalized);
  const vision = /\bart deco\b/i.test(normalized) && /\bpre[- ]?war\b/i.test(normalized);
  return procurement && vision;
};

export const ART_DECO_DISCOVERY_REPLY =
  "An Art Deco prewar co-op is an exceptional canvas. To structure our studio layout options accurately, let's lock in two quick technical specifications: What is our target budget range for this phase, and which specific zones (such as salon seating, dining area, or master lounge) are we curating first?";
