import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ExternalLink, Download, Link as LinkIcon, FileUp, ShieldCheck, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type DocType = "nda" | "terms" | "counterparty" | "kyc" | "contract" | "other";
type StorageKind = "link" | "upload";

const DOC_TYPE_LABELS: Record<DocType, string> = {
  nda: "NDA",
  terms: "Terms & Conditions",
  counterparty: "Counterparty form",
  kyc: "KYC / ID",
  contract: "Contract",
  other: "Other",
};

// Sensitive types are best stored as external links (Drive / Dropbox / vault)
const SENSITIVE_TYPES: DocType[] = ["nda", "contract", "kyc"];

interface ClientDocument {
  id: string;
  client_id: string;
  studio_id: string;
  doc_type: DocType;
  label: string;
  storage_kind: StorageKind;
  external_url: string | null;
  storage_path: string | null;
  file_name: string | null;
  file_size_bytes: number | null;
  signed_at: string | null;
  expires_at: string | null;
  notes: string | null;
  created_at: string;
}

interface Props {
  clientId: string;
  studioId: string;
  userId: string;
  canEdit: boolean;
}

const MAX_FILE_MB = 25;

export default function ClientDocumentsSection({ clientId, studioId, userId, canEdit }: Props) {
  const { toast } = useToast();
  const [docs, setDocs] = useState<ClientDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newType, setNewType] = useState<DocType>("nda");
  const [newKind, setNewKind] = useState<StorageKind>("link");
  const [newLabel, setNewLabel] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newSignedAt, setNewSignedAt] = useState("");
  const [newExpiresAt, setNewExpiresAt] = useState("");
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<ClientDocument | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("client_documents" as any)
      .select("*")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) {
      toast({ title: "Failed to load documents", description: error.message, variant: "destructive" });
    } else {
      setDocs((data || []) as any);
    }
    setLoading(false);
  }, [clientId, toast]);

  useEffect(() => { load(); }, [load]);

  // When type flips to a sensitive one, nudge to "link"
  useEffect(() => {
    if (SENSITIVE_TYPES.includes(newType) && newKind === "upload") {
      setNewKind("link");
    }
  }, [newType]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetForm = () => {
    setAdding(false);
    setNewType("nda");
    setNewKind("link");
    setNewLabel("");
    setNewUrl("");
    setNewSignedAt("");
    setNewExpiresAt("");
  };

  const addLinkDoc = async () => {
    const label = newLabel.trim() || DOC_TYPE_LABELS[newType];
    const url = newUrl.trim();
    if (!url) {
      toast({ title: "URL required", description: "Paste the link to the document.", variant: "destructive" });
      return;
    }
    try {
      new URL(url);
    } catch {
      toast({ title: "Invalid URL", description: "Enter a full URL starting with https://", variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("client_documents" as any).insert({
      client_id: clientId,
      studio_id: studioId,
      created_by: userId,
      doc_type: newType,
      label,
      storage_kind: "link",
      external_url: url,
      signed_at: newSignedAt || null,
      expires_at: newExpiresAt || null,
    });
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document linked" });
    resetForm();
    load();
  };

  const handleUpload = async (file: File) => {
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max ${MAX_FILE_MB} MB`, variant: "destructive" });
      return;
    }
    const label = newLabel.trim() || file.name;
    const ext = file.name.split(".").pop() || "bin";
    const safe = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${studioId}/${clientId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safe}`;

    setUploading(true);
    const { error: upErr } = await supabase.storage
      .from("client-documents")
      .upload(path, file, { contentType: file.type || `application/${ext}`, upsert: false });

    if (upErr) {
      setUploading(false);
      toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
      return;
    }

    const { error: dbErr } = await supabase.from("client_documents" as any).insert({
      client_id: clientId,
      studio_id: studioId,
      created_by: userId,
      doc_type: newType,
      label,
      storage_kind: "upload",
      storage_path: path,
      file_name: file.name,
      file_size_bytes: file.size,
      mime_type: file.type || null,
      signed_at: newSignedAt || null,
      expires_at: newExpiresAt || null,
    });

    setUploading(false);
    if (dbErr) {
      // Roll back the orphaned file
      await supabase.storage.from("client-documents").remove([path]);
      toast({ title: "Failed to save", description: dbErr.message, variant: "destructive" });
      return;
    }
    toast({ title: "Document uploaded" });
    resetForm();
    load();
  };

  const openDoc = async (doc: ClientDocument) => {
    if (doc.storage_kind === "link" && doc.external_url) {
      window.open(doc.external_url, "_blank", "noopener,noreferrer");
      return;
    }
    if (doc.storage_kind === "upload" && doc.storage_path) {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(doc.storage_path, 60); // 60-second window
      if (error || !data?.signedUrl) {
        toast({ title: "Cannot open file", description: error?.message || "Unknown error", variant: "destructive" });
        return;
      }
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    const doc = confirmDelete;
    if (doc.storage_kind === "upload" && doc.storage_path) {
      await supabase.storage.from("client-documents").remove([doc.storage_path]);
    }
    const { error } = await supabase.from("client_documents" as any).delete().eq("id", doc.id);
    if (error) {
      toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Document removed" });
      setDocs((prev) => prev.filter((d) => d.id !== doc.id));
    }
    setConfirmDelete(null);
  };

  const isSensitive = SENSITIVE_TYPES.includes(newType);

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-body text-sm uppercase tracking-wider text-muted-foreground">
            Documents
          </h4>
          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1.5">
            <ShieldCheck className="h-3 w-3" />
            Sensitive originals (NDA, contracts, KYC) — link from your vault. Internal forms — upload privately.
          </p>
        </div>
        {canEdit && !adding && (
          <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
            <Plus className="h-3 w-3 mr-1" /> Add document
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-sm font-body text-muted-foreground">Loading…</p>
      ) : docs.length === 0 && !adding ? (
        <p className="text-sm font-body text-muted-foreground">No documents attached yet.</p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between gap-3 border border-border rounded-lg p-3"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                {doc.storage_kind === "link" ? (
                  <LinkIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                ) : (
                  <FileUp className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-body text-sm truncate">{doc.label}</span>
                    <Badge variant="secondary" className="text-[10px]">{DOC_TYPE_LABELS[doc.doc_type]}</Badge>
                    <Badge variant="outline" className="text-[10px]">
                      {doc.storage_kind === "link" ? "Linked" : "Hosted"}
                    </Badge>
                    {doc.expires_at && new Date(doc.expires_at) < new Date() && (
                      <Badge variant="destructive" className="text-[10px]">Expired</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {doc.signed_at && <>Signed {new Date(doc.signed_at).toLocaleDateString()}</>}
                    {doc.signed_at && doc.expires_at && <> · </>}
                    {doc.expires_at && <>Expires {new Date(doc.expires_at).toLocaleDateString()}</>}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button type="button" size="icon" variant="ghost" onClick={() => openDoc(doc)} aria-label="Open">
                  {doc.storage_kind === "link"
                    ? <ExternalLink className="h-4 w-4" />
                    : <Download className="h-4 w-4" />}
                </Button>
                {canEdit && (
                  <Button type="button" size="icon" variant="ghost" onClick={() => setConfirmDelete(doc)} aria-label="Remove">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <div className="border border-dashed border-border rounded-lg p-3 space-y-3 bg-muted/30">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-xs">Type</Label>
              <Select value={newType} onValueChange={(v) => setNewType(v as DocType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DOC_TYPE_LABELS) as DocType[]).map((t) => (
                    <SelectItem key={t} value={t}>{DOC_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Storage</Label>
              <Select value={newKind} onValueChange={(v) => setNewKind(v as StorageKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="link">Link to external file (recommended)</SelectItem>
                  <SelectItem value="upload" disabled={isSensitive}>
                    Upload to private storage{isSensitive ? " (not advised for this type)" : ""}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-2">
              <Label className="text-xs">Label</Label>
              <Input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder={DOC_TYPE_LABELS[newType]}
              />
            </div>
            {newKind === "link" && (
              <div className="md:col-span-2">
                <Label className="text-xs">URL (Drive, Dropbox, vault…)</Label>
                <Input
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://drive.google.com/…"
                />
              </div>
            )}
            <div>
              <Label className="text-xs">Signed on</Label>
              <Input type="date" value={newSignedAt} onChange={(e) => setNewSignedAt(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Expires on</Label>
              <Input type="date" value={newExpiresAt} onChange={(e) => setNewExpiresAt(e.target.value)} />
            </div>
          </div>

          {isSensitive && (
            <p className="text-xs text-muted-foreground flex items-start gap-1.5">
              <ShieldCheck className="h-3 w-3 mt-0.5 shrink-0" />
              For NDAs, contracts and KYC, we recommend keeping the original in your own document vault and pasting only the link here.
            </p>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetForm} disabled={uploading}>
              Cancel
            </Button>
            {newKind === "link" ? (
              <Button type="button" size="sm" onClick={addLinkDoc}>
                Save link
              </Button>
            ) : (
              <label className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-body rounded-md border border-border bg-background cursor-pointer hover:bg-muted ${uploading ? "opacity-50 pointer-events-none" : ""}`}>
                {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FileUp className="h-3.5 w-3.5" />}
                {uploading ? "Uploading…" : "Choose file & upload"}
                <input
                  type="file"
                  className="hidden"
                  accept="application/pdf,image/*,.doc,.docx,.xls,.xlsx"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </div>
      )}

      <AlertDialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this document?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDelete?.storage_kind === "upload"
                ? "The file will be permanently deleted from private storage."
                : "The link will be removed from this client. The original file at the URL is not affected."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
