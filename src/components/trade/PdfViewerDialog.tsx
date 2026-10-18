import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  open: boolean; onOpenChange: (open: boolean) => void; title: string; description?: string;
  /** Builds the PDF; re-run whenever `buildKey` changes while open. */
  build: () => Promise<Blob>; buildKey?: string; fileName: string;
};

/** Full multi-page in-app PDF viewer with a download of the exact previewed file. */
export function PdfViewerDialog({ open, onOpenChange, title, description, build, buildKey = "", fileName }: Props) {
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<"idle" | "building" | "error">("idle");
  useEffect(() => {
    if (!open) return;
    let off = false; let made: string | null = null;
    setState("building"); setUrl(null);
    build().then(blob => { if (off) return; made = URL.createObjectURL(blob); setUrl(made); setState("idle"); })
      .catch(() => { if (!off) setState("error"); });
    return () => { off = true; if (made) URL.revokeObjectURL(made); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, buildKey]);
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="flex h-[90vh] max-w-5xl flex-col">
      <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
      <div className="min-h-0 flex-1 border border-border">
        {state === "building" && <div className="flex h-full items-center justify-center text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />Preparing preview…</div>}
        {state === "error" && <p role="alert" className="p-6 text-sm text-destructive">The preview couldn't be prepared. Close and try again.</p>}
        {url && <iframe title={title} src={url} className="h-full w-full" />}
      </div>
      {url && <div className="flex justify-end"><Button asChild size="sm"><a href={url} download={fileName}><Download className="mr-2 h-4 w-4" />Download this PDF</a></Button></div>}
    </DialogContent>
  </Dialog>;
}
