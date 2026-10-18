import { useMemo, useState } from "react";
import { Columns2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loadProjectSnapshot } from "@/lib/projectLayoutSnapshots";
import { loadComparisonAnnotations } from "@/lib/snapshotComparisonAnnotations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { browseComparisons, type SavedComparison } from "@/lib/snapshotComparisonAnnotations";
import type { ProjectSnapshot } from "@/lib/projectLayoutSnapshots";

export async function exportSavedComparison(projectKey: string, c: SavedComparison, snapshots: ProjectSnapshot[]) {
  const left = snapshots.find(s => s.id === c.leftId), right = snapshots.find(s => s.id === c.rightId);
  if (!left || !right) throw new Error("missing snapshot");
  const [l, r, notes, pdf] = await Promise.all([loadProjectSnapshot(projectKey, left.id), loadProjectSnapshot(projectKey, right.id), loadComparisonAnnotations(projectKey, left.id, right.id), import("@/lib/snapshotComparisonPdf")]);
  const blob = await pdf.buildSnapshotComparisonPdf({ snapshot: left, data: l }, { snapshot: right, data: r }, notes ?? {}, { comparedAt: c.updatedAt });
  await pdf.downloadSnapshotComparison(blob);
}

export default function SavedComparisons({ projectKey, saved, snapshots, onOpen }: { projectKey: string; saved: SavedComparison[]; snapshots: ProjectSnapshot[]; onOpen: (ids: [string, string]) => void }) {
  const [exporting, setExporting] = useState("");
  const [sort, setSort] = useState<"date" | "title">("date");
  const [query, setQuery] = useState("");
  const items = useMemo(() => {
    const names = new Map(snapshots.map(s => [s.id, s.name]));
    const valid = saved.filter(c => names.has(c.leftId) && names.has(c.rightId)).map(c => ({ ...c, title: `${names.get(c.leftId)} vs ${names.get(c.rightId)}` }));
    return browseComparisons(valid, sort, query);
  }, [saved, snapshots, sort, query]);
  if (!saved.length) return null;
  return <div className="mt-4 border-t border-border pt-3">
    <div className="mb-2 flex items-center justify-between gap-2">
      <h3 className="text-xs font-medium">Saved comparisons</h3>
      <div className="flex gap-1" role="group" aria-label="Sort saved comparisons">
        {(["date", "title"] as const).map(s => <Button key={s} size="sm" variant={sort === s ? "secondary" : "ghost"} aria-pressed={sort === s} className="h-6 px-2 text-[10px] capitalize" onClick={() => setSort(s)}>{s}</Button>)}
      </div>
    </div>
    <Input aria-label="Search saved comparisons" placeholder="Search by title or note" value={query} onChange={e => setQuery(e.target.value)} className="mb-2 h-8 text-xs" />
    {!items.length && <p className="text-xs text-muted-foreground">No matching comparisons.</p>}
    <ul className="space-y-1">
      {items.map(c => <li key={`${c.leftId}:${c.rightId}`} className="flex items-center gap-1">
        <button type="button" onClick={() => onOpen([c.leftId, c.rightId])} className="flex min-w-0 flex-1 items-start gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted/60">
          <Columns2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1"><span className="block break-words text-xs">{c.title}</span><span className="block text-[10px] text-muted-foreground">{new Date(c.updatedAt).toLocaleString()} · {c.noteCount} {c.noteCount === 1 ? "note" : "notes"}</span></span>
        </button>
        <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" disabled={!!exporting} aria-label={`Download PDF for ${c.title}`} title="Download client PDF" onClick={async () => { const id = `${c.leftId}:${c.rightId}`; setExporting(id); try { await exportSavedComparison(projectKey, c, snapshots); } catch { toast.error("Couldn't prepare the PDF. Please try again."); } finally { setExporting(""); } }}>{exporting === `${c.leftId}:${c.rightId}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}</Button>
      </li>)}
    </ul>
  </div>;
}
