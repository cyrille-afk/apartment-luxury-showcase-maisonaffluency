import { useEffect, useState, useCallback } from "react";
import { ShieldCheck, FileWarning, Plus, Trash2, Loader2, FileCheck2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type Cert = {
  id: string;
  studio_id: string;
  state_code: string;
  certificate_number: string | null;
  issued_on: string | null;
  expires_on: string | null;
  document_path: string;
  verification_status: string;
  rejected_reason: string | null;
};

const US_STATES: { code: string; name: string }[] = [
  ["AL","Alabama"],["AK","Alaska"],["AZ","Arizona"],["AR","Arkansas"],["CA","California"],
  ["CO","Colorado"],["CT","Connecticut"],["DE","Delaware"],["FL","Florida"],["GA","Georgia"],
  ["HI","Hawaii"],["ID","Idaho"],["IL","Illinois"],["IN","Indiana"],["IA","Iowa"],
  ["KS","Kansas"],["KY","Kentucky"],["LA","Louisiana"],["ME","Maine"],["MD","Maryland"],
  ["MA","Massachusetts"],["MI","Michigan"],["MN","Minnesota"],["MS","Mississippi"],["MO","Missouri"],
  ["MT","Montana"],["NE","Nebraska"],["NV","Nevada"],["NH","New Hampshire"],["NJ","New Jersey"],
  ["NM","New Mexico"],["NY","New York"],["NC","North Carolina"],["ND","North Dakota"],["OH","Ohio"],
  ["OK","Oklahoma"],["OR","Oregon"],["PA","Pennsylvania"],["RI","Rhode Island"],["SC","South Carolina"],
  ["SD","South Dakota"],["TN","Tennessee"],["TX","Texas"],["UT","Utah"],["VT","Vermont"],
  ["VA","Virginia"],["WA","Washington"],["WV","West Virginia"],["WI","Wisconsin"],["WY","Wyoming"],
  ["DC","District of Columbia"],
].map(([code, name]) => ({ code, name }));

const STATUS_BADGE: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  pending:  { label: "Pending review", variant: "secondary" },
  verified: { label: "Verified",       variant: "default"   },
  rejected: { label: "Rejected",       variant: "destructive" },
  expired:  { label: "Expired",        variant: "outline"   },
};

export default function ResaleCertificatesSection() {
  const { user } = useAuth();
  const { currentStudio, isAdmin } = useStudio();
  const { toast } = useToast();

  const [certs, setCerts] = useState<Cert[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [form, setForm] = useState({
    state_code: "NY",
    certificate_number: "",
    issued_on: "",
    expires_on: "",
    file: null as File | null,
  });

  const fetchCerts = useCallback(async () => {
    if (!currentStudio) return;
    setLoading(true);
    const { data } = await supabase
      .from("studio_resale_certificates")
      .select("*")
      .eq("studio_id", currentStudio.id)
      .order("state_code");
    setCerts((data as Cert[]) ?? []);
    setLoading(false);
  }, [currentStudio]);

  useEffect(() => { fetchCerts(); }, [fetchCerts]);

  const handleUpload = async () => {
    if (!currentStudio || !user || !form.file) return;
    setUploading(true);
    try {
      const ext = form.file.name.split(".").pop() || "pdf";
      const path = `${currentStudio.id}/resale-certs/${form.state_code}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("client-documents")
        .upload(path, form.file, { contentType: form.file.type, upsert: false });
      if (upErr) throw upErr;

      const { error: insErr } = await supabase.from("studio_resale_certificates").insert({
        studio_id: currentStudio.id,
        uploaded_by: user.id,
        state_code: form.state_code,
        certificate_number: form.certificate_number.trim() || null,
        issued_on: form.issued_on || null,
        expires_on: form.expires_on || null,
        document_path: path,
        verification_status: "pending",
      });
      if (insErr) throw insErr;

      toast({ title: "Certificate uploaded", description: `${form.state_code} cert is pending review.` });
      setOpen(false);
      setForm({ state_code: "NY", certificate_number: "", issued_on: "", expires_on: "", file: null });
      fetchCerts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Upload failed", description: msg, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (cert: Cert) => {
    if (!confirm(`Delete the ${cert.state_code} resale certificate?`)) return;
    await supabase.storage.from("client-documents").remove([cert.document_path]);
    const { error } = await supabase.from("studio_resale_certificates").delete().eq("id", cert.id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    fetchCerts();
  };

  if (!currentStudio) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <ShieldCheck className="h-5 w-5" /> US resale certificates
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Required to buy net (tax-exempt for resale) on US-shipped orders. Upload one per state you ship into. Verification is manual.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Upload
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : certs.length === 0 ? (
          <div className="text-sm text-muted-foreground flex items-start gap-2">
            <FileWarning className="h-4 w-4 mt-0.5 shrink-0" />
            No certificates yet. Until one is verified, US ship-to addresses will be limited to agent-mode checkout (we bill the end-client at MSRP).
          </div>
        ) : (
          <div className="divide-y">
            {certs.map((c) => {
              const meta = STATUS_BADGE[c.verification_status] ?? STATUS_BADGE.pending;
              const stateName = US_STATES.find((s) => s.code === c.state_code)?.name ?? c.state_code;
              return (
                <div key={c.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <FileCheck2 className="h-4 w-4" /> {stateName} <span className="text-muted-foreground">({c.state_code})</span>
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {c.certificate_number && <>#{c.certificate_number} • </>}
                      {c.issued_on && <>Issued {c.issued_on} • </>}
                      {c.expires_on ? <>Expires {c.expires_on}</> : <>No expiry on file</>}
                    </div>
                    {c.verification_status === "rejected" && c.rejected_reason && (
                      <p className="text-xs text-destructive mt-1">{c.rejected_reason}</p>
                    )}
                  </div>
                  {isAdmin && (
                    <Button size="icon" variant="ghost" onClick={() => handleDelete(c)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Upload resale certificate</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ship-to state</Label>
              <Select value={form.state_code} onValueChange={(v) => setForm({ ...form, state_code: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent className="max-h-80">
                  {US_STATES.map((s) => (
                    <SelectItem key={s.code} value={s.code}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="cert-number">Certificate / registration number</Label>
              <Input id="cert-number" value={form.certificate_number} onChange={(e) => setForm({ ...form, certificate_number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="cert-issued">Issued on</Label>
                <Input id="cert-issued" type="date" value={form.issued_on} onChange={(e) => setForm({ ...form, issued_on: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="cert-expires">Expires on</Label>
                <Input id="cert-expires" type="date" value={form.expires_on} onChange={(e) => setForm({ ...form, expires_on: e.target.value })} />
              </div>
            </div>
            <div>
              <Label htmlFor="cert-file">Document (PDF or image)</Label>
              <Input
                id="cert-file"
                type="file"
                accept="application/pdf,image/*"
                onChange={(e) => setForm({ ...form, file: e.target.files?.[0] ?? null })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Stored privately. Our team verifies certificates within 1 business day; you'll be notified when {form.state_code} is unlocked for net-buy checkout.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleUpload} disabled={uploading || !form.file}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Uploading…</> : "Upload"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
