import { useState } from "react";
import { Clock, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export default function ViewingRoomAccessControls({ developer, projectId, disabled, onChanged }: {
  developer: Tables<"developer_projects">; projectId: string; disabled: boolean;
  onChanged: (row: Tables<"developer_projects">) => void;
}) {
  const [expiry, setExpiry] = useState("");
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const ended = !!developer.access_revoked_at || (!!developer.access_expires_at && Date.parse(developer.access_expires_at) <= Date.now());
  const save = async (action: "expire" | "revoke") => {
    if (busy || disabled || ended) return;
    const date = expiry ? new Date(expiry) : null;
    if (action === "expire" && (!date || !Number.isFinite(date.getTime()) || date.getTime() <= Date.now())) {
      setError("Choose a future expiry date and time."); return;
    }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await supabase.rpc("admin_end_viewing_room_access", { _project_id: projectId, _developer_id: developer.id, _action: action, _expires_at: action === "expire" ? date?.toISOString() : undefined });
      if (result.error) throw result.error;
      const fresh = await supabase.from("developer_projects").select("*").eq("id", developer.id).eq("project_id", projectId).single();
      if (fresh.error) throw fresh.error;
      onChanged(fresh.data); setConfirm(false);
      setNotice(action === "revoke" ? "Access revoked. This code can no longer be used." : "Access expiry saved.");
    } catch { setError("Access settings couldn’t save. Please retry."); }
    finally { setBusy(false); }
  };
  return <div className="space-y-3 border-t border-border pt-4">
    <p className="text-sm" role="status">{developer.access_revoked_at ? "Code revoked" : ended ? "Code expired" : developer.access_expires_at ? `Active · expires ${new Date(developer.access_expires_at).toLocaleString()}` : "Active · no expiry set"}</p>
    {!ended && <><Label htmlFor="viewing-room-expiry">End client access on (your local time)</Label>
      <Input id="viewing-room-expiry" type="datetime-local" value={expiry} disabled={disabled || busy} onChange={event => setExpiry(event.target.value)} />
      <div className="flex flex-wrap gap-2"><Button variant="outline" disabled={disabled || busy || !expiry} onClick={() => void save("expire")}><Clock className="size-4" />Save expiry</Button>
        <Button variant="outline" disabled={disabled || busy} onClick={() => { setError(""); setConfirm(true); }}><ShieldX className="size-4" />Revoke code</Button></div></>}
    {error && !confirm && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {notice && <p role="status" className="text-sm">{notice}</p>}
    <Dialog open={confirm} onOpenChange={open => { if (!busy) setConfirm(open); }}><DialogContent><DialogHeader><DialogTitle>Revoke private access code?</DialogTitle><DialogDescription>Clients using this code will lose access to {developer.developer_name}, including previously opened sessions. This code cannot be reactivated. Saved layouts and packages will remain unchanged.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={() => setConfirm(false)}>Keep access</Button><Button variant="destructive" disabled={busy} onClick={() => void save("revoke")}>{busy ? "Revoking…" : "Confirm revocation"}</Button></div>
    </DialogContent></Dialog>
  </div>;
}