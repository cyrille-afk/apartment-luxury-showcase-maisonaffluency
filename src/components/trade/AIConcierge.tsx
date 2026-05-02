import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2, Sparkles, Minus, GripHorizontal } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { streamConcierge, type ChatMessage, type TearsheetProposal } from "@/lib/tradeConciergeStream";
import { TearsheetProposalCard } from "@/components/trade/concierge/TearsheetProposalCard";
import { toast } from "sonner";

const GREETING = "Hello! I'm your Maison Affluency concierge. How can I assist you today — looking for a specific piece, exploring a designer, or building a tearsheet?";

export type ConciergeQuickAction = { label: string; prompt: string };

type TimelineItem =
  | { kind: "msg"; role: "user" | "assistant"; content: string; actions?: ConciergeQuickAction[] }
  | { kind: "proposal"; proposal: TearsheetProposal; resolved?: "approved" | "discarded" };

type Stage = "Discover" | "Tearsheet" | "Quote" | "Order" | "Project";

const stageFromPath = (pathname: string): Stage => {
  if (pathname.startsWith("/trade/quotes") || pathname.includes("/quote/")) return "Quote";
  if (pathname.startsWith("/trade/boards") || pathname.startsWith("/trade/tearsheets")) return "Tearsheet";
  if (pathname.startsWith("/trade/orders") || pathname.startsWith("/trade/order")) return "Order";
  if (pathname.startsWith("/trade/projects")) return "Project";
  return "Discover";
};

export function AIConcierge() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const isDashboard = pathname === "/trade";
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [timeline, setTimeline] = useState<TimelineItem[]>([
    { kind: "msg", role: "assistant", content: GREETING },
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
  const PANEL_W = 380;
  const PANEL_H_OPEN = 560;
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

  // Reset any sticky stage override when the route changes
  useEffect(() => { setStageOverride(null); }, [pathname]);

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
        | { message?: string; openPanel?: boolean; stage?: Stage; actions?: ConciergeQuickAction[] }
        | undefined;
      const message = detail?.message?.trim();
      if (message) {
        setTimeline((prev) => [
          ...prev,
          {
            kind: "msg",
            role: "assistant",
            content: message,
            actions: detail?.actions && detail.actions.length > 0 ? detail.actions : undefined,
          },
        ]);
      }
      if (detail?.stage) setStageOverride(detail.stage);
      if (detail?.openPanel) setOpen(true);
    };
    window.addEventListener("concierge:stage", handler as EventListener);
    return () => window.removeEventListener("concierge:stage", handler as EventListener);
  }, []);

  const send = useCallback(async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || streaming) return;

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
    const messagesForApi: ChatMessage[] = [
      stageContext,
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
      // Insert as its own timeline item (after current assistant text, if any)
      setTimeline((prev) => [...prev, { kind: "proposal", proposal }]);
    };

    try {
      await streamConcierge({
        messages: messagesForApi,
        onDelta: upsertAssistant,
        onProposal: handleProposal,
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
  }, [input, streaming, timeline, stage]);

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
          className="fixed top-[4.5rem] right-4 z-[100] flex items-center gap-2 rounded-full bg-foreground text-background px-4 py-2.5 shadow-lg hover:opacity-90 transition-opacity print:hidden"
          aria-label="Open AI Concierge"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span className="font-body text-[11px] uppercase tracking-widest hidden sm:inline">Concierge</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div
          data-concierge-panel
          style={pos ? { top: pos.y, left: pos.x, right: "auto", bottom: "auto" } : undefined}
          className={cn(
            "fixed z-[100] w-[380px] max-w-[calc(100vw-2rem)] flex flex-col rounded-2xl border border-border bg-background shadow-2xl print:hidden animate-fade-in",
            !pos && "bottom-20 md:bottom-6 right-4",
            minimized ? "h-auto" : "h-[560px] max-h-[calc(100vh-6rem)]"
          )}
        >
          <div
            onPointerDown={onDragStart}
            onPointerMove={onDragMove}
            onPointerUp={onDragEnd}
            onPointerCancel={onDragEnd}
            onDoubleClick={() => setMinimized((m) => !m)}
            className="flex items-center justify-between px-4 py-3 border-b border-border cursor-grab active:cursor-grabbing select-none touch-none"
            title="Drag to move · double-click to collapse"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground shrink-0" aria-hidden="true" />
              <Sparkles className="h-4 w-4 text-accent shrink-0" />
              <span className="font-display text-sm uppercase tracking-widest">Concierge</span>
              {!minimized && (
                <span
                  className="ml-1 inline-flex items-center gap-1 rounded-full border border-border bg-muted/60 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-muted-foreground"
                  title={`Current workflow stage: ${stage}`}
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
                  Stage: {stage}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
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
                onClick={() => setOpen(false)}
                className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {!minimized && (<>

          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {timeline.map((item, i) => {
              if (item.kind === "msg") {
                return (
                  <div key={i} className={cn("flex flex-col gap-2", item.role === "user" ? "items-end" : "items-start")}>
                    <div
                      className={cn(
                        "max-w-[85%] rounded-2xl px-3.5 py-2.5 font-body text-sm leading-relaxed whitespace-pre-wrap",
                        item.role === "user"
                          ? "bg-foreground text-background rounded-br-md"
                          : "bg-muted text-foreground rounded-bl-md"
                      )}
                    >
                      {item.content}
                    </div>
                    {item.role === "assistant" && item.actions && item.actions.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 max-w-[85%]">
                        {item.actions.map((a, idx) => (
                          <button
                            key={idx}
                            onClick={() => send(a.prompt)}
                            disabled={streaming}
                            className="rounded-full border border-border bg-background hover:bg-accent/10 hover:border-accent/40 transition-colors px-3 py-1 font-body text-xs text-foreground disabled:opacity-40"
                          >
                            {a.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              }
              return (
                <TearsheetProposalCard
                  key={i}
                  proposal={item.proposal}
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
                placeholder="Ask me anything…"
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
              AI-powered · Tearsheet drafts require your approval
            </p>
          </div>
        </div>
      )}
    </>
  );
}
