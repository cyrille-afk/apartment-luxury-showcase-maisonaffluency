import { useState } from "react";
import { FileDown, FolderPlus, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useStudio } from "@/hooks/useStudio";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import ClientViewToggle from "@/components/trade/ClientViewToggle";
import { buildMoodBoardPdf, moodBoardFileName } from "@/lib/moodBoardExport";

export const MOOD_BOARD_MAX_SAVE = 15;

interface Props {
  items: { id: string; product_name?: string; brand_name?: string; image_url?: string }[];
  defaultProjectId: string | null;
}

/** Next steps once pieces are chosen: save to a project, export, and present. */
export function MoodBoardActions({ items, defaultProjectId }: Props) {
  const { currentStudio } = useStudio();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("Mood board");
  const [projectId, setProjectId] = useState<string | null>(defaultProjectId);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const disabled = items.length === 0;

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const { error } = await (supabase as any).rpc("create_visualiser_client_board", {
      _title: title.trim(),
      _client_id: null,
      _project_id: projectId,
      _studio_id: currentStudio?.id ?? null,
      _studio_name: currentStudio?.name ?? "",
      _studio_logo_url: (currentStudio as any)?.logo_url ?? "",
      _hide_maison_branding: false,
      _items: items.slice(0, MOOD_BOARD_MAX_SAVE).map((i) => ({ product_id: i.id })),
    });
    setSaving(false);
    if (error) {
      const text = /unavailable/i.test(error.message)
        ? "One of these pieces is no longer in the catalogue. Remove it and save again."
        : /title/i.test(error.message)
          ? "Enter a board name."
          : /access/i.test(error.message)
            ? "You can't save to that project. Choose another project."
            : "The board couldn't be saved. Please try again.";
      setMessage({ tone: "error", text });
      return;
    }
    setMessage({ tone: "ok", text: projectId ? "Saved to the project's boards." : "Saved to your boards." });
    setOpen(false);
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
        <ClientViewToggle />
        <Button variant="outline" size="sm" disabled={disabled || exporting} onClick={exportPdf} className="h-9 text-[11px] uppercase tracking-[0.12em]">
          {exporting ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <FileDown className="mr-1.5 h-3.5 w-3.5" />}
          Export PDF
        </Button>
        <Button size="sm" disabled={disabled} onClick={() => { setMessage(null); setOpen(true); }} className="h-9 text-[11px] uppercase tracking-[0.12em]">
          <FolderPlus className="mr-1.5 h-3.5 w-3.5" />
          Save to project
        </Button>
      </div>
      <p role="status" aria-live="polite" className={`min-h-4 font-body text-xs ${message?.tone === "error" ? "text-destructive" : "text-muted-foreground"}`}>
        {message?.tone === "ok" && <Check className="mr-1 inline h-3 w-3" />}
        {message?.text}
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-display">Save mood board</DialogTitle>
            <DialogDescription>
              Saved as a board you can share with your client or open from the project.
              {items.length > MOOD_BOARD_MAX_SAVE && ` Only the first ${MOOD_BOARD_MAX_SAVE} pieces are saved.`}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Board name" aria-label="Board name" />
            <ProjectPicker value={projectId} onChange={setProjectId} />
            {message?.tone === "error" && <p className="font-body text-xs text-destructive">{message.text}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !title.trim()}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Save board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
