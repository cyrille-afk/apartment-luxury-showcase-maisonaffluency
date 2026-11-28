import { lazy, Suspense, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Camera } from "lucide-react";
import { ActiveProjectProvider } from "@/contexts/ActiveProjectContext";
import { useAuth } from "@/hooks/useAuth";
const Sandbox = lazy(() => import("@/pages/TradeVisualiser"));

export default function SandboxShellCapture({ disabled, onCapture }: { disabled: boolean; onCapture: (url: string) => void }) {
  const [capture, setCapture] = useState<{ projectId: string } | null>(null);
  const { user } = useAuth();
  return <>
    <Button size="sm" variant="outline" disabled={disabled} onClick={() => {
      const query = new URLSearchParams(window.location.search);
      setCapture({ projectId: query.get("project") || "sandbox" });
    }}><Camera />Capture from 3D Sandbox</Button>
    <Dialog open={Boolean(capture)} onOpenChange={open => { if (!open) setCapture(null); }}><DialogContent className="flex h-[95dvh] w-[96vw] max-w-none flex-col p-3 pt-12"><DialogTitle className="px-8">Capture Empty Eye-Level Shell</DialogTitle>
      {capture && user && <div className="min-h-0 w-full flex-1"><ActiveProjectProvider accountId={user.id} projectId={capture.projectId} initialView="sandbox" readOnly><Suspense fallback={<p className="p-6 text-sm text-muted-foreground">Opening Sandbox…</p>}><Sandbox captureOnly onShellCapture={url => { onCapture(url); setCapture(null); }} /></Suspense></ActiveProjectProvider></div>}
    </DialogContent></Dialog>
  </>;
}