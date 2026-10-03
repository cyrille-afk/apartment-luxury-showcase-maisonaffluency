import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUp, Clock, FileText, ImagePlus, Plus, Square, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCurationThread } from "@/hooks/useCurationThread";
import { useProjectFilter } from "@/hooks/useProjectFilter";
import { useProjects } from "@/hooks/useProjects";
import { MessageResponse } from "@/components/ai-elements/message";
import { FlashSkeleton, FrontierSkeleton } from "@/components/CuratorialGuideRouter";
import { DotCircleLoader } from "@/components/ui/dot-circle-loader";

const AIConcierge = lazy(() =>
  import("@/components/trade/AIConcierge").then((m) => ({ default: m.AIConcierge })),
);

const QUICK_STARTS = [
  "Create a living room scheme",
  "Check COM fabric compatibility",
  "Pair a bronze side table with a bouclé lounge chair",
  "Suggest lighting for a double-height entrance",
];

interface ThreadRow { id: string; title: string; updated_at: string }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** One workspace session = one embedded Felix mount, keyed by this id. */
interface WorkspaceSession { key: number; seedPrompt: string; pendingAction?: string; fresh: boolean }
interface PastItem { id: string; title: string; updated_at: string; kind: "curation" | "workspace" }

export default function TradeConcierge() {
  const { threadId } = useParams<{ threadId?: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [threads, setThreads] = useState<ThreadRow[]>([]);
  const [wsThreads, setWsThreads] = useState<ThreadRow[]>([]);
  const [threadsLoaded, setThreadsLoaded] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [workspace, setWorkspace] = useState<WorkspaceSession | null>(null);
  const [listAtBottom, setListAtBottom] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingRef = useRef<string | null>(null);

  // Bind the concierge contextually to the project chosen in the header switcher.
  const { projectFilter } = useProjectFilter();
  const { projects } = useProjects({ activeOnly: false });
  const activeProject = projectFilter ? projects.find((p) => p.id === projectFilter) : undefined;

  // Per-user, per-project persistence of the Felix workspace.
  const projectKey = projectFilter || "none";
  const openFlagKey = user ? `concierge:workspaceOpen:${user.id}:${projectKey}` : null;
  const wsThreadKey = user ? `concierge:workspaceThread:${user.id}:${projectKey}` : null;
  const readLS = (k: string | null) => { if (!k) return null; try { return localStorage.getItem(k); } catch { return null; } };
  const writeLS = (k: string | null, v: string | null) => {
    if (!k) return;
    try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ }
  };
  const activeWsThread = readLS(wsThreadKey);

  const loadThreads = useCallback(async () => {
    if (!user) return;
    let wq = supabase.from("concierge_threads").select("id, title, updated_at:last_active_at")
      .eq("workspace", true).neq("title", "New conversation");
    wq = projectFilter ? wq.eq("project_id", projectFilter) : wq.is("project_id", null);
    const [c, w] = await Promise.all([
      supabase.from("curation_threads").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50),
      wq.order("last_active_at", { ascending: false }).limit(50),
    ]);
    if (!c.error) setThreads(c.data ?? []);
    if (!w.error) setWsThreads((w.data ?? []) as ThreadRow[]);
    setThreadsLoaded(true);
  }, [user, projectFilter]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  const pastItems: PastItem[] = [
    ...wsThreads.map((t) => ({ ...t, kind: "workspace" as const })),
    ...threads.map((t) => ({ ...t, kind: "curation" as const })),
  ].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  // Restore the selected project's open workspace on mount / project switch.
  useEffect(() => {
    if (!user || threadId) return;
    setWorkspace((w) => readLS(openFlagKey) === "1"
      ? { key: (w?.key ?? 0) + 1, seedPrompt: "", fresh: false }
      : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, projectKey]);

  // Refresh the rail periodically while a workspace is open so new turns surface.
  useEffect(() => {
    if (!workspace) return;
    const t = window.setInterval(() => void loadThreads(), 15000);
    return () => window.clearInterval(t);
  }, [workspace, loadThreads]);

  const { loadedFor, messages, phase, route, fallback, error, send, stop, busy } = useCurationThread(threadId, loadThreads);

  // A prompt typed on the blank page creates a thread, navigates, then sends.
  useEffect(() => {
    if (threadId && loadedFor === threadId && phase === "idle" && pendingRef.current) {
      const p = pendingRef.current; pendingRef.current = null;
      void send(p, threadId);
    }
  }, [threadId, loadedFor, phase, send]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, phase]);

  useEffect(() => { if (!busy && !workspace) inputRef.current?.focus(); }, [busy, threadId, workspace]);

  // Opening a saved curation leaves the Felix workspace (without forgetting it).
  useEffect(() => { if (threadId) setWorkspace(null); }, [threadId]);

  // Fire a queued tool action (e.g. open the moodboard picker) once the
  // embedded workspace has mounted and attached its listener.
  useEffect(() => {
    if (!workspace?.pendingAction) return;
    const action = workspace.pendingAction;
    const t = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent("concierge:action", { detail: action }));
      setWorkspace((w) => (w ? { ...w, pendingAction: undefined } : w));
    }, 600);
    return () => window.clearTimeout(t);
  }, [workspace]);

  const withProjectContext = (text: string) =>
    activeProject ? `Project context: ${activeProject.name}${activeProject.location ? ` (${activeProject.location})` : ""}. ${text}` : text;

  /** Entry-state input: open a fresh Felix workspace, seeding the first prompt. */
  const openWorkspace = (text: string, pendingAction?: string) => {
    if (!user) return;
    setPrompt("");
    writeLS(openFlagKey, "1");
    setWorkspace((w) => ({ key: (w?.key ?? 0) + 1, seedPrompt: text ? withProjectContext(text) : "", pendingAction, fresh: true }));
    window.setTimeout(() => void loadThreads(), 4000);
  };

  /** Reopen a past workspace curation for the current project. */
  const resumeWorkspace = (id: string) => {
    writeLS(wsThreadKey, id);
    writeLS(openFlagKey, "1");
    setWorkspace((w) => ({ key: (w?.key ?? 0) + 1, seedPrompt: "", fresh: false }));
  };

  /** Archive the active thread to Past Curations and return to the greeting. */
  const newCuration = () => {
    writeLS(openFlagKey, null);
    writeLS(wsThreadKey, null);
    setWorkspace(null);
    setPrompt("");
    void loadThreads();
  };

  /** In-thread input: continue the saved curation conversation. */
  const submit = async (text: string) => {
    const p = text.trim();
    if (!p || busy || !user) return;
    setPrompt("");
    if (threadId) { void send(p); return; }
    openWorkspace(p);
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (threadId) { busy ? stop() : void submit(prompt); return; }
    void submit(prompt);
  };

  const removeThread = async (id: string, kind: PastItem["kind"] = "curation") => {
    if (kind === "workspace") {
      const { error: e } = await supabase.from("concierge_threads").delete().eq("id", id);
      if (e) return;
      setWsThreads((t) => t.filter((x) => x.id !== id));
      if (id === activeWsThread) newCuration();
      return;
    }
    const { error: e } = await supabase.from("curation_threads").delete().eq("id", id);
    if (e) return;
    setThreads((t) => t.filter((x) => x.id !== id));
    if (id === threadId) navigate("/trade/concierge");
  };

  const firstName = profile?.first_name?.trim();
  const last = messages[messages.length - 1];
  const awaitingFirstToken = busy && (!last || last.role === "user" || !last.content);

  const TOOL_SHORTCUTS = [
    { label: "Upload Moodboard", icon: ImagePlus, run: () => openWorkspace("", "upload-moodboard") },
    { label: "Request Custom Quote", icon: FileText, run: () => openWorkspace("I'd like to request a custom quote for my project.") },
    { label: "Check Lead Times", icon: Clock, run: () => openWorkspace("What are the current lead times for your pieces?") },
  ];

  return (
    <div className="mx-auto w-full max-w-[1500px] px-6 py-6">
      <Helmet><title>Trade Concierge · Maison Affluency</title><meta name="robots" content="noindex" /></Helmet>
      <div className="grid gap-6 lg:gap-10 lg:grid-cols-[340px_minmax(0,1fr)]">
        {/* Left — persistent rail */}
        <aside className="space-y-5 lg:sticky lg:top-24 lg:h-[calc(100dvh-8rem)] lg:overflow-y-auto">
          <section className="relative overflow-hidden rounded-sm border border-border/60 bg-muted/40 p-6">
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-accent/0 via-accent/70 to-accent/0" />
            <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Trade Concierge · Powered by Felix</p>
            <h1 className="mt-3 font-display text-3xl italic leading-tight text-foreground">
              {greeting()}{firstName ? `, ${firstName}` : ""}.
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              {profile?.company ? `Curating for ${profile.company}` : "Your personal concierge"}
              {activeProject ? ` · ${activeProject.name}` : ""}.
              Ask for schemes, specifications or finish guidance.
            </p>
          </section>

          <section>
            <p className="mb-3 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Begin with</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_STARTS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={busy}
                  onClick={() => (threadId ? void submit(q) : openWorkspace(q))}
                  className="rounded-full border border-border bg-background px-3.5 py-1.5 text-left text-xs text-foreground transition-colors hover:border-accent hover:bg-accent/10 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          </section>

          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Past curations</p>
              <Button asChild variant="ghost" size="sm" className="h-7 gap-1 px-2 text-xs">
                <Link to="/trade/concierge" onClick={newCuration}><Plus className="h-3.5 w-3.5" /> New Curation</Link>
              </Button>
            </div>
            {!threadsLoaded ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-sm bg-foreground/[0.05]" />)}</div>
            ) : pastItems.length === 0 ? (
              <p className="font-display text-sm italic text-muted-foreground">Your curations will appear here.</p>
            ) : (
              <ul
                onScroll={(e) => {
                  const el = e.currentTarget;
                  setListAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
                }}
                className={cn("space-y-1 pr-1",
                  pastItems.length > 4 && "curation-scroll max-h-[224px] overflow-y-auto",
                  pastItems.length > 4 && !listAtBottom && "curation-scroll-fade")}>
                {pastItems.map((t) => (
                  <li key={t.id} className={cn("group flex items-center rounded-sm border-l-2 transition-colors",
                    (t.kind === "curation" ? t.id === threadId : !!workspace && t.id === activeWsThread)
                      ? "border-accent bg-muted/60" : "border-transparent hover:bg-muted/40")}>
                    <Link to={t.kind === "curation" ? `/trade/concierge/${t.id}` : "/trade/concierge"}
                      onClick={t.kind === "workspace" ? () => resumeWorkspace(t.id) : undefined}
                      className="min-w-0 flex-1 px-3 py-2">
                      <span className="block truncate text-sm text-foreground">{t.title}</span>
                      <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                        {new Date(t.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                      </span>
                    </Link>
                    <button type="button" aria-label={`Delete ${t.title}`} onClick={() => void removeThread(t.id, t.kind)}
                      className="mr-2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>

        {/* Right — unified workspace: entry hero → Felix workspace, or a saved curation thread */}
        <section className="relative flex h-[calc(100dvh-8rem)] min-h-[520px] flex-col overflow-hidden rounded-sm border border-border/60 bg-background">
          {workspace && !threadId ? (
            <Suspense fallback={
              <div className="flex h-full items-center justify-center">
                <DotCircleLoader size="sm" className="text-muted-foreground" />
              </div>
            }>
              <AIConcierge key={`${projectKey}:${workspace.key}`} embedded projectId={projectFilter || null}
                startFresh={workspace.fresh} initialPrompt={workspace.seedPrompt || undefined} />
            </Suspense>
          ) : (
            <>
              <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-8 md:px-10">
                {messages.length === 0 && phase !== "loading" && !busy ? (
                  <div className="flex h-full flex-col items-center justify-center text-center">
                    <p className="text-[10px] uppercase tracking-[0.28em] text-muted-foreground">Curatorial Guide</p>
                    <h2 className="mt-3 max-w-md font-display text-3xl italic text-foreground">What shall we curate today?</h2>
                    <div className="mt-5 h-px w-24 bg-gradient-to-r from-accent/0 via-accent to-accent/0" />
                  </div>
                ) : (
                  <div className="mx-auto max-w-3xl space-y-8">
                    {phase === "loading" && <FlashSkeleton />}
                    {messages.map((m) =>
                      m.role === "user" ? (
                        <div key={m.id} className="flex justify-end">
                          <p className="max-w-[80%] whitespace-pre-wrap rounded-sm bg-primary px-4 py-3 text-sm text-primary-foreground">{m.content}</p>
                        </div>
                      ) : m.content ? (
                        <article key={m.id} className="space-y-2">
                          <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {m.route === "FLASH" ? "Swift answer" : "Deep curation"}
                          </p>
                          <MessageResponse className="text-[15px] leading-relaxed text-foreground">{m.content}</MessageResponse>
                        </article>
                      ) : null,
                    )}
                    {awaitingFirstToken && (
                      phase === "streaming" && route === "FRONTIER" ? (
                        <div className="space-y-2">
                          {fallback && <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Prioritising accuracy</p>}
                          <FrontierSkeleton />
                        </div>
                      ) : <FlashSkeleton />
                    )}
                    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
                  </div>
                )}
              </div>

              <form onSubmit={onSubmit} className="sticky bottom-0 border-t border-border/60 bg-background/95 px-4 py-4 backdrop-blur md:px-8">
                <div className="mx-auto max-w-3xl space-y-2">
                  <div className="relative">
                    <Textarea
                      ref={inputRef}
                      value={prompt}
                      onChange={(e) => setPrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); busy ? undefined : void submit(prompt); } }}
                      placeholder="Ask your Personal Concierge…"
                      maxLength={4000}
                      rows={2}
                      className="resize-none rounded-sm pr-14"
                    />
                    <Button type="submit" size="icon" aria-label={busy && threadId ? "Stop" : "Send"} disabled={!busy && !prompt.trim()}
                      className="absolute bottom-2.5 right-2.5 h-9 w-9 rounded-full">
                      {busy && threadId ? <Square className="h-3.5 w-3.5" /> : <ArrowUp className="h-4 w-4" />}
                    </Button>
                  </div>
                  {!threadId && (
                    <div className="flex flex-wrap items-center gap-2">
                      {TOOL_SHORTCUTS.map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={t.run}
                          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-[11px] uppercase tracking-[0.12em] text-muted-foreground transition-colors hover:border-accent hover:text-foreground"
                        >
                          <t.icon className="h-3 w-3" />
                          {t.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
