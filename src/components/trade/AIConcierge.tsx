import { useState, useRef, useEffect, useCallback } from "react";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";
import { X, Send, Loader2, Sparkles, Minus, GripHorizontal, RotateCcw, Maximize2, Minimize2, Palette, Check, Languages, Pencil, Paperclip, FileText, Download, FileDown, Copy, ShieldCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { streamConcierge, type ChatMessage, type ChatContentPart, type TearsheetProposal, type QuoteProposal, type FfeProposal, type VisualizationBriefProposal, type ConciergeProposal, type AppliedConstraintsEvent } from "@/lib/tradeConciergeStream";
import { TearsheetProposalCard } from "@/components/trade/concierge/TearsheetProposalCard";
import { QuoteProposalCard } from "@/components/trade/concierge/QuoteProposalCard";
import { FfeProposalCard } from "@/components/trade/concierge/FfeProposalCard";
import { VisualizationBriefCard, VIZ_BRIEF_INCOMING_KEY } from "@/components/trade/concierge/VisualizationBriefCard";
import { PendingProposalSkeleton } from "@/components/trade/concierge/PendingProposalSkeleton";
import { EscalationCard } from "@/components/trade/concierge/EscalationCard";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
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
  | { kind: "msg"; role: "user" | "assistant"; content: string; actions?: ConciergeQuickAction[]; onboarding?: boolean; sourceContent?: string; sourceActions?: ConciergeQuickAction[]; attachments?: TimelineAttachment[] }
  | { kind: "proposal"; proposal: TearsheetProposal; resolved?: "approved" | "discarded"; excluded?: string[]; newPickIds?: string[] }
  | { kind: "quote_proposal"; proposal: QuoteProposal; resolved?: "approved" | "discarded" }
  | { kind: "ffe_proposal"; proposal: FfeProposal; resolved?: "approved" | "discarded" }
  | { kind: "viz_brief"; proposal: VisualizationBriefProposal; resolved?: "opened" | "discarded" }
  | { kind: "pending_proposal"; tool: PendingProposalTool; toolCallId: string | null; index: number }
  | { kind: "escalation"; sentiment: string; intent: string; excerpt: ChatMessage[]; resolved?: "requested" | "dismissed" }
  | { kind: "retry"; text: string; reason: string };


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
import { useStudio } from "@/hooks/useStudio";
import { useAuth } from "@/hooks/useAuth";

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

export function AIConcierge({ surface = "trade" }: { surface?: ConciergeSurface } = {}) {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const { currentStudio } = useStudio();
  const { user, isAdmin } = useAuth();
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
  const [timeline, setTimeline] = useState<TimelineItem[]>(() => {
    try {
      const raw = sessionStorage.getItem("concierge:timeline");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return sanitizeTimelineForAttachments(parsed as TimelineItem[]);
      }
    } catch {}
    return [
      { kind: "msg", role: "assistant", content: surface === "public" ? PUBLIC_GREETING : greetingForContext(stageFromPath(pathname), pathname, loadTone(), loadLang()).replace(/{concierge_name}/g, name) },
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
      ? PUBLIC_GREETING
      : greetingForContext(stage, contextualPath, tone, targetLang).replace(/{concierge_name}/g, name)
  ), [surface, stage, contextualPath, tone, lang, name]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const STALL_MS = 45_000; // no delta/proposal in 45s ⇒ treat stream as stalled

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
  };
  const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024; // 8 MB per file — base64 inflates ~33%
  const MAX_ATTACHMENTS = 4;
  const [attachments, setAttachments] = useState<StagedAttachment[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

  const handleFilesPicked = useCallback(async (files: FileList | File[] | null) => {
    if (!files) return;
    const list = Array.from(files);
    if (!list.length) return;
    const accepted: StagedAttachment[] = [];
    for (const f of list) {
      if (attachments.length + accepted.length >= MAX_ATTACHMENTS) {
        toast.error(`Maximum ${MAX_ATTACHMENTS} attachments per message.`);
        break;
      }
      const isImage = f.type.startsWith("image/");
      const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
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
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          name: f.name,
          mime: f.type || (isPdf ? "application/pdf" : "image/jpeg"),
          kind: isImage ? "image" : "pdf",
          dataUrl,
          previewUrl: isImage ? dataUrl : undefined,
          size: f.size,
        });
      } catch {
        toast.error(`Couldn't read ${f.name}.`);
      }
    }
    if (accepted.length) setAttachments((prev) => [...prev, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [attachments.length]);

  const removeAttachment = (id: string) =>
    setAttachments((prev) => prev.filter((a) => a.id !== id));


  // Draggable position — persisted in localStorage. `null` = use default
  // bottom-right anchor; once user drags, we switch to absolute top/left.
  const [expanded, setExpanded] = useState<boolean>(() => {
    try { return localStorage.getItem("concierge:expanded") === "1"; } catch { return false; }
  });
  const PANEL_W = expanded ? 560 : 380;
  const PANEL_H_OPEN = expanded ? 760 : 560;
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
      // Strip data-URL previewUrls before persisting — they can be multi-MB
      // (large floor-plan PNGs) and blow sessionStorage's ~5MB quota, which
      // would silently drop the whole timeline write. Thumbnails stay in
      // memory for the current page; refresh loses them, full chat is kept.
      const serializable = timeline.map((t) =>
        t.kind === "msg" && t.attachments?.length
          ? { ...t, attachments: t.attachments.map(({ previewUrl: _omit, ...rest }) => rest) }
          : t,
      );
      sessionStorage.setItem("concierge:timeline", JSON.stringify(serializable));
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
        | { message?: string; openPanel?: boolean; stage?: Stage; actions?: ConciergeQuickAction[]; resetPanel?: boolean; replaceTimeline?: boolean; onboarding?: boolean; prefill?: string }
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
      // Prefill support — used by per-SKU "Swap" buttons on the concierge
      // cards. We drop the text into the composer, focus it, and let the
      // user edit/confirm before sending. Never auto-send.
      if (typeof detail?.prefill === "string" && detail.prefill.trim().length > 0) {
        setInput(detail.prefill);
        setMinimized(false);
        setOpen(true);
        setTimeout(() => {
          const el = inputRef.current;
          if (el) {
            el.focus();
            // Move caret to end so the user can extend the prompt.
            const len = el.value.length;
            try { el.setSelectionRange(len, len); } catch { /* jsdom */ }
            el.scrollIntoView({ block: "nearest", behavior: "smooth" });
          }
        }, 60);
      }
    };
    window.addEventListener("concierge:stage", handler as EventListener);
    return () => window.removeEventListener("concierge:stage", handler as EventListener);
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

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    // Allow sending with attachments only (no text) — use a tiny default prompt.
    const hasFiles = attachments.length > 0;
    if (!text && !hasFiles) return;
    if (streaming) return;

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
    const displayText = text;
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

    // Build the chat message history for the API (text-only items),
    // prefixed with a lightweight stage-context note so the assistant
    // always references the user's current workflow stage.
    const stageContext: ChatMessage = {
      role: "user",
      content: `[Workflow context] Current stage: ${stage}. Tailor guidance to this stage and reference it explicitly when helpful.`,
    };

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
      const kept = lastProposal.proposal.preview.filter((p) => !excludedSet.has(p.id));
      const removed = lastProposal.proposal.preview.filter((p) => excludedSet.has(p.id));
      const fmt = (p: { id: string; title: string; designer_name: string | null }) =>
        `  - "${p.title}" by ${p.designer_name || "—"} [id: ${p.id}]`;
      const lines: string[] = [
        `[Current tearsheet draft state — preserve KEPT items verbatim in any new proposal.]`,
        `KEPT (must remain in the next proposal, with the SAME ids):`,
        kept.length ? kept.map(fmt).join("\n") : "  (none)",
      ];
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
      parts.push({ type: "text", text: text || "Please review the attached file(s) and tell me what details would help refine your curation." });
      for (const a of sendingAttachments) {
        if (a.kind === "image") {
          parts.push({ type: "image_url", image_url: { url: a.dataUrl } });
        } else {
          parts.push({ type: "file", file: { filename: a.name, file_data: a.dataUrl } });
        }
      }
      currentUserMsg = { role: "user", content: parts };
    } else {
      currentUserMsg = { role: "user", content: text };
    }

    const messagesForApi: ChatMessage[] = [
      stageContext,
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
            copy[idx] = { ...last, content: assistantSoFar };
            return copy;
          }
        }
        assistantStarted = true;
        return [...prev, { kind: "msg", role: "assistant", content: assistantSoFar }];
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
      setTimeline((prev) => swapPendingWithReal(prev, tcid, proposal.tool, { kind: "proposal", proposal, newPickIds }));
    };


    // Active project from cross-page session storage (set by useProjectFilter).
    let projectId: string | null = null;
    try { projectId = sessionStorage.getItem("trade:lastProjectFilter"); } catch {}

    try {
      await streamConcierge({
        messages: messagesForApi,
        projectId,
        surface,
        lang,
        onDelta: upsertAssistant,
        onProposal: handleProposal,
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
          } else {
            // Surface a retry card instead of a fire-and-forget toast so the
            // user has a one-click path back to a working turn.
            const friendly = /IDLE_TIMEOUT|504|timeout/i.test(msg)
              ? "The concierge timed out before answering."
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
            !modalMode && !pos && "bottom-20 md:bottom-6 right-4",
            minimized ? "h-auto" : (expanded ? "h-[760px] max-h-[calc(100vh-4rem)]" : "h-[560px] max-h-[calc(100vh-6rem)]")
          )}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={() => setMinimized((m) => !m)}
            className={cn(
              "flex flex-col gap-1.5 px-4 py-3 border-b cursor-grab active:cursor-grabbing select-none touch-none",
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
              <div className="flex items-center pl-6">
                <span
                  className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-muted-foreground"
                  title={`Current workflow stage: ${stage}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  {copy.stage}: {stage}
                </span>
              </div>
            )}
          </div>

          {!minimized && (<>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
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
                              p: ({ node, ...props }) => <p className="my-0" {...props} />,
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
                            {item.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <span className="whitespace-pre-wrap">{item.content}</span>
                      )}
                    </div>
                    )}
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
              if (item.kind !== "proposal") return null;
              return (
                <TearsheetProposalCard
                  key={i}
                  proposal={item.proposal}
                  excluded={new Set(item.excluded || [])}
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

          <div className="border-t border-border p-3">
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
                    className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 pl-1.5 pr-1 py-1 text-xs"
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
                    <span className="font-body max-w-[140px] truncate text-foreground">{a.name}</span>
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
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => handleFilesPicked(e.target.files)}
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
              <button
                onClick={() => send()}
                disabled={(!input.trim() && attachments.length === 0) || streaming}
                className="shrink-0 rounded-xl bg-foreground text-background p-2 disabled:opacity-40 hover:opacity-90 transition-opacity"
                aria-label="Send"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <p className="font-body text-[10px] text-muted-foreground mt-1.5 text-center">
              {copy.footer}
            </p>
          </div>
          </>)}
        </div>
        </>
      )}
    </>
  );
}
