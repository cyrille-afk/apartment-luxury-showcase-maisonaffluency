import { useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useUserBoards } from "@/hooks/useUserBoards";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildMoodBoardPdf, moodBoardFileName, type MoodBoardExportItem } from "@/lib/moodBoardExport";

/** Client-safe PDF of a project tearsheet board: pictures, piece, maker, chosen finishes — never prices. */
export default function TearsheetBoardPdfExport({ projectId, projectName }: { projectId: string; projectName: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [ready, setReady] = useState<{ blob: Blob; name: string } | null>(null);
  const { boards, loading, error: boardsError } = useUserBoards(open, projectId);
  const projectBoards = boards.filter((b) => b.project_id === projectId);

  const build = async (boardId: string, title: string) => {
    setBusy(boardId); setError(""); setReady(null);
    try {
      const { data: rows, error: e1 } = await supabase.from("client_board_items")
        .select("product_id, variant_label, fabric_label, wood_label, sort_order")
        .eq("board_id", boardId).order("sort_order", { ascending: true });
      if (e1) throw e1;
      if (!rows?.length) { setError("This board has no pieces yet."); return; }
      const ids = [...new Set(rows.map((r) => r.product_id))];
      const { data: products, error: e2 } = await supabase.from("trade_products")
        .select("id, product_name, brand_name, image_url").in("id", ids);
      if (e2) throw e2;
      const byId = new Map((products ?? []).map((p) => [p.id, p]));
      const items: MoodBoardExportItem[] = rows.map((r) => {
        const p = byId.get(r.product_id);
        return {
          product_name: p?.product_name ?? "Piece",
          brand_name: p?.brand_name ?? "",
          image_url: p?.image_url ?? null,
          detail: [r.variant_label, ...[r.fabric_label, r.wood_label].filter((l) => l && !(r.variant_label ?? "").includes(l))].filter(Boolean).join(" · ") || null,
        };
      });
      const blob = await buildMoodBoardPdf(`${projectName} — ${title}`, items, null);
      setReady({ blob, name: moodBoardFileName(`${projectName} ${title}`) });
    } catch {
      setError("The PDF could not be prepared. Try again.");
    } finally {
      setBusy(null);
    }
  };

  const download = () => {
    if (!ready) return;
    const url = URL.createObjectURL(ready.blob);
    const a = document.createElement("a");
    a.href = url; a.download = ready.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}><FileDown className="mr-1.5 h-3.5 w-3.5" />Export PDF</Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setReady(null); setError(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Export board PDF</DialogTitle>
            <DialogDescription>Pictures, piece names, makers and chosen finishes. Prices are never included.</DialogDescription>
          </DialogHeader>
          {loading ? <p className="font-body text-sm text-muted-foreground">Loading boards…</p>
            : boardsError ? <p role="alert" className="font-body text-sm text-destructive">Boards could not be loaded. Close and try again.</p>
            : projectBoards.length === 0 ? <p className="font-body text-sm text-muted-foreground">This project has no boards yet.</p>
            : <ul className="space-y-2">
                {projectBoards.map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 border-b border-border pb-2">
                    <span className="font-body text-sm truncate">{b.title}</span>
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => build(b.id, b.title)}>
                      {busy === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Prepare"}
                    </Button>
                  </li>
                ))}
              </ul>}
          <div className="min-h-[1.25rem]">{error && <p role="alert" className="font-body text-xs text-destructive">{error}</p>}</div>
          {ready && <Button onClick={download}><FileDown className="mr-1.5 h-4 w-4" />Download {ready.name}</Button>}
        </DialogContent>
      </Dialog>
    </>
  );
}
