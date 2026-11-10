import { useEffect, useState } from "react";
import { Mail, Monitor, Smartphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { absoluteUrl } from "@/config/site";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

type Props = {
  studioName?: string | null;
  projectName?: string | null;
  boardTitle?: string | null;
  projectId?: string | null;
  itemCount: number;
};

/** Review-only render of the real shared-board invitation email; nothing is sent. */
export default function BoardInviteEmailPreview({ studioName, projectName, projectId, boardTitle, itemCount }: Props) {
  const [open, setOpen] = useState(false);
  const [device, setDevice] = useState<"desktop" | "mobile">("desktop");
  const [result, setResult] = useState<{ html: string; subject: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setResult(null);
    setError(null);
    (async () => {
      let resolvedProject = projectName;
      if (!resolvedProject && projectId) {
        const { data: proj } = await supabase.from("projects" as any).select("name").eq("id", projectId).maybeSingle();
        resolvedProject = (proj as { name?: string } | null)?.name ?? null;
      }
      return supabase.functions.invoke("render-email-preview", {
        body: {
          templateName: "board-collaborator-invite",
          templateData: {
            studioName: studioName || "Your studio",
            hideMaisonBranding: true,
            projectName: resolvedProject || "Project portfolio",
            boardTitle: boardTitle || "Curated selection",
            role: "client",
            itemCount,
            // The real invitation is sent on the production domain, so the
            // sample must show that address — never the sandbox preview host.
            link: absoluteUrl("/shared/board/preview"),
          },
        },
      });
    })().then(({ data, error: err }) => {
        if (!alive) return;
        const html = (data as { html?: string } | null)?.html;
        if (err || !html) setError("The preview couldn't be loaded. Only admins can open email previews.");
        else setResult(data as { html: string; subject: string });
      });
    return () => { alive = false; };
  }, [open, studioName, projectName, projectId, boardTitle, itemCount]);

  return (
    <>
      <Button size="sm" variant="outline" className="gap-1.5 rounded-none" onClick={() => setOpen(true)}>
        <Mail className="h-3.5 w-3.5" /> Preview invitation email
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-5xl rounded-none">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">Invitation email preview</DialogTitle>
            <p className="font-body text-xs text-muted-foreground">
              {result ? <>Subject: <span className="text-foreground">{result.subject}</span> · </> : null}
              Preview only — no email is sent. The link shown is a sample.
            </p>
          </DialogHeader>
          <div className="flex gap-2" role="group" aria-label="Preview size">
            <Button size="sm" variant={device === "desktop" ? "default" : "outline"} className="gap-1.5 rounded-none" aria-pressed={device === "desktop"} onClick={() => setDevice("desktop")}>
              <Monitor className="h-3.5 w-3.5" /> Desktop
            </Button>
            <Button size="sm" variant={device === "mobile" ? "default" : "outline"} className="gap-1.5 rounded-none" aria-pressed={device === "mobile"} onClick={() => setDevice("mobile")}>
              <Smartphone className="h-3.5 w-3.5" /> Mobile
            </Button>
          </div>
          <div className="flex h-[70vh] justify-center overflow-auto border border-border bg-muted p-4">
            {error ? (
              <p className="self-center font-body text-sm text-muted-foreground">{error}</p>
            ) : !result ? (
              <p className="self-center font-body text-sm text-muted-foreground">Loading preview…</p>
            ) : (
              <iframe
                title={`Invitation email — ${device}`}
                srcDoc={result.html}
                sandbox=""
                className="h-full shrink-0 border border-border bg-background"
                style={{ width: device === "desktop" ? 760 : 375 }}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
