import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowUp, ChevronDown, Clock, Download, FileText, ImagePlus, Loader2, Plus, Search, Square, Trash2, X } from "lucide-react";
import { renderCurationPdf } from "@/lib/curationExport";
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

interface ThreadRow { id: string; title: string; updated_at: string; project_id?: string | null }

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

/** One workspace session = one embedded Felix mount, keyed by this id. */
interface WorkspaceSession { key: number; seedPrompt: string; pendingAction?: string; fresh: boolean }
interface PastItem { id: string; title: string; updated_at: string; kind: "curation" | "workspace"; project_id?: string | null }
interface PreviewPick { title: string; finish?: string | null; qty?: number | null; designer?: string | null }
interface PreviewData { turns: { role: "user" | "assistant"; text: string }[]; picks: PreviewPick[] }

/** Distil a workspace timeline into the turns and saved picks a compact preview needs. */
function extractWorkspacePreview(timeline: unknown): PreviewData {
  const out: PreviewData = { turns: [], picks: [] };
  const seen = new Set<string>();
  for (const raw of Array.isArray(timeline) ? timeline : []) {
    if (!raw || typeof raw !== "object") continue;
    const item = raw as Record<string, any>;
    if (item.kind === "msg" && typeof item.content === "string" && item.content && out.turns.length < 8) {
      out.turns.push({ role: item.role === "assistant" ? "assistant" : "user", text: item.content.slice(0, 280) });
    }
    const prop = item.proposal as Record<string, any> | undefined;
    if (!prop || item.resolved === "discarded") continue;
    for (const p of Array.isArray(prop.preview) ? prop.preview : []) {
      const title = String(p?.title ?? "").slice(0, 90);
      if (!title) continue;
      const pick: PreviewPick = {
        title,
        finish: p.materials ? String(p.materials).slice(0, 60) : (p.variant ?? null),
        qty: typeof p?.qty === "number" ? p.qty : null,
        designer: p.designer_name ? String(p.designer_name).slice(0, 80) : null,
      };
      const key = `${pick.title}|${pick.finish ?? ""}`;
      if (!seen.has(key)) { seen.add(key); out.picks.push(pick); }
    }
  }
  return out;
}

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
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, PreviewData>>({});
  const [exportingId, setExportingId] = useState<string | null>(null);

  const exportCuration = async (t: PastItem) => {
    if (exportingId) return;
    setExportingId(t.id);
    try {
      const preview = previews[t.id] ?? { turns: [], picks: [] };
      await renderCurationPdf({
        title: t.title,
        updatedAt: t.updated_at,
        projectName: t.project_id ? projects.find((p) => p.id === t.project_id)?.name ?? null : null,
        picks: preview.picks,
        turns: preview.turns,
      });
    } finally {
      setExportingId(null);
    }
  };
  const buildingRef = useRef<Set<string>>(new Set());
  const [dateRange, setDateRange] = useState<"all" | "7" | "30" | "90">("all");
  const [designerSel, setDesignerSel] = useState("all");
  const [projectSel, setProjectSel] = useState("all");
  const [sortBy, setSortBy] = useState<"date-desc" | "date-asc" | "designer" | "project">("date-desc");

  // Bind the concierge contextually to the project chosen in the header switcher.
  const { projectFilter, setProjectFilter } = useProjectFilter();
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
    // Workspace threads are fetched across all projects; the Past Curations
    // project filter narrows them client-side.
    const [c, w] = await Promise.all([
      supabase.from("curation_threads").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(50),
      supabase.from("concierge_threads").select("id, title, updated_at:last_active_at, project_id")
        .eq("workspace", true).neq("title", "New conversation")
        .order("last_active_at", { ascending: false }).limit(50),
    ]);
    if (!c.error) setThreads(c.data ?? []);
    if (!w.error) setWsThreads((w.data ?? []) as ThreadRow[]);
    setThreadsLoaded(true);
  }, [user]);

  useEffect(() => { void loadThreads(); }, [loadThreads]);

  const pastItems: PastItem[] = [
    ...wsThreads.map((t) => ({ ...t, kind: "workspace" as const })),
    ...threads.map((t) => ({ ...t, kind: "curation" as const })),
  ].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

  // Lazily index each past curation (turns + saved picks) for the search field and preview.
  useEffect(() => {
    if (!user || !threadsLoaded) return;
    const missing = pastItems.filter((t) => !previews[t.id] && !buildingRef.current.has(t.id));
    if (!missing.length) return;
    missing.forEach((t) => buildingRef.current.add(t.id));
    const cIds = missing.filter((t) => t.kind === "curation").map((t) => t.id);
    const wIds = missing.filter((t) => t.kind === "workspace").map((t) => t.id);
    void (async () => {
      const built: Record<string, PreviewData> = {};
      if (cIds.length) {
        const { data } = await supabase.from("curation_messages").select("thread_id, role, content")
          .in("thread_id", cIds).order("created_at", { ascending: true });
        const turns: Record<string, PreviewData["turns"]> = {};
        for (const r of data ?? []) {
          if (!r.content) continue;
          (turns[r.thread_id] ??= []).push({
            role: r.role === "assistant" ? "assistant" : "user",
            text: String(r.content).slice(0, 280),
          });
        }
        for (const id of cIds) built[id] = { turns: (turns[id] ?? []).slice(0, 8), picks: [] };
      }
      if (wIds.length) {
        const { data } = await supabase.from("concierge_threads").select("id, timeline").in("id", wIds);
        for (const row of data ?? []) built[row.id] = extractWorkspacePreview((row as Record<string, unknown>).timeline);
      }
      setPreviews((p) => ({ ...p, ...built }));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, threadsLoaded, threads, wsThreads]);

  const query = search.trim().toLowerCase();
  const cutoff = dateRange === "all" ? 0 : Date.now() - Number(dateRange) * 86_400_000;
  const designerNames = Array.from(
    new Set(pastItems.flatMap((t) => (previews[t.id]?.picks ?? []).map((p) => p.designer).filter((d): d is string => !!d))),
  ).sort((a, b) => a.localeCompare(b));
  const filtersActive = dateRange !== "all" || designerSel !== "all" || projectSel !== "all";
  const clearFilters = () => { setDateRange("all"); setDesignerSel("all"); setProjectSel("all"); };
  const filteredItems = pastItems.filter((t) => {
    if (cutoff && new Date(t.updated_at).getTime() < cutoff) return false;
    if (projectSel === "none" ? !!t.project_id : projectSel !== "all" && t.project_id !== projectSel) return false;
    if (designerSel !== "all") {
      const p = previews[t.id];
      const hit = !!p && (p.picks.some((x) => x.designer === designerSel) ||
        p.turns.some((x) => x.text.toLowerCase().includes(designerSel.toLowerCase())));
      if (!hit) return false;
    }
    if (query) {
      const p = previews[t.id];
      const haystack = `${t.title} ${p ? [...p.picks.map((x) => x.title), ...p.picks.map((x) => x.designer ?? ""), ...p.turns.map((x) => x.text)].join(" ") : ""}`.toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  /** Alphabetical comparator that always sends unassigned entries last. */
  const compareKey = (a: string | null, b: string | null) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return a.localeCompare(b);
  };
  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "date-asc") return a.updated_at.localeCompare(b.updated_at);
    if (sortBy === "date-desc") return b.updated_at.localeCompare(a.updated_at);
    if (sortBy === "designer") {
      const da = previews[a.id]?.picks.find((p) => p.designer)?.designer ?? null;
      const db = previews[b.id]?.picks.find((p) => p.designer)?.designer ?? null;
      return compareKey(da, db);
    }
    const pa = a.project_id ? projects.find((p) => p.id === a.project_id)?.name ?? null : null;
    const pb = b.project_id ? projects.find((p) => p.id === b.project_id)?.name ?? null : null;
    return compareKey(pa, pb);
  });

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

  /** Reopen a past workspace curation, switching project context if needed. */
  const resumeWorkspace = (id: string, projectId?: string | null) => {
    const pk = projectId || "none";
    if (user) {
      writeLS(`concierge:workspaceThread:${user.id}:${pk}`, id);
      writeLS(`concierge:workspaceOpen:${user.id}:${pk}`, "1");
    }
    if ((projectId ?? null) !== (projectFilter ?? null)) setProjectFilter(projectId ?? null);
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
            {threadsLoaded && pastItems.length > 0 && (
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by name or product…"
                  className="h-8 w-full rounded-sm border border-border bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent focus:outline-none"
                />
                {search && (
                  <button type="button" aria-label="Clear search" onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground">
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )}
            {threadsLoaded && pastItems.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                <div className="relative">
                  <select value={dateRange} onChange={(e) => setDateRange(e.target.value as typeof dateRange)} aria-label="Filter by date"
                    className="h-8 w-full appearance-none rounded-sm border border-border bg-background pl-2.5 pr-6 text-xs text-foreground focus:border-accent focus:outline-none">
                    <option value="all">All dates</option>
                    <option value="7">Last 7 days</option>
                    <option value="30">Last 30 days</option>
                    <option value="90">Last 90 days</option>
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="relative">
                  <select value={designerSel} onChange={(e) => setDesignerSel(e.target.value)} aria-label="Filter by designer"
                    className="h-8 w-full appearance-none rounded-sm border border-border bg-background pl-2.5 pr-6 text-xs text-foreground focus:border-accent focus:outline-none">
                    <option value="all">All designers</option>
                    {designerNames.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                </div>
                <div className="relative">
                  <select value={projectSel} onChange={(e) => setProjectSel(e.target.value)} aria-label="Filter by project"
                    className="h-8 w-full appearance-none rounded-sm border border-border bg-background pl-2.5 pr-6 text-xs text-foreground focus:border-accent focus:outline-none">
                    <option value="all">All projects</option>
                    <option value="none">No project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
                </div>
              </div>
            )}
            {threadsLoaded && pastItems.length > 0 && (
              <div className="relative mb-3">
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort curations"
                  className="h-8 w-full appearance-none rounded-sm border border-border bg-background pl-2.5 pr-6 text-xs text-foreground focus:border-accent focus:outline-none">
                  <option value="date-desc">Sort: Newest first</option>
                  <option value="date-asc">Sort: Oldest first</option>
                  <option value="designer">Sort: Designer A–Z</option>
                  <option value="project">Sort: Project A–Z</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
              </div>
            )}
            {!threadsLoaded ? (
              <div className="space-y-2">{[0, 1, 2].map((i) => <div key={i} className="h-10 animate-pulse rounded-sm bg-foreground/[0.05]" />)}</div>
            ) : pastItems.length === 0 ? (
              <p className="font-display text-sm italic text-muted-foreground">Your curations will appear here.</p>
            ) : filteredItems.length === 0 ? (
              <div className="space-y-1.5">
                <p className="font-display text-sm italic text-muted-foreground">
                  {filtersActive ? "No curations match your filters." : `No curations match “${search.trim()}”.`}
                </p>
                {filtersActive && (
                  <button type="button" onClick={clearFilters}
                    className="text-[11px] uppercase tracking-[0.16em] text-accent transition-colors hover:text-foreground">
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <ul
                onScroll={(e) => {
                  if (e.target !== e.currentTarget) return; // ignore scrolls inside an expanded preview
                  const el = e.currentTarget;
                  setListAtBottom(el.scrollHeight - el.scrollTop - el.clientHeight < 8);
                }}
                className={cn("space-y-1 pr-1",
                  sortedItems.length > 4 && "curation-scroll max-h-[224px] overflow-y-auto",
                  sortedItems.length > 4 && !listAtBottom && "curation-scroll-fade")}>
                {sortedItems.map((t) => {
                  const preview = previews[t.id];
                  const expanded = expandedId === t.id;
                  return (
                    <li key={t.id} className={cn("group rounded-sm border-l-2 transition-colors",
                      (t.kind === "curation" ? t.id === threadId : !!workspace && t.id === activeWsThread)
                        ? "border-accent bg-muted/60" : "border-transparent hover:bg-muted/40")}>
                      <div className="flex items-center">
                        <Link to={t.kind === "curation" ? `/trade/concierge/${t.id}` : "/trade/concierge"}
                          onClick={t.kind === "workspace" ? () => resumeWorkspace(t.id, t.project_id) : undefined}
                          className="min-w-0 flex-1 px-3 py-2">
                          <span className="block truncate text-sm text-foreground">{t.title}</span>
                          <span className="block text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {new Date(t.updated_at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                          </span>
                        </Link>
                        <button type="button" aria-label={`${expanded ? "Hide" : "Preview"} ${t.title}`} aria-expanded={expanded}
                          onClick={() => setExpandedId(expanded ? null : t.id)}
                          className="rounded p-1.5 text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 focus:opacity-100 hover:text-foreground">
                          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", expanded && "rotate-180")} />
                        </button>
                        <button type="button" aria-label={`Export ${t.title} as PDF`} disabled={exportingId === t.id}
                          onClick={() => void exportCuration(t)}
                          className="rounded p-1.5 text-muted-foreground opacity-0 transition-colors group-hover:opacity-100 focus:opacity-100 hover:text-foreground disabled:opacity-60">
                          {exportingId === t.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" aria-label={`Delete ${t.title}`} onClick={() => void removeThread(t.id, t.kind)}
                          className="mr-2 rounded p-1.5 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus:opacity-100 group-hover:opacity-100">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      {expanded && (
                        <div className="curation-scroll max-h-[260px] overflow-y-auto border-t border-border/40 px-3 py-2.5">
                          {!preview ? (
                            <div className="h-14 animate-pulse rounded-sm bg-foreground/[0.05]" />
                          ) : (
                            <div className="space-y-2.5">
                              <div>
                                <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Saved products</p>
                                {preview.picks.length === 0 ? (
                                  <p className="font-display text-xs italic text-muted-foreground">No saved products.</p>
                                ) : (
                                  <ul className="space-y-0.5">
                                    {preview.picks.slice(0, 8).map((p, i) => (
                                      <li key={i} className="truncate text-xs text-foreground">
                                        {p.title}
                                        {p.finish ? <span className="text-muted-foreground"> · {p.finish}</span> : null}
                                        {p.qty && p.qty > 1 ? <span className="text-muted-foreground"> ×{p.qty}</span> : null}
                                      </li>
                                    ))}
                                    {preview.picks.length > 8 && (
                                      <li className="text-[10px] text-muted-foreground">+{preview.picks.length - 8} more</li>
                                    )}
                                  </ul>
                                )}
                              </div>
                              {preview.turns.length > 0 && (
                                <div>
                                  <p className="mb-1 text-[9px] uppercase tracking-[0.2em] text-muted-foreground">Conversation</p>
                                  <ul className="space-y-1.5">
                                    {preview.turns.map((turn, i) => (
                                      <li key={i} className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                                        <span className={cn("mr-1.5 text-[9px] uppercase tracking-[0.14em]",
                                          turn.role === "user" ? "text-foreground" : "text-accent")}>
                                          {turn.role === "user" ? "You" : "Felix"}
                                        </span>
                                        {turn.text}
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
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
