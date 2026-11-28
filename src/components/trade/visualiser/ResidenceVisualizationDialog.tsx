import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Check, Wand2, RotateCw, FileImage } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getResidenceVisualizationShells, generateResidenceVisualization } from "@/lib/viewingRoom.functions";
import type { VisualizationChoice } from "@/lib/residenceVisualization";

export type ResidenceVisualizationResult = { id: string; url: string; selectionKey: string };
export default function ResidenceVisualizationDialog({ open, onOpenChange, token, packageId, residence, choices, selectionKey, onAttach, attachedId }: {
  open: boolean; onOpenChange: (open: boolean) => void; token: string; packageId: string; residence: string; choices: VisualizationChoice[]; selectionKey: string; onAttach: (result: ResidenceVisualizationResult) => void; attachedId?: string;
}) {
  const load = useServerFn(getResidenceVisualizationShells);
  const generate = useServerFn(generateResidenceVisualization);
  const query = useQuery({ queryKey: ["residence-visualization-shells",token,packageId], queryFn: () => load({ data: { token,packageId } }), enabled: open, retry: false });
  const [angle, setAngle] = useState("0");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<Record<string, ResidenceVisualizationResult>>({});
  const started = useRef(false);
  const shell = query.data?.[Number(angle)] ?? query.data?.[0];
  const result = results[shell?.url ?? ""];
  const currentResult = result?.selectionKey === selectionKey ? result : undefined;
  async function render() {
    if (!shell || busy) return;
    setBusy(true); setError("");
    const renderedKey = selectionKey;
    try { const generated = await generate({ data: { token, packageId, shellUrl: shell.url, choices } }); setResults(previous => ({ ...previous, [shell.url]: { ...generated, selectionKey: renderedKey } })); }
    catch (e) { setError(e instanceof Error ? e.message : "The visualization couldn’t be generated. Please retry."); }
    finally { setBusy(false); }
  }
  useEffect(() => { if (open && shell && !started.current) { started.current = true; void render(); } }, [open, shell]);
  return <Dialog open={open} onOpenChange={value => { if (!busy) onOpenChange(value); }}><DialogContent className="viewing-room flex max-h-[94dvh] w-[calc(100%-2rem)] max-w-5xl flex-col overflow-y-auto bg-background text-foreground">
    <DialogTitle className="pr-8 font-display text-2xl">Visualize in Your Residence</DialogTitle><DialogDescription>{residence}</DialogDescription>
    {query.isPending && <p role="status" className="py-12 text-center text-muted-foreground">Loading residence views…</p>}
    {query.isError && <div role="alert"><p>Residence views couldn’t load.</p><Button variant="outline" onClick={() => void query.refetch()}><RotateCw className="size-4" />Retry</Button></div>}
    {query.data?.length === 0 && <p className="py-12 text-center text-muted-foreground">Eye-level views are not yet available for this residence.</p>}
    {(query.data?.length ?? 0) > 1 && <Tabs value={angle} onValueChange={setAngle}><TabsList className="h-auto max-w-full justify-start overflow-x-auto bg-muted">{query.data?.map((view,index) => <TabsTrigger key={view.url} value={String(index)} disabled={busy} className="shrink-0">{view.label}</TabsTrigger>)}</TabsList></Tabs>}
    {shell && <><div className="grid gap-4 md:grid-cols-2"><figure className="min-w-0"><figcaption className="mb-2 text-xs text-muted-foreground">{shell.label} · Empty residence</figcaption><img src={shell.url} alt={`${shell.label} empty residence`} className="aspect-[4/3] w-full object-contain bg-muted/30" /></figure><figure className="min-w-0"><figcaption className="mb-2 text-xs text-muted-foreground">Your collection</figcaption>{currentResult ? <img src={currentResult.url} alt="Your selected furniture staged in your residence" className="aspect-[4/3] w-full object-contain bg-muted/30" /> : <div className="flex aspect-[4/3] items-center justify-center bg-muted/30 px-4 text-center text-sm text-muted-foreground" role="status">{busy ? "Staging your collection…" : "Visualization pending"}</div>}</figure></div>
      <div className="flex flex-wrap justify-end gap-3"><Button variant="outline" disabled={busy} onClick={() => void render()}><Wand2 className={`size-4 ${busy ? "animate-pulse motion-reduce:animate-none" : ""}`} />{busy ? "Generating visualization…" : currentResult ? "Regenerate View" : "Generate View"}</Button>{currentResult && <Button disabled={busy || attachedId === currentResult.id} onClick={() => { onAttach(currentResult); onOpenChange(false); }}>{attachedId === currentResult.id ? <Check className="size-4" /> : <FileImage className="size-4" />}{attachedId === currentResult.id ? "Attached to Proposal" : "Attach to Final Proposal PDF"}</Button>}</div></>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
  </DialogContent></Dialog>;
}