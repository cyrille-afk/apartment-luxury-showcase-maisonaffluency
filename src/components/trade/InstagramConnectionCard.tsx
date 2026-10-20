import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw } from "lucide-react";

type Check = { state: string; message: string; igUsername?: string | null; expiresAt?: string | null };

const LABEL: Record<string, string> = {
  working: "Working",
  not_configured: "Not connected",
  invalid_token: "Needs reconnecting",
  no_business_account: "Account not linked",
  error: "Not working",
};

export default function InstagramConnectionCard() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data, isFetching, refetch } = useQuery({
    queryKey: ["instagram-connection-status"],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("instagram-connection", { body: { action: "status" } });
      if (error) throw error;
      return data.check as Check;
    },
    staleTime: 60_000,
  });

  const save = async () => {
    setSaving(true);
    setSaveError(null);
    try {
      const { data: res, error } = await supabase.functions.invoke("instagram-connection", { body: { action: "save", token } });
      if (error) {
        let detail: { error?: string; check?: Check } | null = null;
        try { detail = await error.context?.json(); } catch { /* use safe fallback */ }
        setSaveError(detail?.error ?? detail?.check?.message ?? "Couldn't save the connection. Please try again.");
        return;
      }
      if (!res?.saved) { setSaveError(res?.error ?? res?.check?.message ?? "Meta rejected this login."); return; }
      toast.success(`Connected as @${res.check.igUsername}. Automatic Instagram checks are working.`);
      setToken(""); setOpen(false);
      qc.setQueryData(["instagram-connection-status"], res.check);
    } catch {
      setSaveError("Couldn't reach the connection checker. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const ok = data?.state === "working";
  const expires = data?.expiresAt ? new Date(data.expiresAt) : null;
  const daysLeft = expires ? Math.round((expires.getTime() - Date.now()) / 86_400_000) : null;

  return (
    <div className="flex flex-col gap-3 border-b border-border px-6 py-4 md:flex-row md:items-center md:justify-between" data-testid="instagram-connection-card">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-[11px] uppercase tracking-[0.25em] text-muted-foreground">Automatic Instagram checks</span>
        {isFetching && !data ? <Loader2 className="h-4 w-4 animate-spin" /> : (
          <Badge variant={ok ? "default" : "destructive"}>{LABEL[data?.state ?? "error"] ?? "Unknown"}</Badge>
        )}
        <span className="text-muted-foreground">
          {data?.message}{ok && data?.igUsername ? ` Using @${data.igUsername}.` : ""}
          {ok && daysLeft !== null ? ` Login expires in ${daysLeft} days.` : ""}
        </span>
      </div>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-1 h-3 w-3 ${isFetching ? "animate-spin" : ""}`} />Check again
        </Button>
        <Button size="sm" onClick={() => setOpen(true)}>{ok ? "Replace connection" : "Reconnect Instagram"}</Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Reconnect Maison Affluency's Instagram</DialogTitle>
            <DialogDescription>Takes about two minutes. You'll need to be signed in to Facebook as someone who manages the Maison Affluency Page.</DialogDescription>
          </DialogHeader>
          <ol className="list-decimal space-y-2 pl-5 text-sm">
            <li>Open <a className="underline" href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noreferrer">Meta's Graph API Explorer</a>.</li>
            <li>Under <b>Meta App</b>, choose the Maison Affluency app.</li>
            <li>Under <b>Permissions</b>, add: <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>instagram_basic</code>, <code>business_management</code>.</li>
            <li>Click <b>Generate Access Token</b> and approve, making sure the Maison Affluency Page and Instagram account are ticked.</li>
            <li>Copy the token and paste it below. We'll turn it into a 60-day login and test it before saving.</li>
          </ol>
          <Input type="password" placeholder="Paste access token" value={token} onChange={(e) => { setToken(e.target.value); setSaveError(null); }} aria-label="Meta access token" aria-invalid={Boolean(saveError)} aria-describedby={saveError ? "instagram-save-error" : undefined} />
          {saveError && <p id="instagram-save-error" role="alert" className="text-sm text-destructive">{saveError}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save} disabled={saving || !token.trim()}>
              {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Test and save
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
