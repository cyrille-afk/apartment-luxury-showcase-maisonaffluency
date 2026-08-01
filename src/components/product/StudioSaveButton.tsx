import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderPlus, Check, Loader2, Library } from "lucide-react";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { getRecentProjectIds, pushRecentProject } from "@/hooks/useProjects";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type ProjectRow = { id: string; name: string; client_name: string | null; updated_at: string };

const GENERAL_LIBRARY_TITLE = "General Studio Library";

function haptic(pattern: number | number[] = 12) {
  try {
    (navigator as Navigator & { vibrate?: (p: number | number[]) => boolean }).vibrate?.(pattern);
  } catch {
    /* unsupported — silent */
  }
}

/**
 * "Save to Studio Dashboard" drop.
 *
 * A single tap on the folder anchor overlaying the product image opens a low
 * bottom sheet with the three most recently touched projects plus the general
 * studio library. One more tap slots the piece into that project's board,
 * fires a haptic tick, shows a checkmark, and self-dismisses after 1.5s.
 */
export default function StudioSaveButton({
  pickId,
  productTitle,
  finishes,
  className,
}: {
  /** designer_curator_picks.id (or trade_products.id) for the product on screen */
  pickId: string;
  productTitle: string;
  /** Currently chosen finish labels, stored alongside the saved item */
  finishes?: string[];
  className?: string;
}) {
  const { user } = useAuth();
  const { currentStudio } = useStudio();
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedLabel, setSavedLabel] = useState<string | null>(null);
  const dismissTimer = useRef<number | null>(null);

  useEffect(() => () => { if (dismissTimer.current) window.clearTimeout(dismissTimer.current); }, []);

  // Load the studio's projects lazily, only once the sheet is summoned.
  useEffect(() => {
    if (!open || !user) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      let q = supabase
        .from("projects" as any)
        .select("id, name, client_name, updated_at")
        .eq("status", "active")
        .order("updated_at", { ascending: false })
        .limit(20);
      if (currentStudio) q = q.eq("studio_id", currentStudio.id);
      else q = q.eq("user_id", user.id).is("studio_id", null);
      const { data } = await q;
      if (cancelled) return;
      setProjects(((data as unknown as ProjectRow[]) || []));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [open, user, currentStudio?.id]);

  // Top 3: locally-recent projects first, then most recently updated.
  const topThree = useMemo(() => {
    const recent = getRecentProjectIds();
    const byId = new Map(projects.map((p) => [p.id, p]));
    const ordered: ProjectRow[] = [];
    for (const id of recent) {
      const p = byId.get(id);
      if (p) { ordered.push(p); byId.delete(id); }
    }
    for (const p of projects) if (byId.has(p.id)) ordered.push(p);
    return ordered.slice(0, 3);
  }, [projects]);

  const resolveTradeProductId = useCallback(async () => {
    const { data: direct } = await supabase
      .from("trade_products").select("id").eq("id", pickId).maybeSingle();
    if ((direct as any)?.id) return (direct as any).id as string;
    const { data: mirrored } = await supabase
      .from("trade_products").select("id").eq("source_pick_id", pickId).maybeSingle();
    return ((mirrored as any)?.id as string) ?? null;
  }, [pickId]);

  /** Find (or create) the destination board for a project / the general library. */
  const resolveBoardId = useCallback(async (project: ProjectRow | null) => {
    if (!user) return null;
    let q = supabase.from("client_boards").select("id").limit(1);
    if (project) q = q.eq("project_id", project.id);
    else q = q.is("project_id", null).eq("title", GENERAL_LIBRARY_TITLE);
    if (currentStudio) q = q.eq("studio_id", currentStudio.id);
    else q = q.eq("user_id", user.id);
    const { data: existing } = await q.maybeSingle();
    if ((existing as any)?.id) return (existing as any).id as string;

    const { data: created, error } = await supabase
      .from("client_boards")
      .insert({
        user_id: user.id,
        studio_id: currentStudio?.id ?? null,
        project_id: project?.id ?? null,
        title: project ? project.name : GENERAL_LIBRARY_TITLE,
        client_name: project?.client_name || (project ? project.name : "Studio"),
      } as any)
      .select("id")
      .maybeSingle();
    if (error) throw error;
    return ((created as any)?.id as string) ?? null;
  }, [user, currentStudio?.id]);

  const save = async (project: ProjectRow | null) => {
    const key = project?.id ?? "__library__";
    if (savingId) return;
    setSavingId(key);
    try {
      const tradeProductId = await resolveTradeProductId();
      if (!tradeProductId) {
        toast.error("Not on the trade catalogue yet", {
          description: "This piece hasn't been mirrored into the trade catalogue, so it can't be saved.",
        });
        return;
      }
      const boardId = await resolveBoardId(project);
      if (!boardId) { toast.error("Couldn't open that project's board"); return; }

      const { count } = await supabase
        .from("client_board_items")
        .select("id", { count: "exact", head: true })
        .eq("board_id", boardId);

      const chosen = (finishes || []).filter(Boolean);

      const { error } = await supabase.from("client_board_items").insert({
        board_id: boardId,
        product_id: tradeProductId,
        sort_order: count ?? 0,
        notes: chosen.length ? `Finishes: ${chosen.join(", ")}` : null,
        variant_label: chosen[0] || null,
        // Flags the item for the desktop bridge: gold dot + morning digest.
        saved_via: "mobile",
        added_by: user.id,
      } as any);
      if (error) { toast.error("Couldn't save", { description: error.message }); return; }

      if (project) pushRecentProject(project.id);
      window.dispatchEvent(new Event("concierge:artifacts-changed"));
      haptic([10, 30, 15]);
      toast.success("Successfully saved to project board.", {
        description: project ? project.name : GENERAL_LIBRARY_TITLE,
      });
      setSavedLabel(project ? project.name : GENERAL_LIBRARY_TITLE);
      dismissTimer.current = window.setTimeout(() => {
        setOpen(false);
        setSavedLabel(null);
      }, 1500);
    } finally {
      setSavingId(null);
    }
  };

  if (!user) return null;

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); haptic(8); setSavedLabel(null); setOpen(true); }}
        aria-label="Save to studio dashboard"
        className={cn(
          "flex items-center justify-center w-10 h-10 rounded-[2px] bg-background/90 backdrop-blur-sm border border-border shadow-sm text-foreground active:scale-95 transition-transform",
          className,
        )}
      >
        <FolderPlus size={17} strokeWidth={1.5} />
      </button>

      <Drawer open={open} onOpenChange={setOpen}>
        <DrawerContent className="rounded-t-[2px] border-t border-border">
          <DrawerTitle className="sr-only">Save {productTitle} to a project</DrawerTitle>
          <div className="px-5 pt-1 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            {savedLabel ? (
              <div className="flex items-center gap-3 py-6">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-foreground text-background">
                  <Check size={16} strokeWidth={2} />
                </span>
                <div className="min-w-0">
                  <p className="font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Saved to</p>
                  <p className="font-display text-base truncate">{savedLabel}</p>
                </div>
              </div>
            ) : (
              <>
                <p className="font-body text-[11px] uppercase tracking-[0.18em] text-muted-foreground pb-3">
                  Save to studio dashboard
                </p>
                {loading ? (
                  <div className="flex items-center gap-2 py-6 text-muted-foreground">
                    <Loader2 size={15} className="animate-spin" />
                    <span className="font-body text-sm">Loading projects…</span>
                  </div>
                ) : (
                  <ul className="divide-y divide-border/60">
                    {topThree.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => save(p)}
                          disabled={!!savingId}
                          className="w-full flex items-center justify-between gap-3 py-3 text-left active:opacity-60"
                        >
                          <span className="min-w-0">
                            <span className="block font-display text-[15px] truncate">{p.name}</span>
                            {p.client_name && (
                              <span className="block font-body text-xs text-muted-foreground truncate">{p.client_name}</span>
                            )}
                          </span>
                          {savingId === p.id
                            ? <Loader2 size={15} className="animate-spin shrink-0 text-muted-foreground" />
                            : <FolderPlus size={15} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />}
                        </button>
                      </li>
                    ))}
                    <li>
                      <button
                        onClick={() => save(null)}
                        disabled={!!savingId}
                        className="w-full flex items-center justify-between gap-3 py-3 text-left active:opacity-60"
                      >
                        <span className="font-display text-[15px]">{GENERAL_LIBRARY_TITLE}</span>
                        {savingId === "__library__"
                          ? <Loader2 size={15} className="animate-spin shrink-0 text-muted-foreground" />
                          : <Library size={15} strokeWidth={1.5} className="shrink-0 text-muted-foreground" />}
                      </button>
                    </li>
                  </ul>
                )}
              </>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
