import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, Minus, GripHorizontal, RotateCcw, Maximize2, Minimize2, Palette, Check, Languages, Pencil } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { streamConcierge, type ChatMessage, type TearsheetProposal } from "@/lib/tradeConciergeStream";
import { TearsheetProposalCard } from "@/components/trade/concierge/TearsheetProposalCard";
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

type TimelineItem =
  | { kind: "msg"; role: "user" | "assistant"; content: string; actions?: ConciergeQuickAction[]; onboarding?: boolean; sourceContent?: string; sourceActions?: ConciergeQuickAction[] }
  | { kind: "proposal"; proposal: TearsheetProposal; resolved?: "approved" | "discarded"; excluded?: string[]; newPickIds?: string[] }
  | { kind: "escalation"; sentiment: string; intent: string; excerpt: ChatMessage[]; resolved?: "requested" | "dismissed" };

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
  toneSystemNote,
  loadName,
  saveName,
  sanitizeName,
  nameSystemNote,
  DEFAULT_NAME,
} from "./conciergeGreeting";
import { supabase } from "@/integrations/supabase/client";

const hasWelcomeActions = (actions: ConciergeQuickAction[] | undefined) =>
  !!actions?.some((action) => isOnboardingActionPrompt(action.prompt));


export function AIConcierge() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDashboard = pathname === "/trade";
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [tone, setTone] = useState<Tone>(() => loadTone());
  const [lang, setLang] = useState<Lang>(() => loadLang());
  const [name, setName] = useState<string>(() => loadName());
  const [nameDraft, setNameDraft] = useState<string>("");
  const [nameMenuOpen, setNameMenuOpen] = useState(false);
  const [toneMenuOpen, setToneMenuOpen] = useState(false);
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>(() => [
    { kind: "msg", role: "assistant", content: greetingForContext(stageFromPath(pathname), pathname, loadTone(), loadLang()) },
  ]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [stageOverride, setStageOverride] = useState<Stage | null>(null);
  const stage: Stage = stageOverride ?? stageFromPath(pathname);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

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
      if (only.onboarding || hasWelcomeActions(only.actions)) {
        const sourceContent = only.sourceContent ?? only.content;
        const sourceActions = only.sourceActions ?? only.actions;
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
      const next = greetingForContext(stageFromPath(pathname), pathname, tone, lang);
      if (only.content === next) return prev;
      return [{ kind: "msg", role: "assistant", content: next }];
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
  }, [pathname, tone, lang, name]);

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

  // auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
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
        | { message?: string; openPanel?: boolean; stage?: Stage; actions?: ConciergeQuickAction[]; resetPanel?: boolean; replaceTimeline?: boolean; onboarding?: boolean }
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
    };
    window.addEventListener("concierge:stage", handler as EventListener);
    return () => window.removeEventListener("concierge:stage", handler as EventListener);
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

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

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

    const userItem: TimelineItem = { kind: "msg", role: "user", content: text };
    const nextTimeline = [...timeline, userItem];
    setTimeline(nextTimeline);
    setInput("");
    setStreaming(true);

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
    const proposalContext: ChatMessage[] = [];
    if (lastProposal) {
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

    const messagesForApi: ChatMessage[] = [
      stageContext,
      toneContext,
      ...identityContext,
      ...proposalContext,
      ...nextTimeline
        .filter((t): t is Extract<TimelineItem, { kind: "msg" }> => t.kind === "msg")
        .map((t) => ({ role: t.role, content: t.content })),
    ];

    let assistantSoFar = "";
    let assistantStarted = false;
    const controller = new AbortController();
    abortRef.current = controller;

    const upsertAssistant = (chunk: string) => {
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

    const handleProposal = (proposal: TearsheetProposal) => {
      // Compute which picks are NEW relative to the previous proposal so the
      // card can highlight rationales for replacements/additions only.
      const prevIds = new Set(
        lastProposal ? lastProposal.proposal.preview.map((p) => p.id) : [],
      );
      const newPickIds = proposal.preview.map((p) => p.id).filter((id) => !prevIds.has(id));
      // Insert as its own timeline item (after current assistant text, if any)
      setTimeline((prev) => [...prev, { kind: "proposal", proposal, newPickIds }]);
    };

    try {
      await streamConcierge({
        messages: messagesForApi,
        onDelta: upsertAssistant,
        onProposal: handleProposal,
        onEscalation: (ev) => {
          setTimeline((prev) => [
            ...prev,
            { kind: "escalation", sentiment: ev.sentiment, intent: ev.intent, excerpt: ev.excerpt },
          ]);
        },
        onDone: () => setStreaming(false),
        onError: (msg) => {
          toast.error(msg);
          setStreaming(false);
        },
        signal: controller.signal,
      });
    } catch {
      setStreaming(false);
    }
  }, [input, streaming, timeline, stage, tone, lang, name]);

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
        content = `✓ Tearsheet created${trail}`;
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
      {/* Hidden trigger for dashboard inline button */}
      {!open && isDashboard && (
        <button
          onClick={() => setOpen(true)}
          className="sr-only"
          aria-label="Open AI Concierge"
        />
      )}

      {/* Floating trigger on all non-dashboard pages */}
      {!open && !isDashboard && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-20 md:bottom-6 right-4 z-[100] flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2.5 shadow-lg hover:opacity-90 transition-opacity print:hidden"
          aria-label="Open AI Concierge"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-body text-[11px] uppercase tracking-widest hidden sm:inline">{name}</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          data-concierge-panel
          style={pos ? { top: pos.y, left: pos.x, right: "auto", bottom: "auto", width: PANEL_W } : { width: PANEL_W }}
          className={cn(
            "fixed z-[100] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl print:hidden animate-fade-in",
            !pos && "bottom-20 md:bottom-6 right-4",
            minimized ? "h-auto" : (expanded ? "h-[760px] max-h-[calc(100vh-4rem)]" : "h-[560px] max-h-[calc(100vh-6rem)]")
          )}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={() => setMinimized((m) => !m)}
            className="flex flex-col gap-1.5 px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing select-none touch-none"
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
                    className="absolute right-0 top-full mt-1 z-[110] w-64 rounded-lg border border-border bg-popover shadow-xl overflow-hidden p-3"
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
                    className="absolute right-0 top-full mt-1 z-[110] w-60 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
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
                    className="absolute right-0 top-full mt-1 z-[110] w-52 rounded-lg border border-border bg-popover shadow-xl overflow-hidden"
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
                  abortRef.current?.abort();
                  setStreaming(false);
                  setInput("");
                  setStageOverride(null);
                  setTimeline([{ kind: "msg", role: "assistant", content: greetingForContext(stageFromPath(pathname), pathname, tone, lang) }]);
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
                return (
                  <div key={i} className={cn("flex flex-col gap-2", item.role === "user" ? "items-end" : "items-start")}>
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
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
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
                disabled={!input.trim() || streaming}
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
      )}
    </>
  );
}
