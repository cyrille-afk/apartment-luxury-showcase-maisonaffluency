import { useEffect, useRef, useState } from "react";
import { FileDown, FolderPlus, Loader2, Check, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/hooks/useStudio";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import ClientViewToggle from "@/components/trade/ClientViewToggle";
import { buildMoodBoardPdf, moodBoardFileName } from "@/lib/moodBoardExport";
import { moodBoardStudioItems } from "@/lib/moodBoardStudioTransfer";
import { useNavigate } from "@/lib/router-compat";
import { getActiveProjectId } from "@/lib/activeProjectId";
import { useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";

export const MOOD_BOARD_MAX_SAVE = 15;

interface Props {
  items: { id: string; product_name?: string; brand_name?: string; image_url?: string }[];
  defaultProjectId: string | null;
}

/** Next steps once pieces are chosen: save to a project, export, and present. */
export function MoodBoardActions({ items, defaultProjectId }: Props) {
  const { currentStudio } = useStudio();
  const navigate = useNavigate();
  const workspace = useProjectWorkspace();
  const [studioIntent, setStudioIntent] = useState(false);
  const transferProgress = useRef({ key: "", completed: 0 });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Mood board");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const disabled = items.length === 0;
  useEffect(() => { setProjectId(defaultProjectId); }, [defaultProjectId]);

  const save = async (toStudio = studioIntent, destination = projectId) => {
    if (saving || (toStudio && !destination)) return;
    setSaving(true);
    setMessage(null);
    try {
      const configured = toStudio ? await moodBoardStudioItems(items.map(i => i.id)) : items.slice(0, MOOD_BOARD_MAX_SAVE).map(i => ({ product_id: i.id }));
      const key = JSON.stringify([destination, title.trim(), configured]);
      if (transferProgress.current.key !== key) transferProgress.current = { key, completed: 0 };
      for (let start = toStudio ? transferProgress.current.completed : 0; start < configured.length; start += MOOD_BOARD_MAX_SAVE) {
        // Generated RPC types omit SQL-nullable UUID arguments used by board saves.
        const { error } = await (supabase as any).rpc("create_visualiser_client_board", {
          _title: title.trim(),
          _client_id: null,
          _project_id: destination,
          _studio_id: currentStudio?.id ?? null,
          _studio_name: currentStudio?.name ?? "",
          _studio_logo_url: (currentStudio as any)?.logo_url ?? "",
          _hide_maison_branding: false,
          _items: configured.slice(start, start + MOOD_BOARD_MAX_SAVE),
        });
        if (error) throw error;
        if (toStudio) transferProgress.current.completed = start + MOOD_BOARD_MAX_SAVE;
      }
      window.dispatchEvent(new Event("trade-projects:changed"));
      setMessage({ tone: "ok", text: destination ? "Saved to the project's boards." : "Saved to your boards." });
      setOpen(false);
      if (toStudio && destination) navigate(`/trade/projects/${encodeURIComponent(destination)}/studio`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String((error as { message?: string })?.message || "");
      const text = /unavailable/i.test(detail)
        ? "One of these pieces is no longer in the catalogue. Remove it and save again."
        : /title/i.test(detail)
          ? "Enter a board name."
          : /access/i.test(detail)
            ? "You can't save to that project. Choose another project."
            : "The board couldn't be saved. Please try again.";
      setMessage({ tone: "error", text });
      if (toStudio && /access/i.test(detail)) setOpen(true);
    } finally { setSaving(false); }
  };
  const openStudio = () => {
    setStudioIntent(true);
    setMessage(null);
    const destination = defaultProjectId || workspace?.activeFolder?.projectId || getActiveProjectId();
    setProjectId(destination);
    if (destination) void save(true, destination);
    else setOpen(true);
  };

  const exportPdf = async () => {
    setExporting(true);
    setMessage(null);
    try {
      const blob = await buildMoodBoardPdf(title.trim() || "Mood board", items, currentStudio?.name);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = moodBoardFileName(title);
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch {
      setMessage({ tone: "error", text: "The PDF couldn't be prepared. Please try again." });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <div className="flex flex-wrap items-center gap-2">
        <ClientViewToggle iconOnly />
        <Button variant="outline" size="sm" disabled={disabled || exporting} onClick={exportPdf} className="h-9 text-[11px] uppercase tracking-[0.12em]">
          {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
          Export PDF
        </Button>
        <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" disabled={disabled || saving} onClick={() => { setStudioIntent(false); setMessage(null); setOpen(true); }} className="h-9 cursor-pointer text-[11px] uppercase tracking-[0.12em]">
          <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
          Save to project
        </Button>
        <Button variant="studio-primary" size="sm" title="Select finishes & AI pairings" disabled={disabled || saving} onClick={openStudio} className="h-9 cursor-pointer gap-1.5 px-4 text-[11px] uppercase tracking-[0.12em]">
          {saving && studioIntent ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LayoutTemplate className="h-3.5 w-3.5" />}Open in Project Studio
        </Button>
        </div>
      </div>
      <p role="status" aria-live="polite" className={`min-h-4 font-body text-xs ${message?.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
        {message?.tone === "ok" && <Check className="mr-1 inline h-3 w-3" />}
        {message?.text}
      </p>

      <Dialog open={open} onOpenChange={value => { if (!saving) setOpen(value); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">{studioIntent ? "Open in Project Studio" : "Save mood board"}</DialogTitle>
            <DialogDescription>
              {studioIntent ? "Choose a project for your current pieces and catalogue finishes." : "Saved as a board you can share with your client or open from the project."}
              {!studioIntent && items.length > MOOD_BOARD_MAX_SAVE && ` Only the first ${MOOD_BOARD_MAX_SAVE} pieces are saved.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Board name" aria-label="Board name" />
            <ProjectPicker value={projectId} onChange={setProjectId} required={studioIntent} />
            {message?.tone === "error" && <p className="font-body text-xs text-destructive">{message.text}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant={studioIntent ? "studio-primary" : "default"} onClick={() => void save()} disabled={saving || !title.trim() || (studioIntent && !projectId)}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {studioIntent ? "Save & open Project Studio" : "Save board"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
