import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { X, Send, Loader2, Sparkles, Minus, GripHorizontal, RotateCcw, Maximize2, Minimize2, Expand, Shrink, Palette, Check, Languages, Pencil, Paperclip, FileText, Download, FileDown, Copy, ShieldCheck, ListChecks, Eye, LayoutList } from "lucide-react";
import { BriefBuilder } from "@/components/trade/concierge/BriefBuilder";
import { BriefBubble, isBriefContent } from "@/components/trade/concierge/BriefBubble";
import brandCategoriesRaw from "@/data/brandCategories.json";

const SPEC_BRIEF_TEMPLATE = `Block 1 — Spatial & Project Context
PROJECT PROFILE: [typology, city/area]
ZONE: [room, ceiling height]
ENVIRONMENT: [humidity, sun exposure, glazing]
TIMELINE: Handover in [N] weeks (max lead time [N] weeks).

Block 2 — Hard Technical Parameters
TYPOLOGY: [e.g. sectional + accent chairs]
MAX FOOTPRINT: length ≤ [mm], depth ≤ [mm]
CLEARANCE: min [mm] perimeter pathway
MATERIALS: [performance criteria, exclusions]

Block 3 — Aesthetic & Visual DNA
VIBE: [e.g. Japandi-Luxe, Italian Minimalism]
REFERENCES: [e.g. Man of Parts / Collection Particulière]
PALETTE: [materials + finishes]

Block 4 — Output Execution Protocol
Return 3 layout configurations. For every piece, output a strict Architectural Specification Schedule:
Product Name · Designer · Exact mm Dimensions · Verified Finish Options · Lead Time · Cloudinary image URL · Supabase CAD/BIM URL.
No conversational intro.`;

// Detect a "project-scale" first-turn brief so the concierge can skip
// one-question intake and jump straight to the structured Brief Builder.
// Returns null when the message reads like a single-piece enquiry.
// Extract furniture typologies (sectional sofa, armchair, side table, etc.)
// from free-text so we can prefill Block 2 TYPOLOGY when the user has already
// named the pieces they're researching. Order matters: multi-word tokens
// ("side table", "floor lamp") must match before their generic parents
// ("table", "lamp") so plural/singular families are deduped correctly.
const FURNITURE_TOKEN_RE = /\b(sectional\s+sofas?|sectionals?|sofas?|settees?|loveseats?|accent\s+chairs?|arm\s*chairs?|lounge\s+chairs?|dining\s+chairs?|chairs?|side\s+tables?|coffee\s+tables?|dining\s+tables?|consoles?|desks?|tables?|benches|bench|stools?|ottomans?|poufs?|floor\s+lamps?|table\s+lamps?|pendants?|chandeliers?|sconces?|wall\s+lights?|lamps?|rugs?|mirrors?|cabinets?|sideboards?|credenzas?|shelving|bookcases?|dressers?|chests?|armoires?|beds?|headboards?|nightstands?|bedsides?)\b/gi;

function normalizeFurnitureToken(t: string): string {
  const s = t.toLowerCase().replace(/\s+/g, " ").trim();
  // Pluralize to a canonical plural form.
  if (/^sectional(\s+sofa)?s?$/.test(s)) return "sectional sofas";
  if (/^arm\s*chairs?$/.test(s)) return "armchairs";
  if (/^side\s+tables?$/.test(s)) return "side tables";
  if (/^coffee\s+tables?$/.test(s)) return "coffee tables";
  if (/^dining\s+tables?$/.test(s)) return "dining tables";
  if (/^floor\s+lamps?$/.test(s)) return "floor lamps";
  if (/^table\s+lamps?$/.test(s)) return "table lamps";
  if (/^accent\s+chairs?$/.test(s)) return "accent chairs";
  if (/^lounge\s+chairs?$/.test(s)) return "lounge chairs";
  if (/^dining\s+chairs?$/.test(s)) return "dining chairs";
  if (/^wall\s+lights?$/.test(s)) return "wall lights";
  // Generic singular→plural
  if (s.endsWith("y")) return s.slice(0, -1) + "ies";
  if (/(s|x|z|ch|sh)$/.test(s)) return s;
  if (s.endsWith("s")) return s;
  return s + "s";
}

// Suppress generic parents when a more specific sibling was already captured
// (e.g. drop "tables" when "side tables" or "coffee tables" is present).
function collapseFurnitureTokens(tokens: string[]): string[] {
  const set = new Set(tokens);
  const drop = (parent: string, ...children: string[]) => {
    if (children.some((c) => set.has(c))) set.delete(parent);
  };
  drop("tables", "side tables", "coffee tables", "dining tables");
  drop("chairs", "armchairs", "accent chairs", "lounge chairs", "dining chairs");
  drop("lamps", "floor lamps", "table lamps");
  drop("sofas", "sectional sofas");
  return Array.from(set);
}

// Sentences/clauses that explicitly defer a purchase should NOT contribute
// their furniture tokens to Typology. Examples:
//   "I'll select the rug and chandelier at a later date"
//   "excluding rugs and lighting"
//   "not the sofa for now"
//   "we'll pick the dining table later"
const DEFERRAL_RE = /\b(at a later (?:date|stage|time)|later on|later date|another time|down the (?:road|line)|for (?:a )?later|not (?:now|yet|for now)|(?:for|in) a later phase|excluding|except(?:\s+for)?|leaving out|skip(?:ping)?|omit(?:ting)?|will (?:select|pick|choose|source|find|decide|specify)\b[^.?!\n]*\b(later|another time|down the (?:road|line))|(?:pick|choose|select|source|specify|decide)\s+(?:on\s+)?(?:the\s+)?[^.?!\n]*\b(later|another time|down the (?:road|line)))\b/i;

