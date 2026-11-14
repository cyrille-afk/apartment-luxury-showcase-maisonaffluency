import { Link, useSearchParams } from "@/lib/router-compat";
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Image, Users, FolderOpen, Layers, FileText, FileSpreadsheet, Scissors,
  Columns, Paintbrush, MessageCircle, CalendarClock, Package, Truck,
  CalendarDays, Wallet, RefreshCw, ArrowRightLeft, GraduationCap, Box, BookOpen,
  Wand2, Star, Search, X, Scan, Presentation, ClipboardList, CalendarRange, CheckCircle2, Circle, Save, LayoutTemplate,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { categorySlug } from "@/lib/toolsBreadcrumbs";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, getRecentProjectIds } from "@/hooks/useProjects";
import { useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";
import { studioProjectId, studioProjectHref } from "@/lib/studioProjectRouting";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { projectWorkflow, specificationStages, stageTargetStatus, type SpecificationStage, type StageCompletion, type StageTarget } from "@/lib/specificationWorkflow";

type Tool = { title: string; description: string; url: string; icon: any };
type ToolCategory = { label: string; tools: Tool[] };

const categories: ToolCategory[] = [
  {
    label: "Discover",
    tools: [
      { title: "Gallery", description: "Source the complete catalog, filter by categories, and view live trade pricing.", url: "/trade/gallery", icon: Image },
      { title: "Designers & Ateliers", description: "Explore our represented makers", url: "/trade/designers", icon: Users },
      { title: "Resources", description: "Catalogues, price lists & tech sheets", url: "/trade/documents", icon: FolderOpen },
      { title: "Material Library", description: "Swatches, finishes & fabric samples", url: "/trade/materials", icon: Layers },
    ],
  },
  {
    label: "Specification",
    tools: [
      { title: "Mood Board", description: "Visual collage for client presentations", url: "/trade/mood-boards", icon: Paintbrush },
      { title: "Project Studio", description: "Curate visual boards, lock material finishes, review live specsheet pricing, and refine AI pairings.", url: "/trade/project-studio", icon: LayoutTemplate },
      { title: "Product Comparator", description: "Compare specs side by side", url: "/trade/comparator", icon: Columns },
      { title: "Markup & Annotation", description: "Annotate images and drawings", url: "/trade/annotations", icon: MessageCircle },
      { title: "Visualiser & Walkthrough", description: "Arrange your Mood Board furniture in 3D, then preview and record a cinematic walkthrough.", url: "/trade/visualiser", icon: Scan },
      { title: "Tearsheet Builder", description: "Create printable product specs", url: "/trade/tearsheets", icon: Scissors },
      { title: "Specification Sheet Generator", description: "Branded client presentation decks & pitch PDFs", url: "/trade/spec-generator", icon: Presentation },
      { title: "FF&E Schedule", description: "Auto-generate furniture schedules", url: "/trade/ffe-schedule", icon: FileSpreadsheet },
      { title: "Quote Builder", description: "Build and submit project quotes", url: "/trade/quotes", icon: FileText },
    ],
  },
  {
    label: "Procurement",
    tools: [
      { title: "Order Timeline", description: "Track orders from deposit to delivery", url: "/trade/order-timeline", icon: CalendarClock },
      { title: "Delivery Tracker", description: "Order stage vs deadline, by project", url: "/trade/delivery-tracker", icon: CalendarClock },
      { title: "Sample Requests", description: "Request and track material samples", url: "/trade/samples", icon: Package },
      { title: "Shipping Tracker", description: "Real-time delivery progress", url: "/trade/shipping-tracker", icon: Truck },
      { title: "Lead Time Calendar", description: "Production and shipping timelines", url: "/trade/lead-time-calendar", icon: CalendarDays },
      { title: "Budget Tracker & Cash-Flow Planner", description: "Margins, tier markups, deposits and invoice cash flow", url: "/trade/budget", icon: Wallet },
      { title: "Gantt Chart & Project Timeline", description: "Delivery windows and cash milestones on one timeline", url: "/trade/gantt", icon: CalendarRange },
      { title: "Purchase Order Logs", description: "Invoice matching and vendor payment states", url: "/trade/po-logs", icon: ClipboardList },
      { title: "Reorder", description: "Quickly re-order from past quotes", url: "/trade/reorder", icon: RefreshCw },
      { title: "Currency Converter", description: "Convert trade prices across currencies", url: "/trade/currency-converter", icon: ArrowRightLeft },
    ],
  },
  {
    label: "Learn",
    tools: [
      { title: "Custom Requests", description: "Bespoke dimensions, finishes & COM/COL fabric", url: "/trade/custom-requests", icon: Wand2 },
      { title: "Gallery & Fair Calendar", description: "Salone, Maison&Objet, PAD, Design Miami — with .ics export", url: "/trade/calendar", icon: CalendarDays },
      { title: "Guides", description: "Studio playbooks for using the Trade Portal", url: "/trade/guides", icon: BookOpen },
      { title: "CPD & Education", description: "Webinars, workshops & CPD tracking", url: "/trade/cpd", icon: GraduationCap },
      { title: "3D Studio", description: "3ds Max + Corona/V-Ray rendering pipeline", url: "/trade/axonometric-requests", icon: Box },
    ],
  },
];

const FAV_KEY = "trade_tools_favorites_v1";

function CompletionDate({ value }: { value: string | undefined }) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return <time dateTime={value} title={date.toLocaleString('en-GB')} className="block text-xs text-muted-foreground">{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time>;
}

function TargetDateEditor({ title, value, disabled, pending, onSave }: { title: string; value: string; disabled: boolean; pending: boolean; onSave: (date: string) => void }) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  return <div className="space-y-1.5">
    <div className="flex items-center justify-between gap-1 min-w-0">
      <label htmlFor={`target-${title}`} className="text-xs text-muted-foreground">Target date</label>
      <div className="flex items-center">
      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Save target date" aria-label={`Save ${title} target date`} disabled={disabled || pending || draft === value || !draft} onClick={() => onSave(draft)}><Save className="h-3.5 w-3.5" /></Button>
      {value && <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" title="Clear target date" aria-label={`Clear ${title} target date`} disabled={disabled || pending} onClick={() => onSave('')}><X className="h-3.5 w-3.5" /></Button>}
      </div>
    </div>
    <input id={`target-${title}`} type="date" aria-label={`${title} target date`} value={draft} disabled={disabled || pending} onChange={event => setDraft(event.target.value)} className="min-w-0 w-full h-8 rounded-md border border-border bg-background px-2 text-xs text-foreground disabled:opacity-50" />
    {pending && <p role="status" className="text-xs text-muted-foreground">Saving target date…</p>}
  </div>;
}

function TargetDateStatus({ value, complete = false }: { value: string | undefined; complete?: boolean }) {
  const status = stageTargetStatus(value, complete);
  if (!status || !value) return null;
  const date = new Date(`${value}T12:00:00`);
  return <p className={cn('text-xs', status === 'Overdue' ? 'text-destructive' : 'text-muted-foreground')}><span>{status}</span> · <time dateTime={value}>{date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time></p>;
}

export default function TradeTools() {
  const [searchParams] = useSearchParams();
  const categoryParam = searchParams.get("category");
  const [favorites, setFavorites] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const [projectId, setProjectId] = useState("");
  const workspace = useProjectWorkspace();
  const [recentProjectIds, setRecentProjectIds] = useState<string[]>([]);
  const [chosenWorkflowProject, setChosenWorkflowProject] = useState(false);
  useEffect(() => { setRecentProjectIds(getRecentProjectIds()); }, []);
  const contextProject = searchParams.get('project') || workspace?.activeFolder?.projectId;
  const studioDestination = studioProjectId(projects.map(project => project.id), chosenWorkflowProject ? projectId : contextProject, recentProjectIds);
  const toolHref = (url: string) => url === '/trade/project-studio' ? studioProjectHref(studioDestination) : url;
  const queryClient = useQueryClient();
  const progressKey = ["specification-progress", user?.id];
  const progressQuery = useQuery({
    queryKey: progressKey,
    enabled: Boolean(user),
    queryFn: async () => {
      const rows: StageCompletion[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from("project_specification_progress")
          .select("project_id,stage,completed_at").order("project_id").order("stage").range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      return rows;
    },
    refetchInterval: 30000,
  });
  const activeProjectId = projects.some(project => project.id === projectId) ? projectId : "";
  const targetKey = ['specification-targets', user?.id];
  const targetsQuery = useQuery({
    queryKey: targetKey, enabled: Boolean(user), refetchInterval: 30000,
    queryFn: async () => {
      const rows: StageTarget[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await supabase.from('project_specification_targets').select('project_id,stage,target_date').order('project_id').order('stage').range(offset, offset + 499);
        if (error) throw error;
        rows.push(...(data || []));
        if (!data || data.length < 500) break;
      }
      return rows;
    },
  });
  const targetMutation = useMutation({
    mutationFn: async ({ project, stage, date }: { project: string; stage: SpecificationStage; date: string }) => {
      if (!user) throw new Error('Sign in required');
      const result = date
        ? await supabase.from('project_specification_targets').upsert({ project_id: project, stage, target_date: date }, { onConflict: 'project_id,stage' })
        : await supabase.from('project_specification_targets').delete().eq('project_id', project).eq('stage', stage);
      if (result.error) throw result.error;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: targetKey }); },
  });
  const editQuery = useQuery({
    queryKey: ["specification-project-edit", user?.id, activeProjectId],
    enabled: Boolean(user && activeProjectId),
    queryFn: async () => {
      if (!user || !activeProjectId) return false;
      const { data, error } = await supabase.rpc("can_edit_project", { _user_id: user.id, _project_id: activeProjectId });
      if (error) throw error;
      return data === true;
    },
  });
  const completion = useMutation({
    mutationFn: async ({ project, stage, complete }: { project: string; stage: SpecificationStage; complete: boolean }) => {
      if (!user) throw new Error("Sign in required");
      const result = complete
        ? await supabase.from("project_specification_progress").upsert({ project_id: project, stage, completed_by: user.id }, { onConflict: "project_id,stage", ignoreDuplicates: true })
        : await supabase.from("project_specification_progress").delete().eq("project_id", project).eq("stage", stage);
      if (result.error) throw result.error;
    },
    onSuccess: async () => { await queryClient.invalidateQueries({ queryKey: progressKey }); },
  });
  const workflow = projectWorkflow(activeProjectId, progressQuery.data || [], targetsQuery.data || []);
  const progressReady = Boolean(activeProjectId && progressQuery.isSuccess);

  useEffect(() => {
    if (projectsLoading) return;
    setProjectId(current => chosenWorkflowProject && projects.some(project => project.id === current) ? current : studioDestination || projects[0]?.id || "");
  }, [projects, projectsLoading, studioDestination, chosenWorkflowProject]);

  // Cmd+K / Ctrl+K → focus search. Esc clears it.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
        searchRef.current?.select();
      } else if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Load favorites once on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAV_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setFavorites(parsed.filter((x) => typeof x === "string"));
      }
    } catch {}
  }, []);

  // Deep link from a breadcrumb: scroll the requested category into view.
  useEffect(() => {
    if (!categoryParam) return;
    const el = document.getElementById(`tools-${categoryParam}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [categoryParam]);

  const persist = useCallback((next: string[]) => {
    setFavorites(next);
    try { localStorage.setItem(FAV_KEY, JSON.stringify(next)); } catch {}
  }, []);

  const toggleFavorite = useCallback((url: string) => {
    persist(
      favorites.includes(url)
        ? favorites.filter((u) => u !== url)
        : [...favorites, url],
    );
  }, [favorites, persist]);

  const allTools = useMemo(() => categories.flatMap((c) => c.tools), []);
  const favoriteTools = useMemo(
    () => favorites.map((url) => allTools.find((t) => t.url === url)).filter(Boolean) as Tool[],
    [favorites, allTools],
  );

  const trimmedQuery = query.trim().toLowerCase();
  const isSearching = trimmedQuery.length > 0;
  const filteredCategories = useMemo(() => {
    if (!isSearching) return categories;
    return categories
      .map((cat) => ({
        ...cat,
        tools: cat.tools.filter(
          (t) =>
            t.title.toLowerCase().includes(trimmedQuery) ||
            t.description.toLowerCase().includes(trimmedQuery),
        ),
      }))
      .filter((cat) => cat.tools.length > 0);
  }, [trimmedQuery, isSearching]);
  const totalMatches = filteredCategories.reduce((n, c) => n + c.tools.length, 0);

  return (
    <div data-tools-page className="max-w-6xl mx-auto space-y-10 [&_a]:cursor-pointer [&_button:not(:disabled)]:cursor-pointer [&_[role=checkbox]:not([data-disabled])]:cursor-pointer">
      <div>
        <h1 className="font-display text-2xl md:text-3xl text-foreground tracking-wide">Tools</h1>
        <p className="font-body text-sm text-muted-foreground mt-1">
          Everything you need to discover, specify and procure — all in one place.
        </p>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          ref={searchRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tools by name or description…"
          aria-label="Search tools"
          aria-keyshortcuts="Control+K Meta+K"
          className="w-full h-11 pl-10 pr-20 rounded-xl border border-border bg-background font-body text-sm text-foreground placeholder:text-muted-foreground/70 focus:outline-hidden focus:border-foreground/40 focus:ring-2 focus:ring-foreground/5 transition-colors"
        />
        {query ? (
          <Button variant="ghost" size="icon"
            onClick={() => setQuery("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted"
            aria-label="Clear search"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        ) : (
          <kbd className="hidden sm:inline-flex absolute right-3 top-1/2 -translate-y-1/2 items-center gap-1 rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-body text-[10px] uppercase tracking-wider text-muted-foreground pointer-events-none">
            <span className="text-[11px]">⌘</span>K
          </kbd>
        )}
      </div>
      {isSearching && (
        <p className="font-body text-xs text-muted-foreground -mt-6">
          {totalMatches === 0
            ? `No tools match "${query.trim()}"`
            : `${totalMatches} tool${totalMatches === 1 ? "" : "s"} matching "${query.trim()}"`}
        </p>
      )}

      {/* Favorites — only shown after the user stars at least one tool, hidden while searching */}
      {!isSearching && favoriteTools.length > 0 && (
        <section className="rounded-2xl border border-border bg-muted/30 p-5 md:p-6">
          <div className="flex items-baseline justify-between gap-4 mb-4">
            <h2 className="font-display text-sm uppercase tracking-[0.15em] text-foreground flex items-center gap-2">
              <Star className="h-3.5 w-3.5 fill-accent text-accent" />
              Your favorites
            </h2>
            <span className="font-body text-[11px] uppercase tracking-widest text-muted-foreground hidden sm:block">
              {favoriteTools.length} pinned
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {favoriteTools.map((tool) => (
              <div
                key={tool.url}
                className="group relative flex items-center gap-2.5 p-3 rounded-lg border border-border bg-background hover:bg-foreground/5 hover:border-foreground/20 transition-all"
              >
                <Link
                  to={toolHref(tool.url)}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                >
                  <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                    <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div className="min-w-0">
                    <span className="font-body text-xs font-medium text-foreground block truncate">{tool.title}</span>
                    <span className="font-body text-[10px] text-muted-foreground leading-snug block truncate">
                      {tool.description}
                    </span>
                  </div>
                </Link>
                <Button variant="ghost" size="icon"
                  onClick={(e) => { e.stopPropagation(); toggleFavorite(tool.url); }}
                  className="shrink-0 p-1 rounded hover:bg-muted text-accent"
                  aria-label={`Remove ${tool.title} from favorites`}
                  title="Remove from favorites"
                >
                  <Star className="h-3.5 w-3.5 fill-accent" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {filteredCategories.map((cat, catIndex) => (
        <section
          key={cat.label}
          id={`tools-${categorySlug(cat.label)}`}
          className="scroll-mt-24"
          data-felix-target={cat.label === "Discover" ? "tools-grid" : undefined}
          data-tour-target={
            cat.label === "Specification" ? "tools"
              : cat.label === "Procurement" ? "procurement"
              : undefined
          }
        >
          <h2 className="font-display text-sm uppercase tracking-[0.15em] text-muted-foreground mb-4">
            {cat.label}
          </h2>
          {cat.label === "Specification" && (
            <section aria-label="Specification project overview" className="mb-6 border-t border-border">
              <Accordion type="single" collapsible>
                <AccordionItem value="project-overview" className="border-0">
                  <AccordionTrigger aria-label="Project overview" className="cursor-pointer gap-3 font-body text-sm text-foreground hover:no-underline [&>svg]:h-4 [&>svg]:w-4 motion-reduce:transition-none [&>svg]:motion-reduce:transition-none">
                    <span className="flex flex-1 flex-wrap items-center justify-between gap-2 text-left">
                      <span>Project overview</span>
                      <span className="text-xs font-normal text-muted-foreground">{projectsLoading ? 'Loading…' : `${projects.filter(project => project.status === 'active').length} active projects`}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-0">
              {projectsLoading || progressQuery.isPending ? <p className="text-sm text-muted-foreground pb-4">Loading project overview…</p>
                : progressQuery.isError ? <div role="alert" className="flex items-center gap-2 pb-4 text-sm text-destructive">Project overview unavailable.<Button variant="ghost" size="sm" onClick={() => void progressQuery.refetch()}>Try again</Button></div>
                : !projects.length ? <p className="text-sm text-muted-foreground pb-4">No projects available</p>
                : projects.map(project => {
                  const summary = projectWorkflow(project.id, progressQuery.data || [], targetsQuery.data || []);
                  return (
                    <article key={project.id} aria-label={`${project.name} Specification overview`} className="border-b border-border py-4 grid grid-cols-1 lg:grid-cols-[220px_1fr_1fr] gap-4 lg:gap-6">
                      <div className="min-w-0 space-y-2">
                        <Button variant="link" className="p-0 h-auto text-left whitespace-normal justify-start text-foreground" disabled={completion.isPending || targetMutation.isPending}
                          aria-label={`View ${project.name} Specification stages`}
                          onClick={() => { setChosenWorkflowProject(true); setProjectId(project.id); completion.reset(); targetMutation.reset(); document.getElementById('specification-project-progress')?.scrollIntoView({ behavior: 'instant', block: 'start' }); }}>
                          {project.name}
                        </Button>
                        <p className="text-xs text-muted-foreground">{summary.count}/{specificationStages.length} complete · {summary.percent}%</p>
                        {targetsQuery.isSuccess && summary.overdueCount > 0 && <p className="text-xs text-destructive">{summary.overdueCount} overdue</p>}
                        <Progress value={summary.percent} className="h-1 bg-muted" aria-label={`${project.name} Specification completion`} />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-medium text-foreground mb-2">Completed · {summary.completedStages.length}</h4>
                        {summary.completedStages.length === 0 ? <p className="text-xs text-muted-foreground">None yet</p> : <ul className="space-y-1.5">
                          {summary.completedStages.map(stage => <li key={stage.id} className="flex items-start gap-2 text-xs text-foreground"><CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" /><div className="min-w-0"><span>{categories.find(category => category.label === 'Specification')?.tools.find(tool => tool.url === stage.url)?.title}</span><CompletionDate value={stage.completedAt} /></div></li>)}
                        </ul>}
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-medium text-foreground mb-2">Remaining · {summary.remainingStages.length}</h4>
                        {summary.remainingStages.length === 0 ? <p className="text-xs text-primary">All stages complete</p> : <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
                          {summary.remainingStages.map(stage => <li key={stage.id} className="flex items-start gap-2 text-xs text-muted-foreground"><Circle className={cn('h-3.5 w-3.5 shrink-0', stage.targetStatus === 'Overdue' && 'text-destructive')} aria-hidden="true" /><div className="min-w-0"><span>{categories.find(category => category.label === 'Specification')?.tools.find(tool => tool.url === stage.url)?.title}</span><TargetDateStatus value={stage.targetDate} /></div></li>)}
                        </ul>}
                      </div>
                    </article>
                  );
                })}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </section>
          )}
          {cat.label === "Specification" && (
            <div id="specification-project-progress" className="mb-5 border-y border-border py-4 space-y-3 scroll-mt-24">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="font-body text-sm font-medium text-foreground">Project progress</h3>
                  <p className="font-body text-xs text-muted-foreground" aria-live="polite">
                    {projectsLoading ? "Loading projects…" : !projects.length ? "No projects available" : !activeProjectId ? "Select a project" : progressQuery.isError ? "Progress unavailable" : !progressReady ? "Loading progress…" : `${workflow.count} of ${specificationStages.length} stages complete · ${workflow.percent}%`}
                  </p>
                </div>
                <Select value={activeProjectId} onValueChange={value => { setChosenWorkflowProject(true); setProjectId(value); completion.reset(); targetMutation.reset(); }} disabled={projectsLoading || !projects.length || completion.isPending || targetMutation.isPending}>
                  <SelectTrigger className="w-full sm:w-80" aria-label="Workflow project"><SelectValue placeholder="Select a project" /></SelectTrigger>
                  <SelectContent>
                    {projects.map(project => <SelectItem key={project.id} value={project.id}>{project.name}{progressQuery.isSuccess ? ` · ${projectWorkflow(project.id, progressQuery.data).count}/${specificationStages.length}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {progressReady && <Progress value={workflow.percent} className="h-1.5 bg-muted" aria-label="Specification workflow completion" />}
              {(progressQuery.isError || editQuery.isError) && <div className="flex items-center gap-2 text-sm text-destructive" role="alert">Unable to load project progress.<Button variant="ghost" size="sm" onClick={() => { void progressQuery.refetch(); void editQuery.refetch(); }}>Try again</Button></div>}
              {completion.isError && <p role="alert" className="text-sm text-destructive">Could not save this stage. Please try again.</p>}
              {targetsQuery.isError && <div role="alert" className="flex items-center gap-2 text-sm text-destructive">Target dates unavailable.<Button variant="ghost" size="sm" onClick={() => void targetsQuery.refetch()}>Try again</Button></div>}
              {targetMutation.isError && <p role="alert" className="text-sm text-destructive">Could not save the target date. Please try again.</p>}
              {progressReady && editQuery.isSuccess && !editQuery.data && <p className="text-xs text-muted-foreground">View-only project</p>}
            </div>
          )}
          <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3", cat.label === "Specification" && "auto-rows-fr")}>
            {cat.tools.map((tool) => {
              const isFav = favorites.includes(tool.url);
              const stage = cat.label === "Specification" ? specificationStages.find(stage => stage.url === tool.url) : undefined;
              const isComplete = Boolean(stage && workflow.completed.has(stage.id));
              return (
                <div
                  key={tool.url}
                  data-felix-target={tool.url === "/trade/documents" ? "tools-resources" : undefined}
                  className="group relative flex flex-wrap items-start gap-3 p-4 rounded-xl border border-border bg-background hover:bg-muted/50 hover:border-foreground/20 transition-all"
                >
                  <Link
                    to={toolHref(tool.url)}
                    className="flex items-start gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0 group-hover:bg-foreground/10 transition-colors">
                      <tool.icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div className="min-w-0 pr-6">
                      <span className="font-body text-sm font-medium text-foreground block">{tool.title}</span>
                      <span className={cn("font-body text-xs text-muted-foreground leading-snug mt-0.5", stage ? "line-clamp-2 h-8" : "block")}>
                        {tool.description}
                      </span>
                    </div>
                  </Link>
                  <Button variant="ghost" size="icon"
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(tool.url); }}
                    className={cn(
                      "absolute top-2.5 right-2.5 p-1.5 rounded-md transition-colors",
                      isFav
                        ? "text-accent hover:bg-muted"
                        : "text-muted-foreground/40 hover:text-accent hover:bg-muted opacity-0 group-hover:opacity-100 focus:opacity-100",
                    )}
                    aria-label={isFav ? `Remove ${tool.title} from favorites` : `Add ${tool.title} to favorites`}
                    title={isFav ? "Remove from favorites" : "Add to favorites"}
                  >
                    <Star className={cn("h-3.5 w-3.5", isFav && "fill-accent")} />
                  </Button>
                  {stage && (
                    <div className="w-full space-y-3 border-t border-border pt-3 mt-auto">
                    <div className="flex items-center gap-2">
                      <Checkbox id={`workflow-${stage.id}`} aria-label={`Mark ${tool.title} complete`} checked={progressReady && isComplete}
                        disabled={!progressReady || editQuery.data !== true || completion.isPending}
                        onCheckedChange={checked => completion.mutate({ project: activeProjectId, stage: stage.id, complete: checked === true })} />
                      <div className="min-w-0"><label htmlFor={`workflow-${stage.id}`} className="text-xs text-muted-foreground cursor-pointer">
                        {completion.isPending && completion.variables?.stage === stage.id ? "Saving…" : !progressReady ? "—" : isComplete ? "Complete" : "Not complete"}
                      </label>
                      {progressReady && isComplete && <CompletionDate value={workflow.completionDates.get(stage.id)} />}</div>
                    </div>
                    <TargetDateEditor key={`${activeProjectId}-${stage.id}`} title={tool.title} value={workflow.targetDates.get(stage.id) || ''} disabled={!progressReady || !targetsQuery.isSuccess || editQuery.data !== true || completion.isPending || targetMutation.isPending} pending={targetMutation.isPending && targetMutation.variables?.stage === stage.id} onSave={date => targetMutation.mutate({ project: activeProjectId, stage: stage.id, date })} />
                    {progressReady && targetsQuery.isSuccess && <TargetDateStatus value={workflow.targetDates.get(stage.id)} complete={isComplete} />}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