function splitClauses(text: string): string[] {
  // Split on sentence terminators and newlines. Good enough for prose briefs.
  return text.split(/(?<=[.?!])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

function extractFurnitureTypology(text: string): string[] {
  if (!text) return [];
  const clauses = splitClauses(text);
  const kept = new Set<string>();
  const deferred = new Set<string>();
  for (const clause of clauses.length ? clauses : [text]) {
    const raw = clause.match(FURNITURE_TOKEN_RE) || [];
    const normalized = raw.map(normalizeFurnitureToken);
    const isDeferred = DEFERRAL_RE.test(clause);
    for (const tok of normalized) {
      if (isDeferred) deferred.add(tok);
      else kept.add(tok);
    }
  }
  // A token confirmed in any non-deferred clause wins over a deferred mention.
  // A token that appears ONLY in deferred clauses is dropped.
  return collapseFurnitureTokens(Array.from(kept));
}

function extractRoomFootprint(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/\b(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(m|cm|mm)?\b/i);
  if (!m) return null;
  const unit = (m[3] || "m").toLowerCase();
  const toMm = (n: number) => unit === "mm" ? n : unit === "cm" ? n * 10 : n * 1000;
  const a = toMm(parseFloat(m[1]));
  const b = toMm(parseFloat(m[2]));
  return `length ≤ ${Math.max(a, b)}mm, depth ≤ ${Math.min(a, b)}mm`;
}

function extractCeilingLabel(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/(?:(\d+(?:\.\d+)?)\s*(m|cm|mm|["'])\s*(?:high\s*)?ceiling|ceiling(?:\s*height)?(?:\s*of)?\s*(\d+(?:\.\d+)?)\s*(m|cm|mm|["']))/i);
  if (!m) return null;
  const v = m[1] || m[3];
  const u = (m[2] || m[4] || "m").toLowerCase();
  return `${v}${u} ceiling`;
}

function extractVibeLabel(text: string): string | null {
  const m = text.replace(/\s+/g, " ").match(/\b(?:in|with)\s+(?:an?\s+)?((?:(?!\b(?:in|with)\b)[a-z-]+\s+){0,6}[a-z-]+)\s+(?:manner|style|vibe|atmosphere|aesthetic)\b/i);
  return m ? m[1].replace(/\s+/g, " ").trim().toLowerCase() : null;
}

const CATALOGUE_BRANDS = Array.from(
  new Set(Object.values(brandCategoriesRaw).flat().filter((name): name is string => typeof name === "string" && !!name.trim()))
).sort((a, b) => b.length - a.length);

function normalizeBrandScanText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function escapeBrandRe(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractExplicitReferenceBrands(text: string): string[] {
  if (!text.trim()) return [];
  const haystack = normalizeBrandScanText(text);
  const found: string[] = [];
  const seen = new Set<string>();
  for (const brand of CATALOGUE_BRANDS) {
    const normalizedBrand = normalizeBrandScanText(brand);
    const re = new RegExp(`(^|[^a-z0-9])${escapeBrandRe(normalizedBrand)}([^a-z0-9]|$)`, "i");
    if (!re.test(haystack)) continue;
    const key = normalizedBrand;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push(brand);
  }
  return found;
}

function detectProjectScale(
  message: string,
  priorUserTurns: number = 0,
): { typology: string; city: string; country: string; zones: string[]; timelineWeeks: number | null; furniture: string[]; maxFootprint: string | null; ceiling: string | null; vibe: string | null } | null {
  if (!message) return null;
  const text = message.trim();

  // Strong typology keywords (GCB, penthouse, villa, etc.) reveal project scale
  // even in shortish messages like "a GCB living room" — but the trigger is
  // gated on both message length AND how many turns the user has taken so the
  // brief doesn't slam open on a passing mention.
  //
  //   • Turn 1 (priorUserTurns = 0): require 25 chars regardless — let the
  //     concierge qualify conversationally first.
  //   • Turn 2 (priorUserTurns = 1): require 14 chars + strong keyword. Blocks
  //     casual mentions like "a GCB?" (7), "not a GCB" (9), "GCB living" (10)
  //     while allowing "a GCB living room" (17), "GCB in Singapore" (16).
  //   • Turn 3+ (priorUserTurns ≥ 2): require 10 chars + strong keyword. By
  //     now the user has clearly committed to the topic.
  //
  // Also reject explicit negations ("not a GCB", "isn't a villa") which would
  // otherwise trip the keyword regex.
  const negationRe = /\b(not|isn'?t|aren'?t|no|never|without)\s+(?:a\s+|an\s+|the\s+)?(?:gcb|gbc|good class bungalow|bungalow|penthouse|pavilion|villa)\b/i;
  if (negationRe.test(text)) return null;

  // Accept common typo "GBC" as GCB (Good Class Bungalow) — Singapore-only.
  const strongTypologyRe = /\b(gcb|gbc|good class bungalow|bungalow|penthouse|pavilion|villa)\b/i;
  const hasStrongTypology = strongTypologyRe.test(text);
  const minLen = hasStrongTypology
    ? priorUserTurns >= 2 ? 10 : priorUserTurns >= 1 ? 14 : 25
    : 25;
  if (text.length < minLen) return null;

  const keywordRe = /\b(gcb|gbc|good class bungalow|bungalow|penthouse|whole[- ]?home|whole[- ]?house|multi[- ]?room|pavilion|villa|residence|to furnish|full home furnishing|entire (?:home|residence|apartment|villa|house))\b/i;
  const projectPhraseRe = /\bi(?:'m| am|'ve| have)\s+(?:got\s+)?(?:a |an )?(?:new\s+)?project\b/i;
  const zoneWords = ["living", "dining", "kitchen", "bedroom", "master", "study", "library", "foyer", "entryway", "powder", "guest", "family", "media", "lounge", "terrace", "garden", "pool", "bar", "home office", "office"];
  const zoneRe = new RegExp(`\\b(${zoneWords.join("|")})\\b`, "gi");
  const zoneMatches = Array.from(new Set((text.match(zoneRe) || []).map((z) => z.toLowerCase())));
  const longMultiZone = text.length > 120 && zoneMatches.length >= 2;

  // Extra trigger: an explicit room dimension ("6x5m", "6 x 5 m", "6×5m")
  // paired with either a strong typology keyword OR ≥2 furniture typologies
  // named in the same message — signals a real furnishing brief even when
  // only one zone is mentioned.
  const hasRoomDimensions = /\b\d{1,2}\s*[x×]\s*\d{1,2}\s*m\b/i.test(text);
  const furnitureCount = extractFurnitureTypology(text).length;
  const dimensionsBrief = hasRoomDimensions && (hasStrongTypology || furnitureCount >= 2 || zoneMatches.length >= 1);

  if (!keywordRe.test(text) && !projectPhraseRe.test(text) && !longMultiZone && !dimensionsBrief) return null;

  const isGCB = /\b(gcb|gbc|good class bungalow)\b/i.test(text);
  const typology = isGCB ? "GCB (Good Class Bungalow)"
    : /\bpenthouse\b/i.test(text) ? "Penthouse"
    : /\bvilla\b/i.test(text) ? "Villa"
    : /\bbungalow\b/i.test(text) ? "Bungalow"
    : /\bpavilion\b/i.test(text) ? "Pavilion"
    : /\bapartment\b/i.test(text) ? "Apartment"
    : /\btownhouse\b/i.test(text) ? "Townhouse"
    : /\bresidence\b/i.test(text) ? "Private residence"
    : zoneMatches.length ? `${zoneMatches[0].charAt(0).toUpperCase() + zoneMatches[0].slice(1)} project`
    : "Multi-room residence";

  // GCB is a Singapore-only typology — default city/country when the user
  // hasn't spelled it out.
  let city = "";
  let country = "";
  if (isGCB) {
    city = "Singapore";
    country = "Singapore";
  }
  const cityMatch = text.match(/\b(?:in|at|located in)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,2})\b/);
  if (cityMatch) city = cityMatch[1];

  // Timeline: "handover in 12 weeks", "in 6 weeks", "6-week", "3 months"
  let timelineWeeks: number | null = null;
  const wk = text.match(/(\d{1,3})\s*(?:-|\s)?\s*week/i);
  const mo = text.match(/(\d{1,2})\s*month/i);
  if (wk) timelineWeeks = parseInt(wk[1], 10);
  else if (mo) timelineWeeks = parseInt(mo[1], 10) * 4;

  const furniture = extractFurnitureTypology(text);
  return {
    typology,
    city,
    country,
    zones: zoneMatches,
    timelineWeeks,
    furniture,
    maxFootprint: extractRoomFootprint(text),
    ceiling: extractCeilingLabel(text),
    vibe: extractVibeLabel(text),
  };
}


import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { streamConcierge, type ChatMessage, type ChatContentPart, type TearsheetProposal, type QuoteProposal, type FfeProposal, type VisualizationBriefProposal, type ConciergeProposal, type AppliedConstraintsEvent, type MoodboardSignalsEvent } from "@/lib/tradeConciergeStream";
import { TearsheetProposalCard } from "@/components/trade/concierge/TearsheetProposalCard";
import { ProactiveTearsheetCard, type ProactiveTearsheetData } from "@/components/trade/concierge/ProactiveTearsheetCard";
import { QuoteProposalCard } from "@/components/trade/concierge/QuoteProposalCard";
import { FfeProposalCard } from "@/components/trade/concierge/FfeProposalCard";
import { VisualizationBriefCard, VIZ_BRIEF_INCOMING_KEY } from "@/components/trade/concierge/VisualizationBriefCard";
import { PendingProposalSkeleton } from "@/components/trade/concierge/PendingProposalSkeleton";
import { EscalationCard } from "@/components/trade/concierge/EscalationCard";
import { SpecScheduleBlock } from "@/components/trade/concierge/SpecScheduleBlock";
import { parseSlashCommand, SLASH_COMMAND_HELP } from "@/lib/conciergeSlashCommands";
import { openHandoffChannel } from "@/lib/conciergeHandoff";
import { useConciergeSession } from "@/hooks/useConciergeSession";
import { buildSpecSchedule, type SpecScheduleItem } from "@/lib/specScheduleBuilder";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MatchBadge, parseMatchTail, inlineSignalsIntoMatchLines } from "@/components/trade/concierge/MatchBadge";
import { buildSeedDirective } from "@/lib/conciergePrefill";
import {
  conciergeCopy,
  conciergeStatusCopy,
  isOnboardingActionPrompt,
  localizeOnboardingActions,
  localizeOnboardingMessage,
  translateWelcomeMessage,
} from "@/lib/conciergeI18n";

export type ConciergeQuickAction = { label: string; prompt: string; primary?: boolean };

export type TimelineAttachment = { name: string; kind: "image" | "pdf"; previewUrl?: string };
type PendingProposalTool =
  | "propose_tearsheet"
  | "add_to_tearsheet"
  | "draft_quote"
  | "add_to_quote"
  | "propose_ffe_rows"
  | "prepare_visualization_brief";
type TimelineItem =
  | { kind: "msg"; role: "user" | "assistant"; content: string; actions?: ConciergeQuickAction[]; onboarding?: boolean; sourceContent?: string; sourceActions?: ConciergeQuickAction[]; attachments?: TimelineAttachment[]; appliedConstraints?: AppliedConstraintsEvent; moodboardSignals?: MoodboardSignalsEvent }
  | { kind: "proposal"; proposal: TearsheetProposal; resolved?: "approved" | "discarded"; excluded?: string[]; locked?: string[]; newPickIds?: string[] }
  | { kind: "quote_proposal"; proposal: QuoteProposal; resolved?: "approved" | "discarded" }
  | { kind: "ffe_proposal"; proposal: FfeProposal; resolved?: "approved" | "discarded" }
  | { kind: "viz_brief"; proposal: VisualizationBriefProposal; resolved?: "opened" | "discarded" }
  | { kind: "pending_proposal"; tool: PendingProposalTool; toolCallId: string | null; index: number }
  | { kind: "escalation"; sentiment: string; intent: string; excerpt: ChatMessage[]; resolved?: "requested" | "dismissed" }
  | { kind: "retry"; text: string; reason: string }
  | { kind: "spec_schedule"; zone: string; markdown: string }
  | { kind: "proactive_tearsheet"; data: import("@/components/trade/concierge/ProactiveTearsheetCard").ProactiveTearsheetData; resolved?: "generated" | "boarded" | "dismissed" };



import {
  type Stage,
  type Tone,
  type Lang,
  TONES,
  tonesFor,
  loadTone,
  saveTone,
  LANGUAGES,
  loadLang,
  saveLang,
  stageFromPath,
  greetingForContext,
  PUBLIC_GREETING,
  qualifierSystemNote,
  quickClientProfile,
  toneSystemNote,
  loadName,
  saveName,
  sanitizeName,
  nameSystemNote,
  DEFAULT_NAME,
} from "./conciergeGreeting";
import { supabase } from "@/integrations/supabase/client";
import { CnBriefViewingModal } from "@/components/trade/CnBriefViewingModal";
import { useStudio } from "@/hooks/useStudio";
import { useAuth } from "@/hooks/useAuth";
import { getConciergeSession } from "@/hooks/useConciergeSession";

const hasWelcomeActions = (actions: ConciergeQuickAction[] | undefined) =>
  !!actions?.some((action) => isOnboardingActionPrompt(action.prompt));

const legacyAttachmentPlaceholderRe = /^\(shared a file\)/i;
const attachmentFailureReplyRe = /(?:couldn['’]?t|could not|can['’]?t|cannot)\s+view|vision model is momentarily busy|received your attachment/i;

const sanitizeTimelineForAttachments = (items: TimelineItem[]) =>
  items.filter((item) => {
    if (item?.kind !== "msg") return true;
    if (item.role === "user" && legacyAttachmentPlaceholderRe.test(item.content || "")) return false;
    if (item.role === "assistant" && attachmentFailureReplyRe.test(item.content || "")) return false;
    return true;
  });


export type ConciergeSurface = "trade" | "public";

export function AIConcierge({ surface = "trade", initialGreeting }: { surface?: ConciergeSurface; initialGreeting?: string } = {}) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { currentStudio } = useStudio();
  const { user, isAdmin } = useAuth();
  const { setStreamId } = useConciergeSession();
  // Realtime handoff channel disposer for the current stream_id. Recreated
  // every time the server announces a new stream via onStreamStart, and
  // torn down on unmount so we don't leak Realtime subscriptions.
  const handoffDisposeRef = useRef<null | (() => void)>(null);
  useEffect(() => () => { try { handoffDisposeRef.current?.(); } catch { /* ignore */ } }, []);
  const isDashboard = pathname === "/trade";
  // Persist open/minimized/timeline in sessionStorage so the conversation
  // survives route changes (e.g. when Felix auto-navigates to a freshly
  // created tearsheet) and any tab-internal remounts.
  const [open, setOpen] = useState(() => {
    try { return sessionStorage.getItem("concierge:open") === "1"; } catch { return false; }
  });
  const [minimized, setMinimized] = useState(() => {
    try { return sessionStorage.getItem("concierge:minimized") === "1"; } catch { return false; }
  });
  const [tone, setTone] = useState<Tone>(() => loadTone());
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [name, setName] = useState<string>(() => loadName());
  const [nameDraft, setNameDraft] = useState<string>("");
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [showBriefPreview, setShowBriefPreview] = useState(false);
  const [briefBuilderOpen, setBriefBuilderOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>(() => {
    try {
      const raw = sessionStorage.getItem("concierge:timeline");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeTimelineForAttachments(parsed as TimelineItem[]);
      }
    } catch {}
    return [
      { kind: "msg", role: "assistant", content: surface === "public" ? (initialGreeting || PUBLIC_GREETING) : greetingForContext(stageFromPath(pathname), pathname, loadTone(), loadLang()).replace(/{concierge_name}/g, name) },
    ];
  });
  const [input, setInput] = useState<string>(() => {
    try { return sessionStorage.getItem("concierge:draft") || ""; } catch { return ""; }
  });
  useEffect(() => {
    try {
      if (input) sessionStorage.setItem("concierge:draft", input);
      else sessionStorage.removeItem("concierge:draft");
    } catch {}
  }, [input]);
  const [streaming, setStreaming] = useState(false);
  // Correlation id for the currently-streaming (or most-recent) concierge
  // turn. Displayed as a copyable chip above the input so we can join
  // client-visible symptoms to server-side `concierge_inspector` log lines.
  const [lastRequestId, setLastRequestId] = useState<string | null>(null);
  const [lastInspectorCount, setLastInspectorCount] = useState<number>(0);
  const [reqIdCopied, setReqIdCopied] = useState<boolean>(false);
  const [previewCopied, setPreviewCopied] = useState<boolean>(false);
  const [stageOverride, setStageOverride] = useState<Stage | null>(null);
  const [hasTradeArtifacts, setHasTradeArtifacts] = useState<boolean | null>(null);
  const [artifactRefreshKey, setArtifactRefreshKey] = useState(0);
  const routeStage = stageFromPath(pathname);
  const isWorkflowListRouteWithoutActiveArtifact =
    pathname === "/trade/boards" ||
    pathname === "/trade/tearsheets" ||
    pathname === "/trade/mood-boards" ||
    (pathname === "/trade/quotes" && !new URLSearchParams(search).get("quote"));
  // Only downgrade the stage to Discover on empty workflow list routes while
  // the conversation is still pristine (no user turn yet). Once the user has
  // started chatting, keep the stage stable so async artifact counts flipping
  // mid-stream can't rewrite the greeting or drop in-flight messages.
  const hasUserTurn = timeline.some((t) => t.kind === "msg" && t.role === "user");
  const noWorkflowArtifactsContext =
    !hasUserTurn &&
    surface === "trade" &&
    (isWorkflowListRouteWithoutActiveArtifact || hasTradeArtifacts === false) &&
    (routeStage === "Tearsheet" || routeStage === "Quote");
  const contextualPath = noWorkflowArtifactsContext ? "/trade" : pathname;
  const contextualRouteStage: Stage = noWorkflowArtifactsContext ? "Discover" : routeStage;
  const stage: Stage = stageOverride ?? contextualRouteStage;
  const currentGreeting = useCallback((targetLang: Lang = lang) => (
    surface === "public"
      ? (initialGreeting || PUBLIC_GREETING)
      : greetingForContext(stage, contextualPath, tone, targetLang).replace(/{concierge_name}/g, name)
  ), [surface, initialGreeting, stage, contextualPath, tone, lang, name]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STALL_MS = 45_000; // no delta/proposal in 45s ⇒ treat stream as stalled

  // Edit-mode state for the "Detected from your upload" signals card. Keyed
  // by timeline index. `signalsDraft` holds the in-progress edits so the user
  // can correct materials / colors / style before re-matching.
  const [editingSignalsIdx, setEditingSignalsIdx] = useState<number | null>(null);
  const [signalsDraft, setSignalsDraft] = useState<MoodboardSignalsEvent | null>(null);

  const clearStallTimer = useCallback(() => {
    if (stallTimerRef.current) {
      clearTimeout(stallTimerRef.current);
      stallTimerRef.current = null;
    }
  }, []);

  const pushRetry = useCallback((text: string, reason: string) => {
    // Drop any orphaned empty assistant bubble so the retry card stands alone.
    setTimeline((prev) => {
      let copy = prev;
      const last = prev[prev.length - 1];
      if (last?.kind === "msg" && last.role === "assistant" && !last.content?.trim()) {
        copy = prev.slice(0, -1);
      }
      // Never stack two retry cards in a row for the same text.
      const tail = copy[copy.length - 1];
      if (tail?.kind === "retry" && tail.text === text) return copy;
      return [...copy, { kind: "retry", text, reason }];
    });
  }, []);

  // -------- Attachments (room plans, mood images, PDFs) --------
  type StagedAttachment = {
    id: string;
    name: string;
    mime: string;
    kind: "image" | "pdf";
    /** data URL (data:<mime>;base64,...) ready to send to the vision model */
    dataUrl: string;
    /** UI preview — same as dataUrl for images, undefined for PDFs */
    previewUrl?: string;
    size: number;
    /** Optional semantic role, e.g. "moodboard" to bind to Block 3 of a spec brief. */
    role?: "moodboard";
  };
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB per file — base64 inflates ~33%
  const MAX_ATTACHMENTS = 4;
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const moodInputRef = useRef<HTMLInputElement>(null);

  // Mandarin director hand-off state.
  const [cnViewingOpen, setCnViewingOpen] = useState(false);
  const cnBriefFiredRef = useRef(false);
  const cnLastBriefUserTurnRef = useRef(0);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  // Build a small (max 480px, JPEG q=0.72) preview so it fits in sessionStorage
  // and inline-renders in the transcript even after a reload. The full-res
  // dataUrl is still what we ship to the vision model.
  const buildThumbnailDataUrl = (dataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      try {
        const img = new Image();
        img.onload = () => {
          const MAX = 480;
          const scale = Math.min(1, MAX / Math.max(img.width, img.height));
          const w = Math.max(1, Math.round(img.width * scale));
          const h = Math.max(1, Math.round(img.height * scale));
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          if (!ctx) return resolve(dataUrl);
          ctx.drawImage(img, 0, 0, w, h);
          try {
            resolve(canvas.toDataURL("image/jpeg", 0.72));
          } catch {
            resolve(dataUrl);
          }
        };
        img.onerror = () => resolve(dataUrl);
        img.src = dataUrl;
      } catch {
        resolve(dataUrl);
      }
    });

  const handleFilesPicked = useCallback(async (
    files: FileList | File[] | null,
    opts?: { role?: "moodboard"; imagesOnly?: boolean },
  ) => {
    if (!files) return [] as StagedAttachment[];
    const list = Array.from(files);
    if (!list.length) return [] as StagedAttachment[];
    const accepted: StagedAttachment[] = [];
    for (const f of list) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
        break;
      }
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
      if (opts?.imagesOnly && !isImage) {
        toast.error(`${f.name}: mood board must be an image.`);
        continue;
      }
      if (!isImage && !isPdf) {
        toast.error(`${f.name}: only images and PDFs are supported.`);
        continue;
      }
      if (f.size > MAX_ATTACHMENT_BYTES) {
        toast.error(`${f.name} is too large (max 8 MB).`);
        continue;
      }
      try {
        const dataUrl = await readFileAsDataUrl(f);
        const previewUrl = isImage ? await buildThumbnailDataUrl(dataUrl) : undefined;
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          mime: f.type || (isPdf ? "application/pdf" : "image/jpeg"),
          kind: isImage ? "image" : "pdf",
          dataUrl,
          previewUrl,
          size: f.size,
          ...(opts?.role ? { role: opts.role } : {}),
        });
      } catch {
        toast.error(`Couldn't read ${f.name}.`);
      }
    }
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (moodInputRef.current) moodInputRef.current.value = "";
    return accepted;
  }, [attachments.length]);

  /**
   * Insert or update a "MOOD BOARD REFERENCE:" line inside Block 3 of the
   * spec brief. If Block 3 isn't present, append a minimal Block 3 stub.
   * Merges names across all currently-staged mood board attachments.
   */
  const upsertMoodBoardBlock3 = useCallback((allMoodNames: string[]) => {
    const refLine = allMoodNames.length
      ? `MOOD BOARD REFERENCE: ${allMoodNames.join(", ")}`
      : "";
    setInput((prev) => {
      const text = prev ?? "";
      // Strip any prior MOOD BOARD REFERENCE line anywhere.
      const stripped = text.replace(/^\s*MOOD BOARD REFERENCE:.*$/gim, "").replace(/\n{3,}/g, "\n\n");
      if (!refLine) return stripped.trimEnd();
      // Find Block 3 header and insert the reference line right after it.
      const block3Regex = /^(Block\s+3\b[^\n]*)$/im;
      if (block3Regex.test(stripped)) {
        return stripped.replace(block3Regex, `$1\n${refLine}`);
      }
      // No Block 3 yet — append a minimal stub so the reference has a home.
      const sep = stripped.trim() ? "\n\n" : "";
      return `${stripped.trimEnd()}${sep}Block 3 — Aesthetic & Visual DNA\n${refLine}`;
    });
  }, []);

  const handleMoodBoardPicked = useCallback(async (files: FileList | File[] | null) => {
    const added = await handleFilesPicked(files, { role: "moodboard", imagesOnly: true });
    if (!added.length) return;
    // Compose the current + newly-added mood board names.
    const names = [
      ...attachments.filter((a) => a.role === "moodboard").map((a) => a.name),
      ...added.map((a) => a.name),
    ];
    upsertMoodBoardBlock3(names);
    toast.success(added.length === 1 ? "Mood board attached to Block 3." : `${added.length} mood board images attached to Block 3.`);
  }, [handleFilesPicked, attachments, upsertMoodBoardBlock3]);

  const removeAttachment = (id: string) =>
    setAttachments((prev) => {
      const target = prev.find((a) => a.id === id);
      const next = prev.filter((a) => a.id !== id);
      if (target?.role === "moodboard") {
        const remainingMoodNames = next.filter((a) => a.role === "moodboard").map((a) => a.name);
        // Defer to avoid setState-in-setState.
        setTimeout(() => upsertMoodBoardBlock3(remainingMoodNames), 0);
      }
      return next;
    });


  // Draggable position — persisted in localStorage. `null` = use default
  // bottom-right anchor; once user drags, we switch to absolute top/left.
  const [expanded, setExpanded] = useState<boolean>(() => {
    try {
      const v = localStorage.getItem("concierge:expanded");
      return v === null ? true : v === "1";
    } catch { return true; }
  });
  const [fullscreen, setFullscreen] = useState<boolean>(() => {
    try { return localStorage.getItem("concierge:fullscreen") === "1"; } catch { return false; }
  });
  // When the tearsheet card opens its Insights sidebar it needs the concierge
  // panel to be at its wide 560px size so the sidebar sits alongside instead
  // of overlapping. We temporarily force-expand without persisting, and
  // restore the user's prior preference on close.
  const [insightsForcedExpand, setInsightsForcedExpand] = useState(false);
  const priorExpandedRef = useRef<boolean | null>(null);
  useEffect(() => {
    const onInsights = (e: Event) => {
      const detail = (e as CustomEvent<{ open: boolean }>).detail;
      if (!detail) return;
      if (detail.open) {
        if (!insightsForcedExpand) {
          priorExpandedRef.current = expanded;
          setInsightsForcedExpand(true);
          setExpanded(true);
        }
      } else if (insightsForcedExpand) {
        setInsightsForcedExpand(false);
        if (priorExpandedRef.current !== null) setExpanded(priorExpandedRef.current);
        priorExpandedRef.current = null;
      }
    };
    window.addEventListener("maf:concierge:insights", onInsights as EventListener);
    return () => window.removeEventListener("maf:concierge:insights", onInsights as EventListener);
  }, [expanded, insightsForcedExpand]);

  // Auto-expand the panel while the Brief Builder is open so the four blocks
  // aren't cramped, and restore the user's prior expanded preference on close.
  const [briefForcedExpand, setBriefForcedExpand] = useState(false);
  const priorExpandedForBriefRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (briefBuilderOpen) {
      if (!briefForcedExpand) {
        priorExpandedForBriefRef.current = expanded;
        setBriefForcedExpand(true);
        setExpanded(true);
      }
    } else if (briefForcedExpand) {
      setBriefForcedExpand(false);
      if (priorExpandedForBriefRef.current !== null) setExpanded(priorExpandedForBriefRef.current);
      priorExpandedForBriefRef.current = null;
    }
  }, [briefBuilderOpen]);

  // Soft-check the structured brief. Only TYPOLOGY matters for readiness;
  // everything else is optional and must never block sending.
  const briefValidation = useMemo(() => {
    if (!briefBuilderOpen) return { valid: true, missing: [] as string[] };
    const text = input;
    const required: { label: string; key: string }[] = [{ label: "TYPOLOGY", key: "Typology" }];
    const missing: string[] = [];
    for (const { label, key } of required) {
      const re = new RegExp(`^${label}:\\s*(.*)$`, "im");
      const m = text.match(re);
      const val = (m?.[1] || "").trim();
      // Invalid when empty OR the value still reads as a bracketed template
      // placeholder like "[typology, city/area]", "[room, ceiling height]",
      // "[e.g. sectional + accent chairs]".
      const isPlaceholder = !val || /^\[[^\]]*\]$/.test(val);
      if (isPlaceholder) missing.push(key);
    }
    return { valid: missing.length === 0, missing };
  }, [briefBuilderOpen, input]);



  const PANEL_H_MIN = 52;
  const [pos, setPos] = useState<{ x: number; y: number } | null>(() => {
    try {
      const raw = localStorage.getItem("concierge:pos");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  });
  const dragRef = useRef<{ dx: number; dy: number } | null>(null);

  // First-login welcome: render as a centered modal with a soft backdrop so
  // the entry point is unmistakable instead of a small bottom-right widget.
  // Dismissal is persisted in localStorage (`ma:welcome-dismissed`) so a page
  // refresh during the same first-login session never re-opens the modal.
  const [welcomePending, setWelcomePending] = useState<boolean>(() => {
    try {
      if (localStorage.getItem("ma:welcome-dismissed") === "1") return false;
      return localStorage.getItem("ma:welcome-pending") === "1";
    } catch { return false; }
  });
  useEffect(() => {
    const onPending = () => {
      try {
        if (localStorage.getItem("ma:welcome-dismissed") === "1") return;
      } catch {
        // If storage is unavailable, still navigate so the user can continue manually.
      }
      setWelcomePending(true);
    };
    const onDismissed = () => {
      try {
        localStorage.setItem("ma:welcome-dismissed", "1");
        localStorage.removeItem("ma:welcome-pending");
      } catch {}
      setWelcomePending(false);
    };
    window.addEventListener("ma:welcome-pending", onPending);
    window.addEventListener("ma:welcome-dismissed", onDismissed);
    return () => {
      window.removeEventListener("ma:welcome-pending", onPending);
      window.removeEventListener("ma:welcome-dismissed", onDismissed);
    };
  }, []);
  // Modal mode is active only while the welcome is pending AND the user
  // hasn't manually dragged or expanded the panel yet.
  const modalMode = welcomePending && !pos;

  // Panel dimensions. On first-open the concierge renders as a centered
  // welcome modal — size it like the fullscreen panel so it never covers
  // the left navigation. Otherwise fall back to fullscreen or the
  // expanded/compact widget.
  const PANEL_W = (fullscreen || modalMode)
    ? Math.min(1200, typeof window !== "undefined" ? window.innerWidth - 32 : 1200)
    : (expanded ? 560 : 380);
  const PANEL_H_OPEN = modalMode ? 760 : (expanded ? 760 : 560);

  // Brief exit-animation gate: when the welcome modal is dismissed we keep
  // the backdrop + panel mounted for ~280ms so they can fade/scale out
  // smoothly before unmounting.
  const [welcomeClosing, setWelcomeClosing] = useState(false);
  const closeWelcomeModal = useCallback(() => {
    if (welcomeClosing) return;
    setWelcomeClosing(true);
    window.setTimeout(() => {
      setOpen(false);
      setWelcomeClosing(false);
      try {
        localStorage.setItem("ma:welcome-dismissed", "1");
        localStorage.removeItem("ma:welcome-pending");
      } catch {}
      window.dispatchEvent(new CustomEvent("ma:welcome-dismissed"));
    }, 280);
  }, [welcomeClosing]);

  const clampPos = useCallback((x: number, y: number) => {
    const h = minimized ? PANEL_H_MIN : PANEL_H_OPEN;
    const maxX = Math.max(8, window.innerWidth - PANEL_W - 8);
    const maxY = Math.max(8, window.innerHeight - h - 8);
    return { x: Math.min(Math.max(8, x), maxX), y: Math.min(Math.max(8, y), maxY) };
  }, [minimized]);

  const onDragStart = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only react to primary button / touch
    if (e.button !== undefined && e.button !== 0) return;
    const panel = (e.currentTarget.closest("[data-concierge-panel]") as HTMLElement) || null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    dragRef.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const next = clampPos(e.clientX - dragRef.current.dx, e.clientY - dragRef.current.dy);
    setPos(next);
  };
  const onDragEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {}
    if (pos) {
      try { localStorage.setItem("concierge:pos", JSON.stringify(pos)); } catch {}
    }
  };

  // Persist concierge open/minimized/timeline so it survives navigation.
  useEffect(() => {
    try { sessionStorage.setItem("concierge:open", open ? "1" : "0"); } catch {}
  }, [open]);
  useEffect(() => {
    try { sessionStorage.setItem("concierge:minimized", minimized ? "1" : "0"); } catch {}
  }, [minimized]);
  useEffect(() => {
    try {
      // previewUrl is now a downscaled JPEG thumbnail (~<60KB), safe to persist.
      // If serialization fails (quota), retry once with thumbnails stripped.
      const payload = JSON.stringify(timeline);
      try {
        sessionStorage.setItem("concierge:timeline", payload);
      } catch {
        const stripped = timeline.map((t) =>
          t.kind === "msg" && t.attachments?.length
            ? { ...t, attachments: t.attachments.map(({ previewUrl: _omit, ...rest }) => rest) }
            : t,
        );
        sessionStorage.setItem("concierge:timeline", JSON.stringify(stripped));
      }
    } catch {}
  }, [timeline]);
  useEffect(() => {
    setTimeline((prev) => {
      const cleaned = sanitizeTimelineForAttachments(prev);
      return cleaned.length === prev.length ? prev : cleaned;
    });
  }, []);

  // If the user deletes all project folders/tearsheets and quotes, the trade
  // tools routes should no longer keep Felix in a stale tearsheet/quote mode.
  useEffect(() => {
    if (surface !== "trade") return;
    let cancelled = false;
    const refresh = async () => {
      if (!user) {
        if (!cancelled) setHasTradeArtifacts(false);
        return;
      }
      const scope = (query: any) => {
        if (currentStudio?.id) return query.or(`studio_id.eq.${currentStudio.id},and(studio_id.is.null,user_id.eq.${user.id})`);
        return query.eq("user_id", user.id);
      };
      const [boardsRes, quotesRes] = await Promise.all([
        scope(
          supabase
            .from("client_boards")
            .select("id", { count: "exact", head: true }),
        ),
        scope(
          supabase
            .from("trade_quotes")
            .select("id", { count: "exact", head: true })
            .neq("status", "cancelled"),
        ),
      ]);
      if (cancelled) return;
      if (boardsRes.error || quotesRes.error) {
        console.warn("[concierge] workflow artifact count failed", boardsRes.error || quotesRes.error);
        setHasTradeArtifacts(null);
        return;
      }
      setHasTradeArtifacts(((boardsRes.count || 0) + (quotesRes.count || 0)) > 0);
    };
    refresh();
    const onArtifactsChanged = () => setArtifactRefreshKey((v) => v + 1);
    window.addEventListener("concierge:artifacts-changed", onArtifactsChanged);
    return () => {
      cancelled = true;
      window.removeEventListener("concierge:artifacts-changed", onArtifactsChanged);
    };
  }, [surface, user, currentStudio?.id, artifactRefreshKey]);

  // Keep panel inside viewport on resize
  useEffect(() => {
    if (!pos) return;
    const onResize = () => setPos((p) => (p ? clampPos(p.x, p.y) : p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [pos, clampPos]);

  // Refresh the opening greeting whenever the route changes — but only while
  // the conversation is still pristine (a single assistant message). Once the
  // user has interacted, we leave the timeline alone.
  useEffect(() => {
    setTimeline((prev) => {
      if (prev.length !== 1) return prev;
      const only = prev[0];
      if (only.kind !== "msg" || only.role !== "assistant") return prev;
      const contextGreeting = currentGreeting(lang);
      if (only.onboarding || hasWelcomeActions(only.actions)) {
        const sourceContent = only.sourceContent ?? only.content;
        const sourceActions = only.sourceActions ?? only.actions;
        // If the cached onboarding greeting was for a different route/intent
        // (e.g. tearsheet greeting persisted from a prior page), swap it for
        // the greeting that matches the current route instead of just
        // re-localizing the stale one.
        const cachedIntentGreeting = currentGreeting("en");
        const staleIntent = sourceContent !== cachedIntentGreeting
          && sourceContent !== contextGreeting
          && !sourceActions?.length;
        if (staleIntent) {
          return [{ kind: "msg", role: "assistant", content: contextGreeting }];
        }
        const next: TimelineItem = {
          ...only,
          onboarding: true,
          sourceContent,
          sourceActions,
          content: localizeOnboardingMessage(sourceContent, lang),
          actions: localizeOnboardingActions(sourceActions, lang, name),
        };
        if (only.content === next.content && only.actions === next.actions && only.onboarding) return prev;
        return [next];
      }
      if (only.actions && only.actions.length > 0) return prev;
      if (only.content === contextGreeting) return prev;
      return [{ kind: "msg", role: "assistant", content: contextGreeting }];
    });
    // If the welcome is a custom (non-templated) message and we don't yet have a
    // cached translation for the chosen language, fetch one in the background
    // and patch the timeline when it arrives.
    if (lang !== "en") {
      setTimeline((prev) => {
        const only = prev[0];
        if (!only || only.kind !== "msg" || !only.onboarding) return prev;
        const source = only.sourceContent ?? only.content;
        if (only.content !== source) return prev; // already translated
        // Kick off async translation
        translateWelcomeMessage(source, lang).then((translated) => {
          if (translated === source) return;
          setTimeline((cur) => {
            const item = cur[0];
            if (!item || item.kind !== "msg" || !item.onboarding) return cur;
            if ((item.sourceContent ?? item.content) !== source) return cur;
            return [{ ...item, content: translated }, ...cur.slice(1)];
          });
        });
        return prev;
      });
    }
  }, [pathname, tone, lang, name, currentGreeting]);

  // Reset any sticky stage override when the route changes
  useEffect(() => { setStageOverride(null); }, [pathname]);

  // Close tone/lang menus when clicking outside the panel
  useEffect(() => {
    if (!toneMenuOpen && !langMenuOpen) return;
    const onDoc = (e: MouseEvent) => {
      const panel = (e.target as HTMLElement | null)?.closest("[data-concierge-panel]");
      if (!panel) {
        setToneMenuOpen(false);
        setLangMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [toneMenuOpen, langMenuOpen]);

  // auto-scroll — scroll to bottom when a new timeline entry is appended or
  // when the last message's streaming content grows. Do NOT scroll when an
  // existing proposal entry mutates in place (e.g. skipping a pick), which
  // was yanking the user down to the input on every Skip click.
  const lastTimelineLenRef = useRef(0);
  const lastMsgLenRef = useRef(0);
  useEffect(() => {
    const last = timeline[timeline.length - 1];
    const lastLen = last && last.kind === "msg" ? last.content.length : 0;
    const grew = timeline.length > lastTimelineLenRef.current
      || (timeline.length === lastTimelineLenRef.current && lastLen > lastMsgLenRef.current);
    if (grew) {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
    lastTimelineLenRef.current = timeline.length;
    lastMsgLenRef.current = lastLen;
  }, [timeline]);

  // focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  // Listen for stage-change events from elsewhere in the app (e.g. user
  // creates a quote from a tearsheet). We append an assistant note so the
  // concierge stays in sync with the user's current workflow stage.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as
        | { message?: string; openPanel?: boolean; closeBriefBuilder?: boolean; stage?: Stage; actions?: ConciergeQuickAction[]; resetPanel?: boolean; replaceTimeline?: boolean; onboarding?: boolean; prefill?: string; autoSend?: boolean; displayMessage?: string }
        | undefined;
      const message = detail?.message?.trim();
      if (detail?.resetPanel) {
        setPos(null);
        setExpanded(false);
        setMinimized(false);
        setNameMenuOpen(false);
        setToneMenuOpen(false);
        setLangMenuOpen(false);
        try {
          localStorage.removeItem("concierge:pos");
          localStorage.removeItem("concierge:expanded");
        } catch {}
      }
      if (message) {
        const welcomeMessage: TimelineItem = {
          kind: "msg",
          role: "assistant",
          content: detail?.onboarding ? localizeOnboardingMessage(message, lang) : message,
          actions: detail?.actions && detail.actions.length > 0
            ? detail.onboarding
              ? localizeOnboardingActions(detail.actions, lang, name)
              : detail.actions
            : undefined,
          onboarding: !!detail?.onboarding,
          sourceContent: detail?.onboarding ? message : undefined,
          sourceActions: detail?.onboarding ? detail?.actions : undefined,
        };
        setTimeline((prev) => (detail?.replaceTimeline ? [welcomeMessage] : [...prev, welcomeMessage]));
      }
      if (detail?.stage) setStageOverride(detail.stage);
      if (detail?.openPanel) setOpen(true);
      if (detail?.closeBriefBuilder) setBriefBuilderOpen(false);

      // Prefill support — used by per-SKU "Swap" buttons on the concierge
      // cards. Two modes:
      //   • default: drop the text into the composer and focus it so the
      //     user can review/edit before pressing send.
      //   • autoSend: fire the prompt behind the scenes and show only a
      //     short human-readable displayMessage in the transcript so the
      //     user isn't confronted with the raw system prompt.
      if (typeof detail?.prefill === "string" && detail.prefill.trim().length > 0) {
        setMinimized(false);
        setOpen(true);
        if (detail.autoSend) {
          const display = detail.displayMessage?.trim() || "…";
          // Fire and forget — send() handles its own streaming state.
          void sendRef.current?.(detail.prefill, { displayText: display });
        } else {
          setInput(detail.prefill);
          setTimeout(() => {
            const el = inputRef.current;
            if (el) {
              el.focus();
              const len = el.value.length;
              try { el.setSelectionRange(len, len); } catch { /* jsdom */ }
              el.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
          }, 60);
        }
      }

    };
    window.addEventListener("concierge:stage", handler as EventListener);
    return () => window.removeEventListener("concierge:stage", handler as EventListener);
  }, []);

  // Proactive tearsheet nudge — dispatched by product pages after a short
  // idle following finish changes. Opens the panel and drops a lightweight
  // spec card into the transcript. See ProactiveTearsheetCard.
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<ProactiveTearsheetData>).detail;
      if (!detail || !detail.productId) return;
      setMinimized(false);
      setOpen(true);
      setTimeline((prev) => {
        // Replace any previous unresolved proactive card for the same
        // product so rapid re-nudges don't stack up.
        const next = prev.filter(
          (t) => !(t.kind === "proactive_tearsheet" && !t.resolved && t.data.productId === detail.productId),
        );
        next.push({ kind: "proactive_tearsheet", data: detail });
        return next;
      });
    };
    window.addEventListener("concierge:propose_tearsheet_proactive", handler as EventListener);
    return () => window.removeEventListener("concierge:propose_tearsheet_proactive", handler as EventListener);
  }, []);

  // Auto-close Felix while the Quick Tour is running so its panel never
  // overlaps the page being highlighted (especially the Tools step).
  useEffect(() => {
    const close = () => { setOpen(false); setMinimized(false); };
    window.addEventListener("trade-tour:start", close);
    window.addEventListener("concierge:close", close);
    return () => {
      window.removeEventListener("trade-tour:start", close);
      window.removeEventListener("concierge:close", close);
    };
  }, []);

  // Sync concierge name with the user's profile so it follows them across devices.
  useEffect(() => {
    let cancelled = false;
    const sync = async () => {
      const { data: sess } = await supabase.auth.getSession();
      const uid = sess.session?.user?.id;
      if (!uid) return;
      const { data } = await supabase
        .from("profiles")
        .select("concierge_name")
        .eq("id", uid)
        .maybeSingle();
      if (cancelled) return;
      const remote = sanitizeName(((data as any)?.concierge_name as string) || "");
      if (remote) {
        setName((prev) => (prev === remote ? prev : remote));
        saveName(remote);
      } else {
        // No remote value yet — push local-only value up so other devices see it.
        const local = loadName();
        if (local && local !== DEFAULT_NAME) {
          await supabase.from("profiles").update({ concierge_name: local }).eq("id", uid);
        }
      }
    };
    sync();
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "INITIAL_SESSION") return;
      if (event === "SIGNED_IN") sync();
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistName = useCallback(async (value: string) => {
    const previous = loadName();
    const saved = saveName(value);
    setName(saved);
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("concierge:name-changed", { detail: saved }));
    }
    if (saved !== previous) {
      const message = saved === DEFAULT_NAME
        ? `Noted — I'll go back to ${DEFAULT_NAME} from now on.`
        : `Noted — I'll answer to ${saved} from now on.`;
      setTimeline((prev) => [...prev, { kind: "msg", role: "assistant", content: message }]);
    }
    const { data: sess } = await supabase.auth.getSession();
    const uid = sess.session?.user?.id;
    if (!uid) return saved;
    const toStore = saved === DEFAULT_NAME ? null : saved;
    await supabase.from("profiles").update({ concierge_name: toStore }).eq("id", uid);
    return saved;
  }, []);

  const openLatestQuote = useCallback(async () => {
    let query = supabase
      .from("trade_quotes")
      .select("id")
      .in("status", ["draft", "submitted", "priced", "confirmed"])
      .order("updated_at", { ascending: false })
      .limit(1);
    if (currentStudio?.id) {
      query = query.or(`studio_id.eq.${currentStudio.id},studio_id.is.null`);
    }
    const { data, error } = await query.maybeSingle();
    if (error || !data?.id) {
      toast.error("I couldn't find a quote to open.");
      return false;
    }
    navigate(`/trade/quotes?quote=${data.id}`);
    setTimeline((prev) => [
      ...prev,
      { kind: "msg", role: "assistant", content: "Opening your quote now." },
    ]);
    return true;
  }, [currentStudio?.id, navigate]);

  const send = useCallback(async (overrideText?: string, opts?: { displayText?: string }) => {
    const text = (overrideText ?? input).trim();

    // Allow sending with attachments only (no text) — use a tiny default prompt.
    const hasFiles = attachments.length > 0;
    if (!text && !hasFiles) return;
    if (streaming) return;

    // Prompt-detect Mandarin: if the user writes in Chinese, auto-switch the
    // concierge reply language to zh. Threshold ~4 Han chars OR ≥30% of the
    // message so short mixed-language phrases don't false-positive. Persist so
    // subsequent turns stay in Mandarin until the user changes the picker.
    let effectiveLang: Lang = lang;
    if (text) {
      const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
      const letters = text.replace(/\s/g, "").length;
      const zhDetected = han >= 4 || (letters > 0 && han / letters >= 0.3);
      if (zhDetected && lang !== "zh") {
        effectiveLang = "zh" as Lang;
        setLang(effectiveLang);
        try { saveLang(effectiveLang); } catch {}
      }
    }

    // Server-side concierge endpoints require an authenticated Maison Affluency
    // member. Block the stream client-side too so the UI never fires a request
    // that will 401.
    if (!user) {
      toast.error("Access restricted", {
        description: "The Concierge is available to Maison Affluency members only.",
      });
      setTimeline((prev) => [
        ...prev,
        {
          kind: "msg",
          role: "assistant",
          content: "Access restricted — the Concierge is available to Maison Affluency members only.",
        },
      ]);
      return;
    }



    // Client-side slash commands — deterministic, never call the LLM.
    // Keep this ABOVE all `__concierge:*` intercepts and above streamConcierge.
    if (text.startsWith("/")) {
      const parsed = parseSlashCommand(text);
      if (parsed) {
        setInput("");
        // Echo the user's command in the transcript so the exchange is legible.
        setTimeline((prev) => [...prev, { kind: "msg", role: "user", content: text }]);

        if (parsed.kind === "help") {
          setTimeline((prev) => [
            ...prev,
            { kind: "msg", role: "assistant", content: SLASH_COMMAND_HELP },
          ]);
          return;
        }

        if (parsed.kind === "spec_schedule") {
          try {
            // 1. Resolve target tearsheet (client_boards).
            //    Priority: caller-supplied board hint (id prefix OR title match),
            //    else the most-recently-updated non-converted board.
            let boardQuery = supabase
              .from("client_boards")
              .select("id, title, user_id, status")
              .eq("user_id", user.id)
              .order("updated_at", { ascending: false })
              .limit(20);

            const { data: boards, error: boardsErr } = await boardQuery;
            if (boardsErr) throw new Error(boardsErr.message);
            if (!boards || boards.length === 0) {
              setTimeline((prev) => [
                ...prev,
                {
                  kind: "msg",
                  role: "assistant",
                  content:
                    "No tearsheets found on your account yet — create one from the Concierge or the tearsheet page, then run `/spec-schedule` again.",
                },
              ]);
              return;
            }

            const hint = parsed.boardHint?.toLowerCase() ?? null;
            const target = hint
              ? boards.find(
                  (b) =>
                    b.id.toLowerCase().startsWith(hint) ||
                    (b.title ?? "").toLowerCase().includes(hint),
                ) ?? null
              : boards.find((b) => b.status !== "converted") ?? boards[0];

            if (!target) {
              setTimeline((prev) => [
                ...prev,
                {
                  kind: "msg",
                  role: "assistant",
                  content: `No tearsheet matched \`board:${parsed.boardHint}\`. Try \`/spec-schedule\` alone to use your most recent tearsheet.`,
                },
              ]);
              return;
            }

            // 2. Fetch items + products.
            const { data: itemRows, error: itemsErr } = await supabase
              .from("client_board_items")
              .select("product_id, sort_order")
              .eq("board_id", target.id)
              .order("sort_order", { ascending: true });
            if (itemsErr) throw new Error(itemsErr.message);
            const productIds = (itemRows ?? []).map((r) => r.product_id).filter(Boolean);
            if (!productIds.length) {
              setTimeline((prev) => [
                ...prev,
                {
                  kind: "msg",
                  role: "assistant",
                  content: `Tearsheet **${target.title}** is empty — add pieces to it, then run \`/spec-schedule\` again.`,
                },
              ]);
              return;
            }

            const { data: products, error: prodErr } = await supabase
              .from("trade_products")
              .select(
                "id, product_name, brand_name, category, subcategory, width_mm, depth_mm, height_mm, seat_height_mm, materials, available_finishes, lead_time_weeks_min, lead_time_weeks_max, lead_time, is_contract_grade, image_url, spec_sheet_url, sku, source_pick_id",
              )
              .in("id", productIds);
            if (prodErr) throw new Error(prodErr.message);

            // 3. Enrich with designer names via source_pick_id -> designers.
            const pickIds = (products ?? [])
              .map((p) => p.source_pick_id)
              .filter((x): x is string => !!x);
            const designerByProductId = new Map<string, string>();
            if (pickIds.length) {
              const { data: picks } = await supabase
                .from("designer_curator_picks")
                .select("id, designer_id, designers:designer_id(display_name, name)")
                .in("id", pickIds);
              const pickToDesigner = new Map<string, string>();
              (picks ?? []).forEach((p: any) => {
                const d = p.designers;
                const name = (d?.display_name ?? d?.name ?? "").trim();
                if (name) pickToDesigner.set(p.id, name);
              });
              (products ?? []).forEach((p) => {
                if (p.source_pick_id && pickToDesigner.has(p.source_pick_id)) {
                  designerByProductId.set(p.id, pickToDesigner.get(p.source_pick_id)!);
                }
              });
            }

            // 4. Preserve tearsheet sort order.
            const orderIndex = new Map<string, number>();
            (itemRows ?? []).forEach((r, i) => orderIndex.set(r.product_id, i));
            const ordered = [...(products ?? [])].sort(
              (a, b) => (orderIndex.get(a.id) ?? 0) - (orderIndex.get(b.id) ?? 0),
            );

            const items: SpecScheduleItem[] = ordered.map((p) => ({
              product_name: p.product_name ?? null,
              designer: designerByProductId.get(p.id) ?? null,
              brand_name: p.brand_name ?? null,
              category: p.category ?? null,
              subcategory: p.subcategory ?? null,
              width_mm: p.width_mm ?? null,
              depth_mm: p.depth_mm ?? null,
              height_mm: p.height_mm ?? null,
              seat_height_mm: p.seat_height_mm ?? null,
              materials: p.materials ?? null,
              available_finishes: p.available_finishes ?? null,
              lead_time_weeks_min: p.lead_time_weeks_min ?? null,
              lead_time_weeks_max: p.lead_time_weeks_max ?? null,
              lead_time: p.lead_time ?? null,
              is_contract_grade: p.is_contract_grade ?? null,
              image_url: p.image_url ?? null,
              spec_sheet_url: p.spec_sheet_url ?? null,
              sku: p.sku ?? null,
            }));

            const zone = parsed.zone ?? target.title ?? "Untitled Zone";
            const markdown = buildSpecSchedule(zone, items);

            setTimeline((prev) => [
              ...prev,
              { kind: "spec_schedule", zone, markdown },
            ]);
            return;
          } catch (err: any) {
            setTimeline((prev) => [
              ...prev,
              {
                kind: "msg",
                role: "assistant",
                content: `Couldn't build the specification schedule — ${err?.message ?? "unknown error"}.`,
              },
            ]);
            return;
          }
        }
      }
      // Unknown /command — fall through and send to concierge as normal.
    }

    // Special intercepts: client-side actions instead of model calls

    if (text === "__concierge:rename__") {
      setNameDraft(name === DEFAULT_NAME ? "" : name);
      setNameMenuOpen(true);
      setInput("");
      return;
    }
    if (text === "__concierge:start_tour__") {
      setInput("");
      const fire = () => window.dispatchEvent(new Event("trade-tour:start"));
      if (window.location.pathname !== "/trade") {
        window.history.pushState({}, "", "/trade");
        window.dispatchEvent(new PopStateEvent("popstate"));
        setTimeout(fire, 350);
      } else {
        fire();
      }
      setTimeline((prev) => [
        ...prev,
        { kind: "msg", role: "assistant", content: conciergeStatusCopy("tour", lang) },
      ]);
      return;
    }
    if (text === "__concierge:start_brief__") {
      setInput("");
      window.dispatchEvent(new Event("trade-brief:open"));
      setTimeline((prev) => [
        ...prev,
        { kind: "msg", role: "assistant", content: conciergeStatusCopy("brief", lang) },
      ]);
      return;
    }

    const normalized = text.toLowerCase().replace(/[.!?]/g, "").trim();
    const lastAssistantText = [...timeline]
      .reverse()
      .find((t): t is Extract<TimelineItem, { kind: "msg" }> => t.kind === "msg" && t.role === "assistant")
      ?.content.toLowerCase() || "";
    const isQuoteNavigationFollowup =
      ["yes", "y", "take me there", "open it", "open quote", "review and edit"].includes(normalized) &&
      lastAssistantText.includes("quote") &&
      (lastAssistantText.includes("quote builder") || lastAssistantText.includes("take you there") || lastAssistantText.includes("review and edit"));
    if (isQuoteNavigationFollowup) {
      setTimeline((prev) => [...prev, { kind: "msg", role: "user", content: text }]);
      setInput("");
      await openLatestQuote();
      return;
    }

    const latestVisualizationBrief = [...timeline]
      .reverse()
      .find((t): t is Extract<TimelineItem, { kind: "viz_brief" }> => t.kind === "viz_brief" && t.resolved !== "discarded");
    const isVisualizationGenerateFollowup = ["generate", "render", "render scene", "open studio", "axonometric"].includes(normalized);
    if (latestVisualizationBrief && isVisualizationGenerateFollowup) {
      try {
        sessionStorage.setItem(
          VIZ_BRIEF_INCOMING_KEY,
          JSON.stringify({
            ...latestVisualizationBrief.proposal.args,
            overlay_image_urls: latestVisualizationBrief.proposal.preview.map((p) => p.image_url).filter(Boolean),
            savedAt: Date.now(),
          }),
        );
      } catch {}
      setTimeline((prev) => [
        ...prev,
        { kind: "msg", role: "user", content: text },
        { kind: "msg", role: "assistant", content: isAdmin ? "Opening Axonometric Studio with the brief loaded. If the page button is disabled, add a source image first." : "Opening the 3D Studio request form with the brief prefilled — review the details and submit when ready." },
      ]);
      setInput("");
      setAttachments([]);
      window.dispatchEvent(new Event("maf:axonometric:brief-ready"));
      navigate(isAdmin ? "/trade/axonometric" : "/trade/axonometric-requests");
      return;
    }

    // Show the user bubble with text and inline thumbnails for any attached files.
    const timelineAttachments: TimelineAttachment[] = attachments.map((a) => ({
      name: a.name,
      kind: a.kind,
      previewUrl: a.previewUrl,
    }));
    const submittedStructuredBrief = isBriefContent(text);
    const apiText = submittedStructuredBrief
      ? [
          "SUBMITTED ARCHITECTURAL BRIEF — this is the active client brief from the Brief Builder. Execute it now; do not reply that no brief was detected.",
          "Return three layout configurations and a full Architectural Specification Schedule using the structured fields below.",
          text,
        ].join("\n\n")
      : text;
    const displayText = opts?.displayText ?? text;
    const userItem: TimelineItem = {
      kind: "msg",
      role: "user",
      content: displayText,
      ...(timelineAttachments.length ? { attachments: timelineAttachments } : {}),
    };
    const nextTimeline = [...timeline, userItem];
    setTimeline(nextTimeline);
    setInput("");
    // Snapshot + clear attachments now so the input chips disappear immediately.
    const sendingAttachments = attachments;
    setAttachments([]);
    setStreaming(true);

    // If the Brief Builder was open, tuck it away on send with a light
    // wink from the concierge so the user knows they can reopen it to
    // adjust the brief. Missing fields no longer block submission — they
    // become soft signals we surface inside the wink.
    if (briefBuilderOpen) {
      setBriefBuilderOpen(false);
      const missing = briefValidation.missing;
      const winkBase = "Brief tucked away for now — tap the brief icon anytime to reopen and refine it.";
      const winkMissing = missing.length
        ? ` Fields left blank: ${missing.join(", ")} — happy to work with what you gave me.`
        : "";
      setTimeline((prev) => [
        ...prev,
        { kind: "msg", role: "assistant", content: `${winkBase}${winkMissing}` },
      ]);
    }

    // First user turn — fire invisible qualifier + lead capture (non-blocking).
    const isFirstUserTurn = !timeline.some((t) => t.kind === "msg" && t.role === "user");
    if (isFirstUserTurn) {
      try {
        let sid = sessionStorage.getItem("concierge:sid");
        if (!sid) {
          sid = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
          sessionStorage.setItem("concierge:sid", sid);
        }
        supabase.functions.invoke("concierge-capture", {
          body: {
            surface,
            session_id: sid,
            first_message: text,
            path: typeof window !== "undefined" ? window.location.pathname : null,
            referrer: typeof document !== "undefined" ? document.referrer || null : null,
          },
        }).then(({ data }) => {
          if (data && typeof data === "object") {
            try { sessionStorage.setItem("concierge:profile", JSON.stringify(data)); } catch {}
          }
        }).catch((e) => console.warn("[concierge-capture]", e));
      } catch (e) { console.warn("[concierge-capture] setup", e); }
    }

    // Project-scale auto-detection — whenever the user's message reads as a
    // whole-home / multi-room project brief AND the Brief Builder isn't
    // already open AND no tearsheet has been proposed yet, skip the slow
    // one-question-at-a-time intake and open the Architectural Brief Builder
    // with the detected typology/city prefilled. Not gated to turn 1, and
    // deliberately not gated by a persistent sessionStorage flag: if the user
    // closes the builder and later types another project-scale message, it
    // should re-open.
    const hasProposal = timeline.some((t) => t.kind === "proposal" || t.kind === "quote_proposal" || t.kind === "ffe_proposal");
    if (!hasProposal && !briefBuilderOpen && sendingAttachments.length === 0) {


      const priorUserTurns = timeline.filter((t) => t.kind === "msg" && (t as any).role === "user").length;
      const scale = detectProjectScale(text, priorUserTurns);
      if (scale) {
        // Fallback city: (a) synchronous qualifier on current text,
        // (b) any prior user turn's text (e.g. user answered "Singapore" on
        // turn 1, then "furnish my GCB" on turn 2), (c) captured profile.
        let city = scale.city;
        let country = scale.country;
        if (!city) {
          const quick = quickClientProfile(text);
          if (quick?.city) city = quick.city;
          if (quick?.country) country = country || quick.country;
        }
        if (!city) {
          const priorUserText = timeline
            .filter((t): t is Extract<TimelineItem, { kind: "msg" }> => t.kind === "msg" && t.role === "user")
            .map((t) => t.content || "")
            .join(" \n ");
          if (priorUserText) {
            const priorQuick = quickClientProfile(priorUserText);
            if (priorQuick?.city) city = priorQuick.city;
            if (priorQuick?.country) country = country || priorQuick.country;
            // Also try a bare capitalized city token ("Singapore", "London")
            if (!city) {
              const bare = priorUserText.match(/\b(Singapore|London|Paris|New York|Hong Kong|Dubai|Monaco|Los Angeles|Miami|Bangkok|Jakarta|Kuala Lumpur|Tokyo|Sydney|Milan|Geneva|Zurich)\b/);
              if (bare) city = bare[1];
            }
          }
        }

        const profileLine = [scale.typology, [city, country].filter(Boolean).filter((v, i, arr) => arr.indexOf(v) === i).join(", ")]
          .filter(Boolean)
          .join(", ");

        // Zone line — capitalize + join detected zones (e.g. "Living, Dining, Master")
        const zoneLine = scale.zones.length
          ? `${scale.zones.map((z) => z.charAt(0).toUpperCase() + z.slice(1)).join(", ")}${scale.ceiling ? ` — ${scale.ceiling}` : " — ceiling height [mm]"}`
          : null;

        // Timeline line
        const timelineLine = scale.timelineWeeks
          ? `Handover in ${scale.timelineWeeks} weeks (max lead time [N] weeks).`
          : null;

        let prefilled = SPEC_BRIEF_TEMPLATE.replace("[typology, city/area]", profileLine || "[typology, city/area]");
        if (zoneLine) {
          prefilled = prefilled.replace("[room, ceiling height]", zoneLine);
        }
        if (timelineLine) {
          prefilled = prefilled.replace(
            "Handover in [N] weeks (max lead time [N] weeks).",
            timelineLine,
          );
        }
        if (scale.maxFootprint) {
          prefilled = prefilled.replace("length ≤ [mm], depth ≤ [mm]", scale.maxFootprint);
        }
        if (scale.vibe) {
          prefilled = prefilled.replace("[e.g. Japandi-Luxe, Italian Minimalism]", scale.vibe);
        }

        // Merge furniture typologies from the current message + every prior
        // user turn so pieces named earlier ("sectional sofas, armchairs,
        // side and coffee tables") still land in Block 2 TYPOLOGY.
        const priorFurnitureText = timeline
          .filter((t): t is Extract<TimelineItem, { kind: "msg" }> => t.kind === "msg" && t.role === "user")
          .map((t) => t.content || "")
          .join(" \n ");
        const explicitReferenceBrands = extractExplicitReferenceBrands([text, priorFurnitureText].filter(Boolean).join(" \n "));
        const mergedFurniture = collapseFurnitureTokens(
          Array.from(new Set([...(scale.furniture || []), ...extractFurnitureTypology(priorFurnitureText)])),
        );
        if (mergedFurniture.length) {
          prefilled = prefilled.replace(
            "[e.g. sectional + accent chairs]",
            mergedFurniture.join(", "),
          );
        }
        if (explicitReferenceBrands.length) {
          prefilled = prefilled.replace(
            "[e.g. Man of Parts / Collection Particulière]",
            explicitReferenceBrands.join(" / "),
          );
        }

        setInput(prefilled);
        // Force all three brief-builder sections expanded on auto-open so
        // the prefilled fields are visible immediately — no hidden Block 2/3.
        try {
          const scope = sessionStorage.getItem("trade:lastProjectFilter") || "global";
          const expanded = JSON.stringify({ block1: true, block2: true, block3: true });
          localStorage.setItem(`concierge:briefBuilder:expanded:${scope}`, expanded);
          localStorage.setItem("concierge:briefBuilder:expanded", expanded);
        } catch {}
        setBriefBuilderOpen(true);
        try { sessionStorage.removeItem("concierge:briefAutoOpened"); } catch {}


        const noted = [
          scale.typology,
          city ? `city: ${city}` : null,
          scale.zones.length ? `zones: ${scale.zones.join(", ")}` : null,
          mergedFurniture.length ? `pieces: ${mergedFurniture.join(", ")}` : null,
          scale.timelineWeeks ? `${scale.timelineWeeks}-week handover` : null,
        ].filter(Boolean).join(" · ");

        setTimeline((prev) => [
          ...prev,
          {
            kind: "msg",
            role: "assistant",
            content: `A project of this scale deserves a structured brief${noted ? ` — noted **${noted}**` : ""}. I've opened the Architectural Brief Builder and prefilled what I picked up. Fill in footprint, materials, and aesthetic direction, then send it back and I'll return three layout configurations with a full Architectural Specification Schedule.`,
          },
        ]);
        setStreaming(false);
        return;
      }
    }




    // Build the chat message history for the API (text-only items),
    // prefixed with a lightweight stage-context note so the assistant
    // always references the user's current workflow stage.
    const stageContext: ChatMessage = {
      role: "user",
      content: `[Workflow context] Current stage: ${stage}. Tailor guidance to this stage and reference it explicitly when helpful.`,
    };

    // Discover-stage tolerance: the greeting asks for the project city, but
    // users frequently answer off-script (naming a piece, a designer, a room,
    // a style, or a general question) on turn 1. Do NOT loop back demanding
    // the city, do NOT stall, and do NOT emit a "stopped responding" style
    // dead-end. Accept whatever the user said, act on it, and — if a
    // qualifier (city / room / typology) is still missing — fold ONE brief
    // confirmation into the SAME reply while continuing to build the brief.
    const discoverToleranceContext: ChatMessage[] =
      stage === "Discover"
        ? [{
            role: "user",
            content:
              "[Discover-stage rule] The greeting invited the user to share a project city. If their reply does not answer that (e.g. they name a specific piece, a designer, a room, a style, a question, or anything else), DO NOT re-ask the city as a blocking gate and DO NOT reply with a scripted fallback. Instead: (1) acknowledge what they actually said and act on it — if they named a piece, discuss that piece; if they named a style/room, engage with it; (2) if the city (or another key qualifier like room or typology) is still unknown, weave ONE short, single-sentence confirmation into the same reply — e.g. \"— and, so I can tailor shipping and pricing, which city is the project in?\" — never as a standalone re-prompt; (3) keep moving the brief forward on the next turn even if the user still hasn't answered the qualifier. Never ask the same qualifier twice.",
          }]
        : [];



    // Find the most recent proposal (resolved or not) so we can tell the
    // model which items the user kept vs removed. Without this context the
    // model regenerates a fresh selection on every follow-up turn, which
    // looks like it "forgets" the user's edits.
    const lastProposal = [...timeline].reverse().find((t): t is Extract<TimelineItem, { kind: "proposal" }> => t.kind === "proposal");
    const currentTextLower = text.toLowerCase();
    const isFreshOpeningBrief = /^\s*(?:i(?:'m| am)?\s+(?:looking|searching|after|hunting|sourcing|in the market)|we(?:'re| are)?\s+(?:looking|searching|after))\b/.test(currentTextLower);
    const referencesCurrentDraft = /\b(refine|replace|swap|remove|keep|kept|add|another|more|alternative|option|selection|tearsheet|draft|edit|these|this|that|same|board)\b/.test(currentTextLower);
    const proposalContext: ChatMessage[] = [];
    if (lastProposal && !isFreshOpeningBrief && referencesCurrentDraft) {
      const excludedSet = new Set(lastProposal.excluded || []);
      const lockedSet = new Set(lastProposal.locked || []);
      const kept = lastProposal.proposal.preview.filter((p) => !excludedSet.has(p.id));
      const removed = lastProposal.proposal.preview.filter((p) => excludedSet.has(p.id));
      const locked = lastProposal.proposal.preview.filter((p) => lockedSet.has(p.id) && !excludedSet.has(p.id));
      const fmt = (p: { id: string; title: string; designer_name: string | null }) =>
        `  - "${p.title}" by ${p.designer_name || "—"} [id: ${p.id}]`;
      const lines: string[] = [
        `[Current tearsheet draft state — preserve KEPT items verbatim in any new proposal.]`,
        `KEPT (must remain in the next proposal, with the SAME ids):`,
        kept.length ? kept.map(fmt).join("\n") : "  (none)",
      ];
      if (locked.length) {
        lines.push(
          `LOCKED 🔒 (frozen by the architect — retain these EXACT pick_ids verbatim, do NOT substitute, do NOT alter):`,
          locked.map(fmt).join("\n"),
        );
      }
      if (removed.length) {
        lines.push(
          `REMOVED by the user (do NOT bring these back unless the user explicitly re-requests them):`,
          removed.map(fmt).join("\n"),
        );
      }
      lines.push(
        `When the user asks for a replacement or a new search, build the next proposal as: KEPT ids + the NEW pieces you suggest. Do not silently drop kept items, do not re-introduce removed items.`,
      );
      proposalContext.push({ role: "user", content: lines.join("\n") });

      // Seed extraction (#4) — mine manual edit signals for repeated
      // material/designer patterns. If we find any, inject as a soft directive
      // so the next generation leans into what the user anchored and steers
      // away from what they rejected.
      const toItem = (p: { id: string; title: string; designer_name: string | null; materials: string | null }) => ({
        pick_id: p.id,
        title: p.title,
        designer_name: p.designer_name,
        materials: p.materials,
      });
      const seedDirective = buildSeedDirective(locked.map(toItem), removed.map(toItem));
      if (seedDirective) {
        proposalContext.push({ role: "user", content: seedDirective });
      }
    }

    const toneContext: ChatMessage = { role: "user", content: toneSystemNote(tone, lang) };
    const nameNote = nameSystemNote(name);
    const identityContext: ChatMessage[] = nameNote ? [{ role: "user", content: nameNote }] : [];

    // Turn 2+: inject the invisible visitor profile captured on turn 1 so
    // the model adapts tone/proposals (high-value city, intent) without
    // re-asking qualifying questions. Stored by concierge-capture above.
    const profileContext: ChatMessage[] = [];
    if (isFirstUserTurn) {
      // Synchronous client-side qualifier so the FIRST reply already adapts
      // to high-value signals (e.g. "townhouse in Belgravia") without waiting
      // for the async concierge-capture round-trip.
      const quick = quickClientProfile(text);
      if (quick) {
        const note = qualifierSystemNote({
          name: null,
          city: quick.city,
          country: quick.country,
          intent: quick.intent,
          signals: quick.signals,
          qualified_score: quick.qualified_score,
        });
        if (note) profileContext.push({ role: "user", content: note });
      }
    } else {
      try {
        const raw = sessionStorage.getItem("concierge:profile");
        if (raw) {
          const q = JSON.parse(raw);
          const note = qualifierSystemNote({
            name: q.name ?? null,
            city: q.city ?? null,
            country: q.country ?? null,
            intent: q.intent ?? null,
            signals: Array.isArray(q.signals) ? q.signals : null,
            qualified_score: typeof q.qualified_score === "number" ? q.qualified_score : null,
          });
          if (note) profileContext.push({ role: "user", content: note });
        }
      } catch { /* ignore */ }
    }

    // Build chat-completions messages. The current user turn becomes
    // multimodal (text + image_url / file parts) when files are attached.
    // Prior turns are kept text-only — we never carry image bytes forward
    // because (a) tokens explode, (b) the model already "saw" them once.
    const priorMsgs = nextTimeline
      .slice(0, -1)
      .filter((t): t is Extract<TimelineItem, { kind: "msg" }> => t.kind === "msg")
      .filter((t) => !(t.role === "user" && legacyAttachmentPlaceholderRe.test(t.content || "")))
      .filter((t) => !(t.role === "assistant" && attachmentFailureReplyRe.test(t.content || "")))
      .map((t) => ({ role: t.role, content: t.content as string | ChatContentPart[] }));

    let currentUserMsg: ChatMessage;
    if (sendingAttachments.length > 0) {
      const parts: ChatContentPart[] = [];
      parts.push({ type: "text", text: apiText || "Please review the attached file(s) and tell me what details would help refine your curation." });
      for (const a of sendingAttachments) {
        if (a.kind === "image") {
          parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
        } else {
          parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
        }
      }
      currentUserMsg = { role: "user", content: parts };
    } else {
      currentUserMsg = { role: "user", content: apiText };
    }

    const messagesForApi: ChatMessage[] = [
      stageContext,
      ...discoverToleranceContext,
      toneContext,
      ...identityContext,
      ...profileContext,
      ...proposalContext,
      ...priorMsgs,
      currentUserMsg,
    ];

    let assistantSoFar = "";
    let assistantStarted = false;
    const controller = new AbortController();
    abortRef.current = controller;

    // Stall watchdog: if the stream produces no delta/proposal/escalation
    // for STALL_MS, abort the request and surface a retry card so the user
    // isn't left staring at a silent spinner (e.g. edge IDLE_TIMEOUT).
    const armStall = () => {
      clearStallTimer();
      stallTimerRef.current = setTimeout(() => {
        try { controller.abort(); } catch {}
        setStreaming(false);
        clearStallTimer();
        pushRetry(text, "The concierge stopped responding.");
      }, STALL_MS);
    };
    armStall();

    // Track hard-constraint pre-filters applied to catalog retrieval for
    // this turn. Emitted by the edge function once, near the start of the
    // SSE stream. Attached to the assistant msg so the UI can show chips.
    let turnConstraints: AppliedConstraintsEvent | null = null;
    let turnMoodboardSignals: MoodboardSignalsEvent | null = null;

    const upsertAssistant = (chunk: string) => {
      armStall();
      assistantSoFar += chunk;
      setTimeline((prev) => {
        if (assistantStarted) {
          // Update the last assistant text bubble (which must be the last item)
          const idx = prev.length - 1;
          const last = prev[idx];
          if (last?.kind === "msg" && last.role === "assistant") {
            const copy = prev.slice();
            copy[idx] = { ...last, content: assistantSoFar, appliedConstraints: turnConstraints ?? last.appliedConstraints, moodboardSignals: turnMoodboardSignals ?? last.moodboardSignals };
            return copy;
          }
        }
        assistantStarted = true;
        return [...prev, { kind: "msg", role: "assistant", content: assistantSoFar, appliedConstraints: turnConstraints ?? undefined, moodboardSignals: turnMoodboardSignals ?? undefined }];
      });
    };

    // Map tool names → the pending kinds we swap them into. Tearsheet lives
    // under the plain "proposal" kind; the others each have their own.
    const swapPendingWithReal = (
      prev: TimelineItem[],
      toolCallId: string | null,
      toolName: string,
      real: TimelineItem,
    ): TimelineItem[] => {
      // Prefer exact tool_call_id match; fall back to the first pending item
      // of the same tool name (streaming may emit tool_start without an id).
      let matchIdx = -1;
      if (toolCallId) {
        matchIdx = prev.findIndex(
          (t) => t.kind === "pending_proposal" && t.toolCallId === toolCallId,
        );
      }
      if (matchIdx === -1) {
        matchIdx = prev.findIndex(
          (t) => t.kind === "pending_proposal" && t.tool === toolName,
        );
      }
      if (matchIdx === -1) return [...prev, real];
      const copy = prev.slice();
      copy[matchIdx] = real;
      return copy;
    };

    const handleProposal = (proposal: ConciergeProposal) => {
      armStall();
      const tcid = proposal.tool_call_id ?? null;
      if (proposal.tool === "draft_quote" || proposal.tool === "add_to_quote") {
        setTimeline((prev) => swapPendingWithReal(prev, tcid, proposal.tool, { kind: "quote_proposal", proposal }));
        return;
      }
      if (proposal.tool === "propose_ffe_rows") {
        setTimeline((prev) => swapPendingWithReal(prev, tcid, proposal.tool, { kind: "ffe_proposal", proposal }));
        return;
      }
      if (proposal.tool === "prepare_visualization_brief") {
        setTimeline((prev) => swapPendingWithReal(prev, tcid, proposal.tool, { kind: "viz_brief", proposal }));
        return;
      }
      // Tearsheet proposal — compute which picks are NEW relative to the
      // previous proposal so the card can highlight rationales for replacements only.
      const prevIds = new Set(
        lastProposal ? lastProposal.proposal.preview.map((p) => p.id) : [],
      );
      const newPickIds = proposal.preview.map((p) => p.id).filter((id) => !prevIds.has(id));

      // Client-side merge (defense-in-depth): if the previous draft had
      // LOCKED 🔒 pieces, guarantee they survive by splicing any that the
      // model dropped back into the new preview in their original positions.
      // This makes the lock contract enforced by the client, not just the
      // system prompt — the model cannot silently mutate a locked pick.
      let carriedLocked: string[] = [];
      if (lastProposal) {
        const lockedSet = new Set(lastProposal.locked || []);
        const excludedSet = new Set(lastProposal.excluded || []);
        const returnedIds = new Set(proposal.preview.map((p) => p.id));
        const missingLocked = lastProposal.proposal.preview.filter(
          (p) => lockedSet.has(p.id) && !excludedSet.has(p.id) && !returnedIds.has(p.id),
        );
        if (missingLocked.length > 0) {
          const merged = [...proposal.preview];
          for (const lp of missingLocked) {
            const origIdx = lastProposal.proposal.preview.findIndex((x) => x.id === lp.id);
            const insertAt = Math.min(Math.max(origIdx, 0), merged.length);
            merged.splice(insertAt, 0, lp);
          }
          // Preserve discriminated-union narrowing by mutating `preview` in place
          // rather than spreading (spread widens `tool` back to the full union).
          (proposal as { preview: typeof merged }).preview = merged;
        }
        carriedLocked = lastProposal.proposal.preview
          .filter((p) => lockedSet.has(p.id) && !excludedSet.has(p.id))
          .map((p) => p.id)
          .filter((id) => proposal.preview.some((p) => p.id === id));
      }

      setTimeline((prev) => swapPendingWithReal(prev, tcid, proposal.tool, { kind: "proposal", proposal, newPickIds, locked: carriedLocked }));
    };


    // Active project from cross-page session storage (set by useProjectFilter).
    let projectId: string | null = null;
    try { projectId = sessionStorage.getItem("trade:lastProjectFilter"); } catch {}

    try {
      await streamConcierge({
        messages: messagesForApi,
        projectId,
        surface,
        lang: effectiveLang,
        onDelta: upsertAssistant,
        onProposal: handleProposal,
        onStreamStart: (streamId) => {
          // Persist the stream id in the concierge session so hooks like
          // `useConciergeSession().emit(...)` and `lockFinishes()` can push
          // client-originated events onto `concierge:${streamId}`.
          setStreamId(streamId);
          // Tear down any previous handoff channel and re-subscribe on the
          // new topic so peer tabs / dashboards receive server broadcasts
          // (`proposal_ready`, `stream_completed`, ...) in near real time.
          try { handoffDisposeRef.current?.(); } catch { /* ignore */ }
          handoffDisposeRef.current = openHandoffChannel(streamId, {
            onEvent: (frame) => {
              // Surface every broadcast on a window event so debug tools /
              // sibling components can observe without importing this module.
              try {
                window.dispatchEvent(new CustomEvent("concierge:handoff", { detail: { streamId, ...frame } }));
              } catch { /* ignore */ }
            },
          });
        },
        onToolStart: (ev) => {
          armStall();
          setTimeline((prev) => {
            // Guard against duplicates if the server re-emits (defensive).
            if (
              prev.some(
                (t) =>
                  t.kind === "pending_proposal" &&
                  ((ev.tool_call_id && t.toolCallId === ev.tool_call_id) ||
                    (!ev.tool_call_id && t.tool === ev.tool && t.index === ev.index)),
              )
            ) {
              return prev;
            }
            return [
              ...prev,
              {
                kind: "pending_proposal",
                tool: ev.tool,
                toolCallId: ev.tool_call_id,
                index: ev.index,
              },
            ];
          });
        },
        onRequestId: (rid) => {
          setLastRequestId(rid);
          setLastInspectorCount(0);
          setReqIdCopied(false);
        },
        onInspector: () => {
          setLastInspectorCount((n) => n + 1);
        },
        onAppliedConstraints: (ev) => {
          turnConstraints = ev;
          // If the assistant msg already exists, patch it so chips render
          // even before the next delta arrives.
          setTimeline((prev) => {
            const idx = [...prev].reverse().findIndex((t) => t.kind === "msg" && t.role === "assistant");
            if (idx === -1) return prev;
            const realIdx = prev.length - 1 - idx;
            const item = prev[realIdx];
            if (item.kind !== "msg" || item.role !== "assistant") return prev;
            const copy = prev.slice();
            copy[realIdx] = { ...item, appliedConstraints: ev };
            return copy;
          });
        },
        onMoodboardSignals: (ev) => {
          turnMoodboardSignals = ev;
          setTimeline((prev) => {
            const idx = [...prev].reverse().findIndex((t) => t.kind === "msg" && t.role === "assistant");
            if (idx === -1) {
              // No assistant msg yet — inject a placeholder so the card renders immediately.
              return [...prev, { kind: "msg", role: "assistant", content: "", moodboardSignals: ev, appliedConstraints: turnConstraints ?? undefined }];
            }
            const realIdx = prev.length - 1 - idx;
            const item = prev[realIdx];
            if (item.kind !== "msg" || item.role !== "assistant") return prev;
            const copy = prev.slice();
            copy[realIdx] = { ...item, moodboardSignals: ev };
            return copy;
          });
        },
        onReconnect: (ev) => {
          armStall();
          toast.message("Reconnecting to the concierge…", {
            description: `Connection ${ev.reason === "stream_truncated" ? "dropped" : "hiccup"} — retrying (${ev.attempt}/${ev.maxAttempts}).`,
            duration: Math.max(1500, ev.delayMs),
          });
        },
        onEscalation: (ev) => {
          armStall();
          setTimeline((prev) => [
            ...prev,
            { kind: "escalation", sentiment: ev.sentiment, intent: ev.intent, excerpt: ev.excerpt },
          ]);
        },
        onDone: () => {
          clearStallTimer();
          setStreaming(false);
          // Drop any skeleton placeholders that never resolved into a real
          // proposal (e.g. Inspector fail-closed → `proposal_blocked`).
          setTimeline((prev) => prev.filter((t) => t.kind !== "pending_proposal"));
        },
        onError: (msg) => {
          clearStallTimer();
          if (msg === "UNAUTHORIZED") {
            toast.error("Access restricted", {
              description: "The Concierge is available to Maison Affluency members only.",
            });
            setTimeline((prev) => [
              ...prev,
              {
                kind: "msg",
                role: "assistant",
                content: "Access restricted — the Concierge is available to Maison Affluency members only.",
              },
            ]);
          } else if (msg.startsWith("RATE_LIMIT:")) {

            const retrySec = parseInt(msg.split(":")[1], 10);
            const mins = Math.ceil(retrySec / 60);
            const timeText = mins < 1 ? `${retrySec} seconds` : `${mins} minute${mins === 1 ? "" : "s"}`;
            setTimeline((prev) => [
              ...prev,
              {
                kind: "msg",
                role: "assistant",
                content: `I'm afraid our concierge is currently at capacity. To ensure every visitor receives attentive service, we limit the number of messages per session. Please try again in ${timeText}, or contact us directly if your request is urgent.`,
              },
            ]);
          } else if (msg.startsWith("CORS_LIKELY:")) {
            // Format: CORS_LIKELY:<comma-headers>|<original error>
            const payload = msg.slice("CORS_LIKELY:".length);
            const [headersPart] = payload.split("|");
            const suspects = headersPart.split(",").filter(Boolean);
            toast.error("Connection blocked by browser (CORS)", {
              description: suspects.length
                ? `The request was rejected before it reached the concierge. Likely cause: header "${suspects[0]}"${suspects.length > 1 ? ` (or one of: ${suspects.slice(1).join(", ")})` : ""} isn't in the edge function's Access-Control-Allow-Headers list.`
                : "The browser blocked the request before it reached the concierge.",
              duration: 10000,
            });
            pushRetry(text, "The browser blocked the request to the concierge (CORS preflight).");
          } else {
            // Surface a retry card instead of a fire-and-forget toast so the
            // user has a one-click path back to a working turn.
            const friendly = /IDLE_TIMEOUT|504|timeout/i.test(msg)
              ? "The concierge timed out before answering."
              : msg === "STREAM_TRUNCATED"
                ? "The connection to the concierge dropped after auto-reconnect attempts."
                : msg || "The concierge hit an error.";
            pushRetry(text, friendly);
          }
          setStreaming(false);
          setTimeline((prev) => prev.filter((t) => t.kind !== "pending_proposal"));
        },
        signal: controller.signal,
      });
    } catch {
      clearStallTimer();
      setStreaming(false);
      setTimeline((prev) => prev.filter((t) => t.kind !== "pending_proposal"));
      // If the throw wasn't the user aborting, offer a retry.
      if (!controller.signal.aborted) {
        pushRetry(text, "The connection to the concierge dropped.");
      }
    }
  }, [input, attachments, streaming, timeline, stage, tone, lang, name, openLatestQuote, navigate, clearStallTimer, pushRetry, user]);

  // Keep a ref to the latest `send` so the concierge:stage handler (which
  // registers once on mount) can auto-send prefills against fresh state
  // instead of the stale closure captured at mount time.
  const sendRef = useRef(send);
  useEffect(() => { sendRef.current = send; }, [send]);


  const handleProposalResolved = (
    proposalIndex: number,
    outcome: "approved" | "discarded",
    info?: { boardId: string; url: string; added: number; duplicates: number; mode: "create" | "append"; deferNavigation?: boolean },
  ) => {
    // Mark in timeline so the card updates persist on re-render
    setTimeline((prev) => {
      const copy = prev.slice();
      const item = copy[proposalIndex];
      if (item?.kind === "proposal") {
        copy[proposalIndex] = { ...item, resolved: outcome };
      }
      const trail = info?.deferNavigation ? "" : " — taking you there now…";
      let content: string;
      if (outcome === "discarded") {
        content = "Got it — I've discarded that draft. Want me to try a different angle?";
      } else if (info?.mode === "append") {
        if (info.added === 0 && info.duplicates > 0) {
          content = "All pieces were already on this tearsheet — nothing new to add.";
        } else {
          content = `✓ Added ${info.added} ${info.added === 1 ? "piece" : "pieces"} to your tearsheet${trail}`;
        }
      } else {
        {
          const n = info?.added ?? 0;
          const piecesLabel = n > 0 ? ` with ${n} ${n === 1 ? "piece" : "pieces"}` : "";
          content = `✓ Tearsheet created${piecesLabel}${trail}`;
        }
      }
      copy.push({ kind: "msg", role: "assistant", content });
      return copy;
    });
    // Only auto-navigate when something actually changed AND the card isn't
    // about to prompt the user for a project assignment.
    const shouldNavigate =
      outcome === "approved" &&
      info?.url &&
      !info.deferNavigation &&
      !(info.mode === "append" && info.added === 0);
    if (shouldNavigate) {
      setTimeout(() => navigate(info!.url), 600);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const lastItem = timeline[timeline.length - 1];
  const showTypingDots = streaming && (!lastItem || lastItem.kind !== "msg" || lastItem.role !== "assistant");
  const copy = conciergeCopy(lang);

  return (
    <>
      {/* Hidden trigger — clicked by the global ConciergeHeaderButton in TradeLayout.
          Rendered on every trade page so Felix is always reachable from the header. */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="sr-only"
          aria-label="Open AI Concierge"
        />
      )}

      {/* Chat panel */}
      {open && (
        <>
          {modalMode && (
            <div
              className={cn(
                "fixed inset-0 z-[9998] bg-foreground/40 backdrop-blur-sm print:hidden transition-[opacity,backdrop-filter] duration-300 ease-out",
                welcomeClosing ? "animate-fade-out opacity-0 backdrop-blur-0" : "animate-fade-in"
              )}
              aria-hidden="true"
              onClick={closeWelcomeModal}
            />
          )}
          {!modalMode && !minimized && (
            <div
              className="fixed inset-0 z-[1] backdrop-blur-sm bg-foreground/10 print:hidden animate-fade-in pointer-events-none"
              aria-hidden="true"
            />
          )}
        <div
          data-concierge-panel
          style={
            modalMode
              ? { width: PANEL_W }
              : fullscreen
                ? { width: PANEL_W }
                : pos
                  ? { top: pos.y, left: pos.x, right: "auto", bottom: "auto", width: PANEL_W }
                  : { width: PANEL_W }
          }
          className={cn(
            "fixed z-[10000] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border shadow-2xl print:hidden overflow-hidden",
            modalMode
              ? cn(
                  "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-cream border-jade/40 ring-1 ring-jade/30 shadow-[0_30px_80px_-20px_hsl(var(--foreground)/0.5)]",
                  welcomeClosing ? "animate-scale-out" : "animate-scale-in"
                )
              : "bg-background border-border animate-fade-in",
            !modalMode && fullscreen && "left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2",
            !modalMode && !fullscreen && !pos && "bottom-20 md:bottom-6 right-4",
            minimized ? "h-auto" : ((fullscreen || modalMode) ? "h-[calc(100vh-2rem)]" : (expanded ? "h-[760px] max-h-[calc(100vh-4rem)]" : "h-[560px] max-h-[calc(100vh-6rem)]"))
          )}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={() => setMinimized((m) => !m)}
            className={cn(
              "flex flex-col gap-1.5 px-4 py-3 border-b cursor-grab active:cursor-grabbing select-none touch-none shrink-0",
              modalMode
                ? "bg-jade text-cream border-jade [&_.text-muted-foreground]:text-cream/70 [&_.text-accent]:text-cream [&_button:hover]:bg-cream/10 [&_button:hover]:text-cream"
                : "border-border"
            )}
            title="Drag to move · double-click to collapse"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
                <Sparkles className="h-4 w-4 text-accent shrink-0" />
                <span
                  className="font-display text-sm uppercase tracking-[0.12em] whitespace-nowrap overflow-hidden text-ellipsis"
                  title={name}
                >
                  {name}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0 relative">
              <div className="relative">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => {
                    setNameDraft(name === DEFAULT_NAME ? "" : name);
                    setNameMenuOpen((v) => !v);
                  }}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                  aria-label="Rename your concierge"
                  aria-haspopup="dialog"
                  aria-expanded={nameMenuOpen}
                  title={`Name: ${name}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                {nameMenuOpen && (
                  <div
                    role="dialog"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 z-[10010] w-64 rounded-lg border border-border bg-popover shadow-xl overflow-hidden p-3"
                  >
                    <div className="font-display text-[10px] uppercase tracking-widest text-muted-foreground mb-2">
                      {copy.nameDialogTitle}
                    </div>
                    <input
                      type="text"
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value.slice(0, 32))}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          void persistName(nameDraft);
                          setNameMenuOpen(false);
                        } else if (e.key === "Escape") {
                          setNameMenuOpen(false);
                        }
                      }}
                      autoFocus
                      maxLength={32}
                      placeholder={DEFAULT_NAME}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5 font-body text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                    />
                    <div className="mt-1 font-body text-[10px] text-muted-foreground">
                      {copy.nameHint}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          void persistName("");
                          setNameDraft("");
                          setNameMenuOpen(false);
                        }}
                        className="font-body text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {copy.reset}
                      </button>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setNameMenuOpen(false)}
                          className="rounded-md px-2 py-1 font-body text-[11px] text-muted-foreground hover:bg-muted"
                        >
                          {copy.cancel}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            void persistName(nameDraft);
                            setNameMenuOpen(false);
                          }}
                          className="rounded-md bg-foreground text-background px-2.5 py-1 font-body text-[11px] hover:opacity-90"
                        >
                          {copy.save}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <div className="relative">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setToneMenuOpen((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                  aria-label="Choose concierge tone"
                  aria-haspopup="menu"
                  aria-expanded={toneMenuOpen}
                  title={`Tone: ${TONES.find((t) => t.id === tone)?.label ?? tone}`}
                >
                  <Palette className="h-3.5 w-3.5" />
                </button>
                {toneMenuOpen && (
                  <div
                    role="menu"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 z-[10010] w-60 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-border/60 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                      {copy.tone}
                    </div>
                    {tonesFor(lang).map((t) => {
                      const active = t.id === tone;
                      return (
                        <button
                          key={t.id}
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setTone(t.id);
                            saveTone(t.id);
                            setToneMenuOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-start gap-2",
                            active && "bg-muted/40"
                          )}
                        >
                          <Check className={cn("h-3.5 w-3.5 mt-0.5 shrink-0", active ? "text-accent" : "opacity-0")} />
                          <span className="flex-1 min-w-0">
                            <span className="block font-body text-xs text-foreground">{t.label}</span>
                            <span className="block font-body text-[11px] text-muted-foreground leading-snug">{t.description}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  const next: Lang = lang === "zh" ? "en" : "zh";
                  setLang(next);
                  try { saveLang(next); } catch {}
                  if (next === "zh") {
                    const greeting = `尊敬的 测试贵宾，欢迎。我是您的专属礼宾。\n\n了解您时间珍贵，只需一句话告诉我您目前最紧急的豪宅项目风格、空间尺度或缺失的核心孤品（支持语音或图片），我将立即为您从全球 300 多位设计大师中进行定向筛选。`;
                    setTimeline((prev) => [...prev, { kind: "msg", role: "assistant", content: greeting }]);
                  }
                }}
                className={cn(
                  "text-[11px] px-2 py-1 rounded-md border transition-colors font-body",
                  lang === "zh"
                    ? "border-accent text-accent bg-accent/10"
                    : "border-border text-muted-foreground hover:text-foreground hover:bg-muted"
                )}
                aria-pressed={lang === "zh"}
                title="Toggle Mandarin (QA)"
              >
                🇨🇳 中文
              </button>
              {lang === "zh" ? (
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCnViewingOpen(true)}
                  className="text-[11px] px-2 py-1 rounded-md border border-accent/60 text-accent bg-accent/5 hover:bg-accent/10 transition-colors font-body whitespace-nowrap"
                  title="Book Singapore District 9 viewing"
                >
                  预约鉴赏
                </button>
              ) : null}
              <div className="relative">
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setLangMenuOpen((v) => !v)}
                  className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                  aria-label="Choose concierge language"
                  aria-haspopup="menu"
                  aria-expanded={langMenuOpen}
                  title={`Language: ${LANGUAGES.find((l) => l.id === lang)?.native ?? lang}`}
                >
                  <Languages className="h-3.5 w-3.5" />
                </button>
                {langMenuOpen && (
                  <div
                    role="menu"
                    onPointerDown={(e) => e.stopPropagation()}
                    className="absolute right-0 top-full mt-1 z-[10010] w-52 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
                  >
                    <div className="px-3 py-2 border-b border-border/60 font-display text-[10px] uppercase tracking-widest text-muted-foreground">
                      {copy.language}
                    </div>
                    {LANGUAGES.map((l) => {
                      const active = l.id === lang;
                      return (
                        <button
                          key={l.id}
                          role="menuitemradio"
                          aria-checked={active}
                          onClick={() => {
                            setLang(l.id);
                            saveLang(l.id);
                            setLangMenuOpen(false);
                          }}
                          className={cn(
                            "w-full text-left px-3 py-2 hover:bg-muted/60 transition-colors flex items-center gap-2",
                            active && "bg-muted/40"
                          )}
                        >
                          <Check className={cn("h-3.5 w-3.5 shrink-0", active ? "text-accent" : "opacity-0")} />
                          <span className="font-body text-xs text-foreground">{l.native}</span>
                          <span className="font-body text-[11px] text-muted-foreground ml-auto">{l.id.toUpperCase()}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  try {
                    const ts = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
                    const lines: string[] = [];
                    lines.push(`# Concierge Workflow — ${ts.toLocaleString()}`);
                    lines.push(`Route: ${pathname}`);
                    lines.push(`Concierge: ${name} · Tone: ${tone} · Language: ${lang}`);
                    lines.push("");
                    timeline.forEach((t, i) => {
                      if (t.kind === "msg") {
                        lines.push(`## ${i + 1}. ${t.role === "user" ? "User" : name}`);
                        lines.push(t.content || "");
                        if (t.attachments?.length) {
                          lines.push("");
                          lines.push(`_Attachments:_ ${t.attachments.map((a: any) => a.name || a.url || "file").join(", ")}`);
                        }
                      } else {
                        lines.push(`## ${i + 1}. [${t.kind}]`);
                        lines.push("```json");
                        lines.push(JSON.stringify(t, null, 2));
                        lines.push("```");
                      }
                      lines.push("");
                    });
                    const md = lines.join("\n");
                    const blob = new Blob([md], { type: "text/markdown;charset=utf-8" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `concierge-workflow_${stamp}.md`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                  } catch (err) {
                    console.error("[concierge] download failed", err);
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label="Download conversation"
                title="Download conversation for audit"
              >
                <Download className="h-3.5 w-3.5" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={async () => {
                  try {
                    const { jsPDF } = await import("jspdf");
                    const ts = new Date();
                    const pad = (n: number) => String(n).padStart(2, "0");
                    const stamp = `${ts.getFullYear()}-${pad(ts.getMonth() + 1)}-${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}`;
                    const doc = new jsPDF({ unit: "pt", format: "a4" });
                    const pageW = doc.internal.pageSize.getWidth();
                    const pageH = doc.internal.pageSize.getHeight();
                    const margin = 48;
                    const contentW = pageW - margin * 2;
                    let y = margin;
                    const ensureRoom = (h: number) => {
                      if (y + h > pageH - margin) {
                        doc.addPage();
                        y = margin;
                      }
                    };
                    const writeLines = (text: string, opts: { size?: number; bold?: boolean; color?: [number, number, number] } = {}) => {
                      const size = opts.size ?? 10;
                      doc.setFont("helvetica", opts.bold ? "bold" : "normal");
                      doc.setFontSize(size);
                      doc.setTextColor(...(opts.color ?? [30, 30, 30]));
                      const lineH = size * 1.35;
                      const wrapped = doc.splitTextToSize(text || " ", contentW);
                      for (const line of wrapped) {
                        ensureRoom(lineH);
                        doc.text(line, margin, y);
                        y += lineH;
                      }
                    };
                    // Header
                    writeLines("Concierge Workflow — Audit Report", { size: 16, bold: true });
                    y += 4;
                    writeLines(`Generated: ${ts.toLocaleString()}`, { size: 9, color: [110, 110, 110] });
                    writeLines(`Route: ${pathname}`, { size: 9, color: [110, 110, 110] });
                    writeLines(`Concierge: ${name} · Tone: ${tone} · Language: ${lang}`, { size: 9, color: [110, 110, 110] });
                    y += 8;
                    doc.setDrawColor(200);
                    doc.line(margin, y, pageW - margin, y);
                    y += 14;
                    timeline.forEach((t: any, i: number) => {
                      const heading =
                        t.kind === "msg"
                          ? `${i + 1}. ${t.role === "user" ? "User" : name}`
                          : `${i + 1}. [${t.kind}]`;
                      writeLines(heading, { size: 11, bold: true, color: [20, 20, 20] });
                      y += 2;
                      if (t.kind === "msg") {
                        writeLines(t.content || "", { size: 10 });
                        if (t.attachments?.length) {
                          writeLines(
                            `Attachments: ${t.attachments.map((a: any) => a.name || a.url || "file").join(", ")}`,
                            { size: 9, color: [110, 110, 110] }
                          );
                        }
                      } else {
                        const json = JSON.stringify(t, null, 2);
                        writeLines(json, { size: 8, color: [70, 70, 70] });
                      }
                      y += 10;
                    });
                    // Footer with page numbers
                    const pageCount = doc.getNumberOfPages();
                    for (let p = 1; p <= pageCount; p++) {
                      doc.setPage(p);
                      doc.setFont("helvetica", "normal");
                      doc.setFontSize(8);
                      doc.setTextColor(140);
                      doc.text(`Maison Affluency · Concierge Audit · Page ${p} of ${pageCount}`, margin, pageH - 20);
                    }
                    doc.save(`concierge-workflow_${stamp}.pdf`);
                  } catch (err) {
                    console.error("[concierge] PDF download failed", err);
                  }
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label="Download conversation as PDF"
                title="Download audit PDF"
              >
                <FileDown className="h-3.5 w-3.5" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  abortRef.current?.abort();
                  setStreaming(false);
                  setInput("");
                  setStageOverride(null);
                  setTimeline([{ kind: "msg", role: "assistant", content: currentGreeting(lang) }]);
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label="Start a new conversation"
                title="Start a new conversation"
              >
                <RotateCcw className="h-3.5 w-3.5" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setExpanded((v) => {
                    const nv = !v;
                    try { localStorage.setItem("concierge:expanded", nv ? "1" : "0"); } catch {}
                    return nv;
                  });
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label={expanded ? "Shrink" : "Expand"}
                title={expanded ? "Shrink" : "Expand"}
              >
                {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  setFullscreen((v) => {
                    const nv = !v;
                    try { localStorage.setItem("concierge:fullscreen", nv ? "1" : "0"); } catch {}
                    return nv;
                  });
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label={fullscreen ? "Exit full screen" : "Full screen"}
                title={fullscreen ? "Exit full screen" : "Full screen"}
              >
                {fullscreen ? <Shrink className="h-3.5 w-3.5" /> : <Expand className="h-3.5 w-3.5" />}
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => setMinimized((m) => !m)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label={minimized ? "Expand" : "Collapse"}
                title={minimized ? "Expand" : "Collapse"}
              >
                <Minus className="h-4 w-4" />
              </button>
              <button
                onPointerDown={(e) => e.stopPropagation()}
                onClick={() => {
                  if (modalMode) {
                    closeWelcomeModal();
                    return;
                  }
                  setOpen(false);
                  try { localStorage.removeItem("ma:welcome-pending"); } catch {}
                  window.dispatchEvent(new CustomEvent("ma:welcome-dismissed"));
                }}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
              </div>
            </div>
            {!minimized && (
              <div className="flex items-center gap-2 flex-wrap pl-6">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-muted-foreground"
                  title={`Current workflow stage: ${stage}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {copy.stage}: {stage}
                </span>
                {briefBuilderOpen && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-body text-[10px] uppercase tracking-widest ${
                      briefValidation.valid
                        ? "border-accent/60 bg-accent/10 text-accent"
                        : "border-destructive/60 bg-destructive/10 text-destructive"
                    }`}
                    title={
                      briefValidation.valid
                        ? "Brief Builder is open — ready to send"
                        : `Brief Builder is open — add: ${briefValidation.missing.join(", ")}`
                    }
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${briefValidation.valid ? "bg-accent" : "bg-destructive"} animate-pulse`} aria-hidden="true" />
                    Brief Builder Open
                  </span>
                )}
              </div>
            )}

          </div>

          {!minimized && (<>

          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-5">
            {timeline.map((item, i) => {
              if (item.kind === "msg") {
                const atts = item.role === "user" ? item.attachments : undefined;
                return (
                  <div key={i} className={cn("flex flex-col gap-2", item.role === "user" ? "items-end" : "items-start")}>
                    {atts && atts.length > 0 && (
                      <div className={cn("flex flex-wrap justify-end gap-2", expanded ? "max-w-[92%]" : "max-w-[88%]")}>
                        {atts.map((a, ai) => (
                          a.kind === "image" && a.previewUrl ? (
                            <img
                              key={ai}
                              src={a.previewUrl}
                              alt={a.name}
                              className="max-h-48 max-w-[220px] rounded-2xl rounded-br-md object-cover border border-border"
                            />
                          ) : (
                            <div key={ai} className="rounded-2xl rounded-br-md px-3 py-2 bg-foreground text-background font-body text-xs inline-flex items-center gap-2 max-w-[220px]">
                              <Paperclip className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">{a.name}</span>
                            </div>
                          )
                        ))}
                      </div>
                    )}
                    {item.content && (
                      item.role === "user" && isBriefContent(item.content) ? (
                        <div className={cn(expanded ? "max-w-[92%]" : "max-w-[88%]", "w-full flex justify-end")}>
                          <BriefBubble content={item.content} />
                        </div>
                      ) : (
                    <div
                      className={cn(
                        "rounded-2xl px-4 py-3 font-body text-sm leading-relaxed",
                        expanded ? "max-w-[92%]" : "max-w-[88%]",
                        item.role === "user"
                          ? "bg-foreground text-background rounded-br-md whitespace-pre-wrap"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {item.role === "assistant" ? (
                        <div className="concierge-md space-y-2.5">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ node, children, ...props }) => {
                                // Detect the "**Match:** Band · NN% — rationale"
                                // line emitted for each Private Exhibition piece
                                // and render it as a badge + rationale card.
                                const arr = React.Children.toArray(children);
                                const first: any = arr[0];
                                const firstStrongText = first && typeof first === "object"
                                  ? String((first.props?.children ?? "").toString())
                                  : "";
                                const firstIsStrong =
                                  first &&
                                  typeof first === "object" &&
                                  (first.type === "strong" || first.props?.node?.tagName === "strong");
                                const firstIsMatchStrong =
                                  firstIsStrong && /^\s*match\s*:?\s*$/i.test(firstStrongText);
                                const firstIsSignalsStrong =
                                  firstIsStrong && /^\s*signals\s*:?\s*$/i.test(firstStrongText);
                                // Suppress bare "**Signals:** …" paragraphs — they
                                // should have been folded into the Match line by
                                // inlineSignalsIntoMatchLines(); this is the fallback.
                                if (firstIsSignalsStrong) return null;
                                if (firstIsMatchStrong) {
                                  const tail = arr
                                    .slice(1)
                                    .map((c: any) => (typeof c === "string" ? c : c?.props?.children ?? ""))
                                    .join("")
                                    .toString();
                                  const parsed = parseMatchTail(tail);
                                  if (parsed) return <MatchBadge parsed={parsed} />;
                                }
                                return <p className="my-0" {...props}>{children}</p>;
                              },
                              ul: ({ node, ...props }) => <ul className="list-disc pl-5 space-y-2 my-1" {...props} />,
                              ol: ({ node, ...props }) => <ol className="list-decimal pl-5 space-y-2 my-1" {...props} />,
                              li: ({ node, ...props }) => <li className="leading-relaxed [&>p]:my-0" {...props} />,
                              strong: ({ node, ...props }) => <strong className="font-semibold text-foreground" {...props} />,
                              em: ({ node, ...props }) => <em className="italic" {...props} />,
                              a: ({ node, ...props }) => <a className="underline hover:text-accent" target="_blank" rel="noreferrer" {...props} />,
                              h1: ({ node, ...props }) => <h3 className="font-display text-base mt-1 mb-1" {...props} />,
                              h2: ({ node, ...props }) => <h3 className="font-display text-base mt-1 mb-1" {...props} />,
                              h3: ({ node, ...props }) => <h3 className="font-display text-sm mt-1 mb-1 uppercase tracking-wide" {...props} />,
                              hr: () => <hr className="my-2 border-border/60" />,
                              code: ({ node, ...props }) => <code className="rounded bg-background/60 px-1 py-0.5 text-[0.85em]" {...props} />,
                            }}
                          >
                            {inlineSignalsIntoMatchLines(item.content)}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{item.content}</span>
                      )}
                    </div>
                      )
                    )}
                    {item.role === "assistant" && item.moodboardSignals && (() => {
                      const isEditing = editingSignalsIdx === i;
                      const s: MoodboardSignalsEvent = (isEditing && signalsDraft) ? signalsDraft : item.moodboardSignals!;
                      const isFloorPlan = s.kind === "floor_plan";
                      const groups: Array<{ label: string; key: "style" | "palette" | "materials" | "typology" | "room" | "designers"; values: string[] }> = [
                        { label: "Style", key: "style", values: s.style },
                        { label: "Palette", key: "palette", values: s.palette },
                        { label: "Materials", key: "materials", values: s.materials },
                        { label: "Typology", key: "typology", values: (s.subcategories.length ? s.subcategories : s.categories) },
                        { label: "Room", key: "room", values: s.room_type ? [s.room_type] : [] },
                        { label: "Designers", key: "designers", values: s.designer_hints },
                      ];
                      const visibleGroups = isEditing ? groups : groups.filter((g) => g.values.length > 0);
                      if (visibleGroups.length === 0 && !isEditing) return null;

                      const startEdit = () => {
                        setSignalsDraft({ ...item.moodboardSignals! });
                        setEditingSignalsIdx(i);
                      };
                      const cancelEdit = () => {
                        setEditingSignalsIdx(null);
                        setSignalsDraft(null);
                      };
                      const updateDraft = (key: typeof groups[number]["key"], nextValues: string[]) => {
                        setSignalsDraft((prev) => {
                          const base = prev ?? { ...item.moodboardSignals! };
                          if (key === "style") return { ...base, style: nextValues };
                          if (key === "palette") return { ...base, palette: nextValues };
                          if (key === "materials") return { ...base, materials: nextValues };
                          if (key === "typology") return { ...base, subcategories: nextValues, categories: [] };
                          if (key === "room") return { ...base, room_type: nextValues[0] ?? null };
                          if (key === "designers") return { ...base, designer_hints: nextValues };
                          return base;
                        });
                      };
                      const removeChip = (key: typeof groups[number]["key"], value: string) => {
                        const current = groups.find((g) => g.key === key)?.values ?? [];
                        updateDraft(key, current.filter((v) => v !== value));
                      };
                      const addChip = (key: typeof groups[number]["key"], raw: string) => {
                        const trimmed = raw.trim();
                        if (!trimmed) return;
                        const current = groups.find((g) => g.key === key)?.values ?? [];
                        if (current.some((v) => v.toLowerCase() === trimmed.toLowerCase())) return;
                        if (key === "room") {
                          updateDraft("room", [trimmed]);
                        } else {
                          updateDraft(key, [...current, trimmed].slice(0, 12));
                        }
                      };
                      const rematch = () => {
                        const draft = signalsDraft ?? item.moodboardSignals!;
                        // Patch the timeline item so the display + refine card reflect the correction.
                        setTimeline((prev) => {
                          const copy = prev.slice();
                          const target = copy[i];
                          if (target && target.kind === "msg" && target.role === "assistant") {
                            copy[i] = { ...target, moodboardSignals: draft };
                          }
                          return copy;
                        });
                        setEditingSignalsIdx(null);
                        setSignalsDraft(null);
                        const parts: string[] = [];
                        if (draft.style.length) parts.push(`style: ${draft.style.join(", ")}`);
                        if (draft.palette.length) parts.push(`palette: ${draft.palette.join(", ")}`);
                        if (draft.materials.length) parts.push(`materials: ${draft.materials.join(", ")}`);
                        const typology = draft.subcategories.length ? draft.subcategories : draft.categories;
                        if (typology.length) parts.push(`typology: ${typology.join(", ")}`);
                        if (draft.room_type) parts.push(`room: ${draft.room_type}`);
                        if (draft.designer_hints.length) parts.push(`designers: ${draft.designer_hints.join(", ")}`);
                        const msg = parts.length
                          ? `I corrected the signals I want you to use for matching — ignore your earlier detection and re-curate strictly on these:\n${parts.map((p) => `• ${p}`).join("\n")}`
                          : "I've cleared all detected signals — re-curate without those constraints.";
                        void send(msg);
                      };

                      return (
                        <div
                          className={cn(
                            "rounded-lg border border-accent/30 bg-accent/5 p-3 space-y-2",
                            expanded ? "max-w-[92%]" : "max-w-[88%]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base leading-none">{isFloorPlan ? "⌐" : "◇"}</span>
                              <div className="text-[10px] font-body uppercase tracking-[0.16em] text-foreground/70">
                                Detected from your upload · {isFloorPlan ? "Floor plan" : "Moodboard"}
                                {isEditing && <span className="ml-2 normal-case tracking-normal text-muted-foreground">(editing)</span>}
                              </div>
                            </div>
                            {!isEditing && (
                              <button
                                type="button"
                                disabled={streaming}
                                onClick={startEdit}
                                className="rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-2.5 py-0.5 text-[10px] font-body uppercase tracking-[0.14em] text-foreground/70 disabled:opacity-40"
                              >
                                Edit
                              </button>
                            )}
                          </div>
                          <div className="space-y-1.5">
                            {visibleGroups.map((g) => (
                              <div key={g.label} className="flex flex-wrap items-center gap-1.5">
                                <span className="text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground min-w-[64px]">
                                  {g.label}
                                </span>
                                {g.values.slice(0, isEditing ? 20 : 8).map((v) => (
                                  <span
                                    key={`${g.label}-${v}`}
                                    className="inline-flex items-center gap-1 rounded-full border border-border/70 bg-background/70 px-2 py-0.5 text-[11px] font-body text-foreground/85"
                                  >
                                    {v}
                                    {isEditing && (
                                      <button
                                        type="button"
                                        onClick={() => removeChip(g.key, v)}
                                        className="text-muted-foreground hover:text-foreground"
                                        aria-label={`Remove ${v}`}
                                      >
                                        ×
                                      </button>
                                    )}
                                  </span>
                                ))}
                                {isEditing && (g.key !== "room" || g.values.length === 0) && (
                                  <input
                                    type="text"
                                    placeholder={g.key === "room" ? "e.g. dining room" : "add…"}
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        e.preventDefault();
                                        addChip(g.key, (e.currentTarget as HTMLInputElement).value);
                                        (e.currentTarget as HTMLInputElement).value = "";
                                      }
                                    }}
                                    onBlur={(e) => {
                                      if (e.currentTarget.value.trim()) {
                                        addChip(g.key, e.currentTarget.value);
                                        e.currentTarget.value = "";
                                      }
                                    }}
                                    className="min-w-[100px] flex-1 rounded-full border border-dashed border-border/60 bg-background/40 px-2 py-0.5 text-[11px] font-body text-foreground/85 placeholder:text-muted-foreground/70 focus:outline-none focus:border-accent/60"
                                  />
                                )}
                              </div>
                            ))}
                          </div>
                          {s.notes && !isEditing && (
                            <div className="pt-1 text-[11px] font-body italic text-muted-foreground leading-relaxed">
                              {s.notes.length > 220 ? `${s.notes.slice(0, 217)}…` : s.notes}
                            </div>
                          )}
                          {isEditing && (
                            <div className="flex flex-wrap gap-1.5 pt-1">
                              <button
                                type="button"
                                disabled={streaming}
                                onClick={rematch}
                                className="rounded-full border border-foreground/70 bg-foreground text-background hover:opacity-90 px-3 py-1 text-[11px] font-body disabled:opacity-40"
                              >
                                Re-match with these signals
                              </button>
                              <button
                                type="button"
                                onClick={cancelEdit}
                                className="rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-3 py-1 text-[11px] font-body text-foreground"
                              >
                                Cancel
                              </button>
                              <span className="ml-auto self-center text-[10px] font-body italic text-muted-foreground">
                                Press Enter to add · × to remove
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                    {item.role === "assistant" && item.appliedConstraints && (
                      (item.appliedConstraints.colors.length +
                        item.appliedConstraints.materials.length +
                        item.appliedConstraints.categories.length) > 0 && (
                        <div
                          className={cn(
                            "flex flex-wrap items-center gap-1.5 text-[10px] font-body uppercase tracking-[0.14em] text-muted-foreground",
                            expanded ? "max-w-[92%]" : "max-w-[88%]",
                          )}
                          title="Hard-constraint pre-filter applied to the Maison Affluency Curation for this turn"
                        >
                          <span className="text-muted-foreground/70">Filtered by:</span>
                          {item.appliedConstraints.colors.map((c) => (
                            <span key={`c-${c}`} className="inline-flex items-center rounded-full border border-border/80 bg-background/60 px-2 py-0.5">
                              <span className="mr-1">◆</span>{c}
                            </span>
                          ))}
                          {item.appliedConstraints.materials.map((m) => (
                            <span key={`m-${m}`} className="inline-flex items-center rounded-full border border-border/80 bg-background/60 px-2 py-0.5">
                              {m}
                            </span>
                          ))}
                          {item.appliedConstraints.categories.map((cat) => (
                            <span key={`cat-${cat}`} className="inline-flex items-center rounded-full border border-border/80 bg-background/60 px-2 py-0.5">
                              {cat}
                            </span>
                          ))}
                        </div>
                      )
                    )}
                    {/* Curated-selection empty-state card intentionally removed per product decision. */}
                    {item.role === "assistant" && (item.moodboardSignals || item.appliedConstraints?.empty) && (() => {
                      const s = item.moodboardSignals;
                      const ac = item.appliedConstraints;
                      const detected = {
                        style: s?.style ?? [],
                        palette: [...new Set([...(s?.palette ?? []), ...((ac?.colors) ?? [])])],
                        material: [...new Set([...(s?.materials ?? []), ...((ac?.materials) ?? [])])],
                        typology: [...new Set([...(s?.subcategories ?? []), ...(s?.categories ?? []), ...((ac?.categories) ?? [])])],
                        room: s?.room_type ? [s.room_type] : [],
                      };
                      const axes: Array<{ key: keyof typeof detected; label: string }> = [
                        { key: "style", label: "Style" },
                        { key: "palette", label: "Palette" },
                        { key: "material", label: "Material" },
                        { key: "typology", label: "Typology" },
                        { key: "room", label: "Room" },
                      ];
                      const hasAny = axes.some((a) => detected[a.key].length > 0);
                      const buildDraft = (only?: keyof typeof detected) => {
                        const lines: string[] = ["Refine my constraints:"];
                        for (const a of axes) {
                          const vals = detected[a.key];
                          if (vals.length === 0) continue;
                          if (only && a.key !== only) {
                            lines.push(`- ${a.label}: keep ${vals.join(", ")}`);
                          } else {
                            lines.push(`- ${a.label} (${vals.join(", ")}) → `);
                          }
                        }
                        if (!only && !hasAny) {
                          lines.push("- Style → ", "- Palette → ", "- Material → ", "- Typology → ", "- Room → ");
                        }
                        return lines.join("\n");
                      };
                      const prefill = (only?: keyof typeof detected) => {
                        const draft = buildDraft(only);
                        setInput(draft);
                        setTimeout(() => {
                          const el = inputRef.current;
                          if (el) {
                            el.focus();
                            const pos = el.value.length;
                            try { el.setSelectionRange(pos, pos); } catch { /* noop */ }
                          }
                        }, 30);
                      };
                      return (
                        <div
                          className={cn(
                            "rounded-lg border border-border/70 bg-muted/20 p-3 space-y-2",
                            expanded ? "max-w-[92%]" : "max-w-[88%]",
                          )}
                        >
                          <div className="flex items-start gap-2">
                            <span className="text-base leading-none mt-0.5">◈</span>
                            <div className="text-xs font-body text-foreground/85 leading-relaxed">
                              {ac?.empty
                                ? "These are the closest matches — not exact. Refine any axis to steer the edit."
                                : "Want to steer the edit? Refine any axis of the detected brief."}
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button
                              type="button"
                              disabled={streaming}
                              onClick={() => prefill()}
                              className="rounded-full border border-foreground/70 bg-foreground text-background hover:opacity-90 px-3 py-1 text-[11px] font-body disabled:opacity-40"
                            >
                              Refine my constraints
                            </button>
                            {axes.map((a) => (
                              <button
                                key={`refine-${a.key}`}
                                type="button"
                                disabled={streaming}
                                onClick={() => prefill(a.key)}
                                className="rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 px-3 py-1 text-[11px] font-body text-foreground disabled:opacity-40"
                                title={detected[a.key].length ? `Currently: ${detected[a.key].join(", ")}` : `Add a ${a.label.toLowerCase()} constraint`}
                              >
                                {a.label}
                                {detected[a.key].length > 0 && (
                                  <span className="ml-1 text-foreground/50">· {detected[a.key].slice(0, 2).join(", ")}{detected[a.key].length > 2 ? "…" : ""}</span>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                    {item.role === "assistant" && item.actions && item.actions.length > 0 && (
                      <div className={cn("flex flex-wrap gap-1.5", expanded ? "max-w-[92%]" : "max-w-[88%]")}>
                        {item.actions.map((a, idx) => (
                          <button
                            key={idx}
                            onClick={() => send(a.prompt)}
                            disabled={streaming}
                            className={cn(
                              "rounded-full border transition-colors px-3 py-1 font-body text-xs disabled:opacity-40",
                              a.primary
                                ? "border-foreground bg-foreground text-background hover:opacity-90 px-4 py-1.5 text-[13px] shadow-sm inline-flex items-center gap-1.5"
                                : "border-border bg-background hover:bg-accent/10 hover:border-accent/40 text-foreground"
                            )}
                          >
                            {a.primary && <Sparkles className="h-3 w-3" />}
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              if (item.kind === "spec_schedule") {
                return (
                  <div key={i} className="self-start">
                    <SpecScheduleBlock zone={item.zone} markdown={item.markdown} />
                  </div>
                );
              }
              if (item.kind === "retry") {
                return (
                  <div
                    key={i}
                    className={cn(
                      "self-start rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 font-body text-sm text-foreground",
                      expanded ? "max-w-[92%]" : "max-w-[88%]",
                    )}
                    role="alert"
                  >
                    <div className="mb-2 leading-relaxed">
                      <span className="font-medium">{item.reason}</span>{" "}
                      <span className="text-muted-foreground">You can retry your last message.</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        disabled={streaming}
                        onClick={() => {
                          const retryText = item.text;
                          // Drop this retry card before re-sending so a second failure
                          // stacks cleanly instead of leaving stale cards behind.
                          setTimeline((prev) => prev.filter((_, idx) => idx !== i));
                          send(retryText);
                        }}
                        className="rounded-full border border-foreground bg-foreground px-4 py-1.5 text-[13px] text-background shadow-sm inline-flex items-center gap-1.5 hover:opacity-90 disabled:opacity-40"
                      >
                        <Sparkles className="h-3 w-3" />
                        Try again
                      </button>
                      {(() => {
                        const sess = getConciergeSession();
                        const brief = sess?.briefText?.trim();
                        if (!brief) return null;
                        return (
                          <button
                            type="button"
                            disabled={streaming}
                            onClick={() => {
                              setTimeline((prev) => prev.filter((_, idx) => idx !== i));
                              const product = sess?.product
                                ? `\n\nSelected piece: ${sess.product.title}${sess.product.designer_name ? ` by ${sess.product.designer_name}` : ""}.`
                                : "";
                              const finishes = sess?.finishes
                                ? [
                                    sess.finishes.fabric ? `Fabric: ${sess.finishes.fabric}` : null,
                                    sess.finishes.wood ? `Wood: ${sess.finishes.wood}` : null,
                                    sess.finishes.variant ? `Variant: ${sess.finishes.variant}` : null,
                                  ].filter(Boolean).join(" · ")
                                : "";
                              const finishLine = finishes ? `\nLocked finishes: ${finishes}.` : "";
                              const resumeText =
                                `[Resume — continue from where we left off; do NOT re-ask qualifiers I've already answered in the brief below. Acknowledge briefly and take the next concrete step in stage "${stage}".]\n\n` +
                                `Current brief so far:\n${brief}${product}${finishLine}\n\n` +
                                (item.text ? `My last message was: "${item.text}". Please continue.` : `Please continue building the brief.`);
                              send(resumeText);
                            }}
                            className="rounded-full border border-accent/50 bg-accent/10 px-4 py-1.5 text-[13px] text-foreground inline-flex items-center gap-1.5 hover:bg-accent/20 disabled:opacity-40"
                            title="Continue from the last saved brief without repeating earlier questions"
                          >
                            Resume brief
                          </button>
                        );
                      })()}
                      <button
                        type="button"
                        onClick={() => setTimeline((prev) => prev.filter((_, idx) => idx !== i))}
                        className="rounded-full border border-border bg-background px-3 py-1 font-body text-xs text-foreground hover:bg-accent/10 hover:border-accent/40"
                      >
                        Dismiss
                      </button>
                    </div>
                  </div>
                );
              }
              if (item.kind === "escalation") {
                return (
                  <EscalationCard
                    key={i}
                    sentiment={item.sentiment}
                    intent={item.intent}
                    resolved={item.resolved}
                    onAction={async (action) => {
                      if (action === "dismissed") {
                        setTimeline((prev) => {
                          const copy = prev.slice();
                          const t = copy[i];
                          if (t?.kind === "escalation") copy[i] = { ...t, resolved: "dismissed" };
                          return copy;
                        });
                        return;
                      }
                      try {
                        const { supabase } = await import("@/integrations/supabase/client");
                        const { data: sess } = await supabase.auth.getSession();
                        const token = sess.session?.access_token;
                        if (!token) {
                          toast.error("Please sign in to request a human concierge.");
                          return;
                        }
                        const resp = await fetch(
                          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/notify-escalation`,
                          {
                            method: "POST",
                            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                            body: JSON.stringify({
                              sentiment: item.sentiment,
                              intent: item.intent,
                              excerpt: item.excerpt,
                            }),
                          },
                        );
                        if (!resp.ok) throw new Error(`Error ${resp.status}`);
                        toast.success("A concierge has been notified — they'll be in touch shortly.");
                        setTimeline((prev) => {
                          const copy = prev.slice();
                          const t = copy[i];
                          if (t?.kind === "escalation") copy[i] = { ...t, resolved: "requested" };
                          return copy;
                        });
                      } catch (e) {
                        toast.error("Could not reach the concierge — please try again.");
                      }
                    }}
                  />
                );
              }
              if (item.kind === "quote_proposal") {
                return (
                  <QuoteProposalCard
                    key={i}
                    proposal={item.proposal}
                    onResolved={(outcome, info) => {
                      setTimeline((prev) => {
                        const copy = prev.slice();
                        const t = copy[i];
                        if (t?.kind === "quote_proposal") copy[i] = { ...t, resolved: outcome };
                        const msg =
                          outcome === "discarded"
                            ? "Got it — quote draft discarded."
                            : info?.mode === "append"
                              ? `✓ Added ${info.added} ${info.added === 1 ? "line" : "lines"} to your quote. Open it whenever you're ready.`
                              : `✓ Quote drafted. Open it whenever you're ready — anything else?`;
                        copy.push({ kind: "msg", role: "assistant", content: msg });
                        return copy;
                      });
                    }}
                  />
                );
              }
              if (item.kind === "ffe_proposal") {
                return (
                  <FfeProposalCard
                    key={i}
                    proposal={item.proposal}
                    onResolved={(outcome, info) => {
                      setTimeline((prev) => {
                        const copy = prev.slice();
                        const t = copy[i];
                        if (t?.kind === "ffe_proposal") copy[i] = { ...t, resolved: outcome };
                        const msg =
                          outcome === "discarded"
                            ? "Got it — FF&E schedule discarded."
                            : `✓ FF&E schedule drafted — ${info?.added ?? 0} ${info?.added === 1 ? "row" : "rows"} across ${info?.rooms ?? 0} ${info?.rooms === 1 ? "room" : "rooms"}. Open the quote when you want to refine it.`;
                        copy.push({ kind: "msg", role: "assistant", content: msg });
                        return copy;
                      });
                    }}
                  />
                );
              }
              if (item.kind === "viz_brief") {
                return (
                  <VisualizationBriefCard
                    key={i}
                    proposal={item.proposal}
                    resolved={item.resolved}
                    onResolved={(outcome) => {
                      setTimeline((prev) => {
                        const copy = prev.slice();
                        const t = copy[i];
                        if (t?.kind === "viz_brief") copy[i] = { ...t, resolved: outcome };
                        const msg =
                          outcome === "discarded"
                            ? "Got it — brief discarded."
                            : "✓ Brief loaded in Axonometric Studio. Use the page’s Generate Axonometric View button after adding a source image.";
                        copy.push({ kind: "msg", role: "assistant", content: msg });
                        return copy;
                      });
                    }}
                  />
                );
              }
              if (item.kind === "pending_proposal") {
                return <PendingProposalSkeleton key={i} tool={item.tool} />;
              }
              if (item.kind === "proactive_tearsheet") {
                const data = item.data;
                const finishSummary = [data.fabricLabel, data.baseLabel, data.topLabel]
                  .filter(Boolean)
                  .join(" · ");
                const resolveAt = (outcome: "generated" | "boarded" | "dismissed") => {
                  setTimeline((prev) => {
                    const copy = prev.slice();
                    const t = copy[i];
                    if (t?.kind === "proactive_tearsheet") copy[i] = { ...t, resolved: outcome };
                    return copy;
                  });
                };
                return (
                  <ProactiveTearsheetCard
                    key={i}
                    data={data}
                    resolved={item.resolved}
                    onGenerate={async () => {
                      resolveAt("generated");
                      // Direct edge-function call so the exact finish selection is
                      // persisted on the board item (bypasses the LLM which can't
                      // see the fabric/base/top labels the user just picked).
                      try {
                        const title = `${data.productName}${finishSummary ? ` — ${finishSummary}` : ""}`.slice(0, 120);
                        const { data: res, error } = await supabase.functions.invoke("trade-concierge-commit", {
                          body: {
                            tool: "propose_tearsheet",
                            args: {
                              title,
                              pick_ids: [data.productId],
                              finishes: [{
                                pick_id: data.productId,
                                variant_label: data.topLabel || null,
                                fabric_label: data.fabricLabel || null,
                                wood_label: data.baseLabel || null,
                              }],
                            },
                          },
                        });
                        if (error) throw error;
                        const url: string | undefined = (res as any)?.url;
                        setTimeline((prev) => {
                          const copy = prev.slice();
                          copy.push({
                            kind: "msg",
                            role: "assistant",
                            content: url
                              ? `✓ Tearsheet locked in with ${finishSummary || "your current selection"}. [Open tearsheet](${url})`
                              : "✓ Tearsheet saved with your current finish selection.",
                          });
                          return copy;
                        });
                      } catch (err) {
                        console.error("proactive tearsheet direct commit failed", err);
                        // Fallback to LLM path
                        const prompt = `Generate a tearsheet for ${data.productName}${finishSummary ? ` — ${finishSummary}` : ""}. Lock in the current trade price${data.tradePriceLabel ? ` (${data.tradePriceLabel})` : ""}${data.leadTimeLabel ? ` and ${data.leadTimeLabel} lead time` : ""}.`;
                        void sendRef.current?.(prompt, { displayText: "Generate tearsheet with current finish selection" });
                      }
                    }}
                    onAddToBoard={() => {
                      resolveAt("boarded");
                      const prompt = `Add ${data.productName}${finishSummary ? ` — ${finishSummary}` : ""} to my project board.`;
                      void sendRef.current?.(prompt, { displayText: "Add current selection to project board" });
                    }}
                    onDismiss={() => resolveAt("dismissed")}
                  />
                );
              }
              if (item.kind !== "proposal") return null;
              return (
                <TearsheetProposalCard
                  key={i}
                  proposal={item.proposal}
                  excluded={new Set(item.excluded || [])}
                  locked={new Set(item.locked || [])}
                  newPickIds={item.newPickIds}
                  onExcludedChange={(next) => {
                    setTimeline((prev) => {
                      const copy = prev.slice();
                      const t = copy[i];
                      if (t?.kind === "proposal") {
                        copy[i] = { ...t, excluded: Array.from(next) };
                      }
                      return copy;
                    });
                  }}
                  onLockedChange={(next) => {
                    setTimeline((prev) => {
                      const copy = prev.slice();
                      const t = copy[i];
                      if (t?.kind === "proposal") {
                        copy[i] = { ...t, locked: Array.from(next) };
                      }
                      return copy;
                    });
                  }}
                  onResolved={(outcome, info) => handleProposalResolved(i, outcome, info)}
                />
              );
            })}
            {showTypingDots && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl rounded-bl-md px-3.5 py-2.5">
                  <DotCircleLoader size="sm" className="text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className={cn("border-t border-border p-3 shrink-0 min-h-0", fullscreen && "flex flex-col gap-3 overflow-hidden", fullscreen && (briefBuilderOpen ? "max-h-[78vh]" : "max-h-[45vh]"))}>
            <div className={cn(fullscreen && "flex-1 min-h-0 overflow-y-auto")}>

            {/* Correlation-id chip — copy-to-clipboard trace id for the
                current concierge turn. Matches the server's SSE `event: request_id`
                and every `concierge_inspector` log line for this run. */}
            {lastRequestId && (
              <div className="mb-2 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(lastRequestId);
                      setReqIdCopied(true);
                      setTimeout(() => setReqIdCopied(false), 1400);
                    } catch { /* ignore */ }
                  }}
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5 font-mono hover:bg-muted transition-colors"
                  title="Copy request_id — paste into server logs to trace this run"
                  aria-label={`Copy request id ${lastRequestId}`}
                >
                  <span className="opacity-70">id</span>
                  <span className="tabular-nums">{lastRequestId.slice(0, 8)}</span>
                  {reqIdCopied ? <Check className="h-2.5 w-2.5 text-emerald-600" /> : <Copy className="h-2.5 w-2.5" />}
                </button>
                {lastInspectorCount > 0 && (
                  <span
                    className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-1.5 py-0.5"
                    title={`Inspector Agent ran ${lastInspectorCount} time${lastInspectorCount === 1 ? "" : "s"} this turn`}
                  >
                    <ShieldCheck className="h-2.5 w-2.5" />
                    inspector×{lastInspectorCount}
                  </span>
                )}
              </div>
            )}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {attachments.map((a) => (
                  <div
                    key={a.id}
                    className={`flex items-center gap-2 rounded-lg border pl-1.5 pr-1 py-1 text-xs ${
                      a.role === "moodboard"
                        ? "border-accent/60 bg-accent/10"
                        : "border-border bg-muted/40"
                    }`}
                  >
                    {a.kind === "image" && a.previewUrl ? (
                      <img
                        src={a.previewUrl}
                        alt={a.name}
                        className="h-7 w-7 rounded object-cover"
                      />
                    ) : (
                      <div className="h-7 w-7 rounded bg-foreground/10 grid place-items-center">
                        <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex flex-col min-w-0">
                      <span className="font-body max-w-[140px] truncate text-foreground">{a.name}</span>
                      {a.role === "moodboard" && (
                        <span className="font-body text-[9px] uppercase tracking-[0.1em] text-accent">
                          Mood board · Block 3
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(a.id)}
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                      aria-label={`Remove ${a.name}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {briefBuilderOpen && (
              <BriefBuilder
                value={input}
                onChange={(next) => setInput(next)}
                onClose={() => {
                  // Strip the structured brief from the composer so it doesn't
                  // linger in the "Ask me anything" field after the builder closes.
                  // The draft is still persisted in localStorage and will be
                  // restored the next time the builder is opened.
                  setInput((current) => {
                    const withoutBrief = current
                      .replace(/(^|\n)Block\s+\d+\s*—[\s\S]*?(?=\nBlock\s+\d+\s*—|$)/gi, "")
                      .replace(/\n{3,}/g, "\n\n")
                      .trim();
                    return withoutBrief;
                  });
                  setBriefBuilderOpen(false);
                }}
              />
            )}

            {showBriefPreview && input.trim() && (() => {
              const raw = input.trim();
              const blockRegex = /^Block\s+\d+.*$/gim;
              const headers: string[] = [];
              let m: RegExpExecArray | null;
              while ((m = blockRegex.exec(raw)) !== null) headers.push(m[0]);
              type Section = { header: string | null; body: string };
              const sections: Section[] = [];
              if (headers.length === 0) {
                sections.push({ header: null, body: raw });
              } else {
                const parts = raw.split(/^Block\s+\d+.*$/gim);
                const preface = parts.shift()?.trim();
                if (preface) sections.push({ header: null, body: preface });
                headers.forEach((h, i) => {
                  sections.push({ header: h.trim(), body: (parts[i] ?? "").trim() });
                });
              }
              const formattedText = sections
                .map((s) => {
                  const isBlock3 = !!s.header && /^Block\s+3\b/i.test(s.header);
                  const moodImages = isBlock3
                    ? attachments.filter((a) => a.role === "moodboard" && a.kind === "image")
                    : [];
                  let block = s.header ? `${s.header}\n${s.body}` : s.body;
                  if (moodImages.length) {
                    block += `\nMOOD BOARD REFERENCES: ${moodImages.map((m) => m.name).join(", ")}`;
                  }
                  return block;
                })
                .join("\n\n") +
                (attachments.length
                  ? "\n\nATTACHMENTS:\n" + attachments.map((a) => `- ${a.name}`).join("\n")
                  : "");
              return (
                <div className="mb-2 rounded-xl border border-accent/40 bg-muted/30 p-3 max-h-[45vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">
                      Brief preview
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(formattedText);
                            setPreviewCopied(true);
                            setTimeout(() => setPreviewCopied(false), 1400);
                          } catch { /* ignore */ }
                        }}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                        title="Copy formatted brief"
                        aria-label="Copy formatted brief"
                      >
                        {previewCopied ? (
                          <Check className="h-3.5 w-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowBriefPreview(false)}
                        className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-foreground/10"
                        aria-label="Close preview"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {sections.map((s, i) => {
                      const isBlock3 = !!s.header && /^Block\s+3\b/i.test(s.header);
                      const moodImages = isBlock3
                        ? attachments.filter((a) => a.role === "moodboard" && a.kind === "image")
                        : [];
                      return (
                        <div key={i}>
                          {s.header && (
                            <div className="font-heading text-[12px] font-semibold text-accent mb-1">
                              {s.header}
                            </div>
                          )}
                          <pre className="whitespace-pre-wrap font-body text-[12px] leading-relaxed text-foreground">
                            {s.body}
                          </pre>
                          {moodImages.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {moodImages.map((m) => (
                                <img
                                  key={m.id}
                                  src={m.previewUrl || m.dataUrl}
                                  alt={m.name}
                                  className="h-14 w-14 rounded object-cover border border-accent/40"
                                  title={m.name}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {attachments.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-border/60">
                      <div className="font-body text-[10px] uppercase tracking-[0.12em] text-muted-foreground mb-1">
                        Attachments ({attachments.length})
                      </div>
                      <ul className="font-body text-[11px] text-muted-foreground space-y-0.5">
                        {attachments.map((a) => (
                          <li key={a.id} className="truncate">• {a.name}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}
            </div>
            <div className={cn("flex items-end gap-2", fullscreen && "shrink-0")}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
              />
              <input
                ref={moodInputRef}
                type="file"
                multiple
                accept="image/*"
                className="hidden"
                onChange={(e) => handleMoodBoardPicked(e.target.files)}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={streaming || attachments.length >= MAX_ATTACHMENTS}
                className="shrink-0 rounded-xl border border-border bg-muted/40 p-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                aria-label="Attach room plan, image or PDF"
                title="Attach a room plan, photo or PDF"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moodInputRef.current?.click()}
                disabled={streaming || attachments.length >= MAX_ATTACHMENTS}
                className="shrink-0 rounded-xl border border-border bg-muted/40 p-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                aria-label="Attach mood board images to Block 3"
                title="Attach mood board (images bound to Block 3)"
              >
                <Palette className="h-4 w-4" />
              </button>
              {!briefBuilderOpen && (
                <button
                  type="button"
                  onClick={() => {
                    if (!/Block\s+1\s*—/i.test(input)) {
                      const current = input.trim();
                      const next = current
                        ? `${input.replace(/\s+$/, "")}\n\n${SPEC_BRIEF_TEMPLATE}`
                        : SPEC_BRIEF_TEMPLATE;
                      setInput(next);
                    }
                    setBriefBuilderOpen(true);
                  }}
                  disabled={streaming}
                  className="shrink-0 rounded-xl border border-border bg-muted/40 p-2 text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-40 transition-colors"
                  aria-label="Open Architectural Brief Builder"
                  title="Open Architectural Brief Builder"
                >
                  <LayoutList className="h-4 w-4" />
                </button>
              )}


              <button
                type="button"
                onClick={() => setShowBriefPreview((v) => !v)}
                disabled={!input.trim()}
                className={`shrink-0 rounded-xl border p-2 disabled:opacity-40 transition-colors ${
                  showBriefPreview
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                aria-label={showBriefPreview ? "Hide brief preview" : "Preview brief"}
                aria-pressed={showBriefPreview}
                title={showBriefPreview ? "Hide brief preview" : "Preview formatted brief before sending"}
              >
                <Eye className="h-4 w-4" />
              </button>
              {briefBuilderOpen ? (
                <div
                  className={`flex-1 flex items-center gap-2 rounded-xl border border-dashed px-3 py-2 font-body text-xs italic border-accent/50 bg-accent/5 text-muted-foreground`}
                  title={
                    briefValidation.valid
                      ? "Structured brief ready — press Send"
                      : `Optional fields still empty: ${briefValidation.missing.join(", ")} — send anyway if you like`
                  }
                >
                  <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-background/80 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-foreground">
                    <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                    Brief Builder Open
                  </span>
                  <span className="truncate flex-1">
                    {briefValidation.valid
                      ? "Structured brief ready · press Send"
                      : `Add ${briefValidation.missing.join(", ")} to improve the brief`}
                  </span>
                  <button
                    type="button"
                    onClick={() => setBriefBuilderOpen(false)}
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    aria-label="Close Brief Builder"
                    title="Close Brief Builder"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (

                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={copy.ask}
                  rows={1}
                  className="flex-1 resize-none rounded-xl border border-border bg-muted/50 px-3 py-2 font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent"
                  disabled={streaming}
                />
              )}

              <button
                onClick={() => send()}
                disabled={
                  (!input.trim() && attachments.length === 0) ||
                  streaming
                }
                className="shrink-0 rounded-xl bg-foreground text-background p-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                aria-label="Send"
                title="Send"
              >
                <Send className="h-4 w-4" />
              </button>

            </div>
            <p className={cn("font-body text-[10px] text-muted-foreground mt-1.5 text-center", fullscreen && "shrink-0")}>
              {copy.footer}
            </p>
          </div>
          </>)}
        </div>
        </>
      )}
      <CnBriefViewingModal
        open={cnViewingOpen}
        onOpenChange={setCnViewingOpen}
        sessionId={typeof window !== "undefined" ? sessionStorage.getItem("cn_portal:session_id") : null}
        invitedName={typeof window !== "undefined" ? sessionStorage.getItem("cn_portal:invited_name") : null}
        messages={timeline.filter((t) => t.kind === "msg").map((t: any) => ({ role: t.role, content: t.content }))}
      />
    </>
  );
}
