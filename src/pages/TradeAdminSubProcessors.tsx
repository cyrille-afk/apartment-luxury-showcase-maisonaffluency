/**
 * Article 28 sub-processor register.
 *
 * Admin-only inventory of every external vendor that processes personal data
 * on our behalf, the state of its data-processing agreement, and the lawful
 * transfer mechanism relied upon. Reads and writes are gated by RLS
 * (`has_role`) on `sub_processor_registry`; the UI guard below is convenience,
 * not the control.
 */
import { useMemo, useRef, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Loader2,
  ShieldAlert,
  Trash2,
  UploadCloud,
} from "lucide-react";

const DPA_BUCKET = "compliance-agreements";
const MAX_DPA_BYTES = 10 * 1024 * 1024;

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(new Error("The file could not be read."));
    reader.readAsDataURL(file);
  });

type DpaStatus = "pending" | "signed" | "executed";

type Row = {
  id: string;
  vendor_name: string;
  service: string;
  purpose: string;
  data_categories: string;
  entity_country: string;
  hosting_regions: string | null;
  website: string | null;
  privacy_url: string | null;
  dpa_url: string | null;
  dpa_status: DpaStatus;
  dpa_reference: string | null;
  dpa_countersigned_at: string | null;
  transfer_mechanism: string | null;
  last_reviewed_at: string | null;
  notes: string | null;
  is_active: boolean;
  sort_order: number;
  signed_dpa_path: string | null;
  signed_dpa_filename: string | null;
  signed_dpa_sha256: string | null;
  signed_dpa_size_bytes: number | null;
  signed_dpa_uploaded_at: string | null;
};

const STATUS_LABEL: Record<DpaStatus, string> = {
  pending: "Pending",
  signed: "Signed",
  executed: "Executed",
};

const STATUS_STYLE: Record<DpaStatus, string> = {
  pending: "border-amber-500/40 text-amber-600",
  signed: "border-sky-500/40 text-sky-600",
  executed: "border-emerald-500/40 text-emerald-600",
};

const TRANSFER_MECHANISMS = [
  "EU-US Data Privacy Framework",
  "EU-US Data Privacy Framework + Standard Contractual Clauses",
  "Standard Contractual Clauses",
  "UK International Data Transfer Addendum",
  "Adequacy decision",
  "Processing within the EEA only",
];

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "—";

/** Annual review cadence: a register older than a year is treated as stale. */
const isStale = (iso: string | null) =>
  !iso || Date.now() - new Date(iso).getTime() > 365 * 86_400_000;

const TradeAdminSubProcessors = () => {
  const { user, isAdmin, loading } = useAuth();
  const queryClient = useQueryClient();
  const enabled = !!user && isAdmin;

  const [active, setActive] = useState<Row | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [downloading, setDownloading] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState({
    dpa_status: "pending" as DpaStatus,
    dpa_reference: "",
    dpa_countersigned_at: "",
    transfer_mechanism: "",
    dpa_url: "",
    notes: "",
  });

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["sub-processor-registry"],
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sub_processor_registry")
        .select(
          "id, vendor_name, service, purpose, data_categories, entity_country, hosting_regions, website, privacy_url, dpa_url, dpa_status, dpa_reference, dpa_countersigned_at, transfer_mechanism, last_reviewed_at, notes, is_active, sort_order, signed_dpa_path, signed_dpa_filename, signed_dpa_sha256, signed_dpa_size_bytes, signed_dpa_uploaded_at",
        )
        .order("sort_order", { ascending: true })
        .order("vendor_name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const summary = useMemo(() => {
    const live = rows.filter((r) => r.is_active);
    return {
      total: live.length,
      executed: live.filter((r) => r.dpa_status === "executed").length,
      outstanding: live.filter((r) => r.dpa_status !== "executed").length,
      stale: live.filter((r) => isStale(r.last_reviewed_at)).length,
    };
  }, [rows]);

  const openRow = (row: Row) => {
    setActive(row);
    setForm({
      dpa_status: row.dpa_status,
      dpa_reference: row.dpa_reference ?? "",
      dpa_countersigned_at: row.dpa_countersigned_at
        ? new Date(row.dpa_countersigned_at).toISOString().slice(0, 10)
        : "",
      transfer_mechanism: row.transfer_mechanism ?? "",
      dpa_url: row.dpa_url ?? "",
      notes: row.notes ?? "",
    });
  };

  /** Upload a counter-signed PDF: the edge function authenticates the bytes. */
  const uploadAgreement = async (file: File) => {
    if (!active) return;
    if (!file.name.toLowerCase().endsWith(".pdf") && file.type !== "application/pdf") {
      toast.error("Only PDF agreements are accepted.");
      return;
    }
    if (file.size > MAX_DPA_BYTES) {
      toast.error("The agreement exceeds the 10 MB limit.");
      return;
    }
    setUploading(true);
    try {
      const fileBase64 = await fileToBase64(file);
      const { data, error } = await supabase.functions.invoke("upload-compliance-dpa", {
        body: { vendorId: active.id, fileName: file.name, fileBase64 },
      });
      const failure = (data as { error?: string } | null)?.error;
      if (error || failure) throw new Error(failure || error?.message || "Upload failed.");
      const result = data as {
        path: string;
        sha256: string;
        sizeBytes: number;
        fileName: string;
      };
      setActive((prev) =>
        prev
          ? {
              ...prev,
              signed_dpa_path: result.path,
              signed_dpa_filename: result.fileName,
              signed_dpa_sha256: result.sha256,
              signed_dpa_size_bytes: result.sizeBytes,
              signed_dpa_uploaded_at: new Date().toISOString(),
            }
          : prev,
      );
      queryClient.invalidateQueries({ queryKey: ["sub-processor-registry"] });
      toast.success("Counter-signed agreement stored securely.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "The agreement could not be stored.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  /** Short-lived (15 minute) authenticated link — never a public URL. */
  const openAgreement = async (row: Row) => {
    if (!row.signed_dpa_path) return;
    setDownloading(row.id);
    const { data, error } = await supabase.storage
      .from(DPA_BUCKET)
      .createSignedUrl(row.signed_dpa_path, 900);
    setDownloading(null);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "The secure link could not be generated.");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  const removeAgreement = async () => {
    if (!active?.signed_dpa_path) return;
    setUploading(true);
    const path = active.signed_dpa_path;
    const { error: storageErr } = await supabase.storage.from(DPA_BUCKET).remove([path]);
    if (storageErr) {
      setUploading(false);
      toast.error(storageErr.message);
      return;
    }
    const { error } = await supabase
      .from("sub_processor_registry")
      .update({
        signed_dpa_path: null,
        signed_dpa_filename: null,
        signed_dpa_sha256: null,
        signed_dpa_size_bytes: null,
        signed_dpa_uploaded_at: null,
      })
      .eq("id", active.id);
    setUploading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setActive((prev) =>
      prev
        ? {
            ...prev,
            signed_dpa_path: null,
            signed_dpa_filename: null,
            signed_dpa_sha256: null,
            signed_dpa_size_bytes: null,
            signed_dpa_uploaded_at: null,
          }
        : prev,
    );
    queryClient.invalidateQueries({ queryKey: ["sub-processor-registry"] });
    toast.success("Agreement removed.");
  };

  const save = async () => {
    if (!active) return;
    // An executed agreement is meaningless without the counter-signature date
    // and the reference the legal desk can retrieve it by.
    if (form.dpa_status === "executed" && (!form.dpa_countersigned_at || !form.dpa_reference.trim())) {
      toast.error("An executed DPA needs both a counter-signature date and a confirmation reference.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("sub_processor_registry")
      .update({
        dpa_status: form.dpa_status,
        dpa_reference: form.dpa_reference.trim() || null,
        dpa_countersigned_at: form.dpa_countersigned_at
          ? new Date(`${form.dpa_countersigned_at}T00:00:00Z`).toISOString()
          : null,
        transfer_mechanism: form.transfer_mechanism.trim() || null,
        dpa_url: form.dpa_url.trim() || null,
        notes: form.notes.trim() || null,
        last_reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id ?? null,
      })
      .eq("id", active.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(`${active.vendor_name} compliance record updated.`);
    setActive(null);
    queryClient.invalidateQueries({ queryKey: ["sub-processor-registry"] });
  };

  if (loading) return <div className="p-10 text-sm text-muted-foreground">Loading…</div>;

  if (!enabled) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-10 text-center">
        <ShieldAlert className="h-8 w-8 text-destructive" />
        <h1 className="font-serif text-2xl">403 — Forbidden</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          The sub-processor register is restricted to internal administrators.
        </p>
        <Link to="/trade" className="text-sm underline underline-offset-4">
          Return to the Trade Portal
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Helmet>
        <title>Sub-processor Register — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>

      <Link
        to="/trade"
        className="mb-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Trade Portal
      </Link>

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground">
            Article 28 compliance
          </p>
          <h1 className="mt-2 font-serif text-3xl">Sub-processor register</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
            Every external vendor processing personal data on our behalf, the state of its data
            processing agreement, and the mechanism under which data may leave the EEA.
          </p>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/compliance/dpa-template">
            <FileText className="mr-2 h-4 w-4" /> Baseline DPA template
          </Link>
        </Button>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-sm border border-border bg-border sm:grid-cols-4">
        {[
          { label: "Active sub-processors", value: summary.total },
          { label: "DPAs executed", value: summary.executed },
          { label: "Outstanding", value: summary.outstanding },
          { label: "Review overdue", value: summary.stale },
        ].map((stat) => (
          <div key={stat.label} className="bg-background p-5">
            <p className="font-serif text-3xl">{stat.value}</p>
            <p className="mt-1 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              {stat.label}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 overflow-x-auto rounded-sm border border-border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/40 text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
              <th className="px-5 py-4 font-normal">Vendor</th>
              <th className="px-5 py-4 font-normal">Purpose</th>
              <th className="px-5 py-4 font-normal">Location</th>
              <th className="px-5 py-4 font-normal">Transfer mechanism</th>
              <th className="px-5 py-4 font-normal">DPA</th>
              <th className="px-5 py-4 font-normal">Last reviewed</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  Loading register…
                </td>
              </tr>
            )}
            {!isLoading && rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">
                  No sub-processors recorded.
                </td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={row.id}
                onClick={() => openRow(row)}
                className="cursor-pointer border-b border-border/60 transition-colors last:border-0 hover:bg-muted/30"
              >
                <td className="px-5 py-4 align-top">
                  <p className="font-serif text-base">{row.vendor_name}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{row.service}</p>
                  {!row.is_active && (
                    <Badge variant="outline" className="mt-2 text-[0.6rem]">
                      Retired
                    </Badge>
                  )}
                </td>
                <td className="max-w-sm px-5 py-4 align-top text-xs text-muted-foreground">
                  {row.purpose}
                </td>
                <td className="px-5 py-4 align-top text-xs text-muted-foreground">
                  <p>{row.entity_country}</p>
                  {row.hosting_regions && <p className="mt-0.5">{row.hosting_regions}</p>}
                </td>
                <td className="px-5 py-4 align-top text-xs text-muted-foreground">
                  {row.transfer_mechanism || "—"}
                </td>
                <td className="px-5 py-4 align-top">
                  <Badge variant="outline" className={STATUS_STYLE[row.dpa_status]}>
                    {STATUS_LABEL[row.dpa_status]}
                  </Badge>
                  {row.dpa_reference && (
                    <p className="mt-1 text-[0.65rem] text-muted-foreground">{row.dpa_reference}</p>
                  )}
                  {row.signed_dpa_path && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-2 h-7 px-2 text-[0.65rem]"
                      disabled={downloading === row.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void openAgreement(row);
                      }}
                    >
                      {downloading === row.id ? (
                        <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                      ) : (
                        <Download className="mr-1.5 h-3 w-3" />
                      )}
                      Signed PDF
                    </Button>
                  )}
                </td>
                <td className="px-5 py-4 align-top text-xs">
                  <span className={isStale(row.last_reviewed_at) ? "text-destructive" : "text-muted-foreground"}>
                    {fmtDate(row.last_reviewed_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-muted-foreground">
        Records are reviewed annually. Selecting a vendor stamps the review date on save.
      </p>

      <Dialog open={!!active} onOpenChange={(open) => !open && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-serif text-xl">{active?.vendor_name}</DialogTitle>
            <DialogDescription>{active?.service}</DialogDescription>
          </DialogHeader>

          {active && (
            <div className="space-y-5">
              <div className="rounded-sm border border-border bg-muted/30 p-4 text-xs text-muted-foreground">
                <p>
                  <span className="text-foreground">Data processed: </span>
                  {active.data_categories}
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  {active.website && (
                    <a
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                      href={active.website}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Vendor <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  {active.privacy_url && (
                    <a
                      className="inline-flex items-center gap-1 underline underline-offset-4"
                      href={active.privacy_url}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      Privacy notice <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Agreement status</Label>
                <Select
                  value={form.dpa_status}
                  onValueChange={(v) => setForm((f) => ({ ...f, dpa_status: v as DpaStatus }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="signed">Signed</SelectItem>
                    <SelectItem value="executed">Executed (counter-signed)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="countersigned">Counter-signed on</Label>
                  <Input
                    id="countersigned"
                    type="date"
                    value={form.dpa_countersigned_at}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, dpa_countersigned_at: e.target.value }))
                    }
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reference">Confirmation reference</Label>
                  <Input
                    id="reference"
                    placeholder="e.g. DPA-STRIPE-2026-04"
                    value={form.dpa_reference}
                    onChange={(e) => setForm((f) => ({ ...f, dpa_reference: e.target.value }))}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Transfer mechanism</Label>
                <Select
                  value={form.transfer_mechanism || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, transfer_mechanism: v }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select the lawful transfer basis" />
                  </SelectTrigger>
                  <SelectContent>
                    {TRANSFER_MECHANISMS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Counter-signed agreement (PDF)</Label>
                {active.signed_dpa_path ? (
                  <div className="rounded-sm border border-border bg-muted/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm">
                          {active.signed_dpa_filename ?? "Signed agreement.pdf"}
                        </p>
                        <p className="mt-1 text-[0.65rem] text-muted-foreground">
                          Stored {fmtDate(active.signed_dpa_uploaded_at)}
                          {active.signed_dpa_size_bytes
                            ? ` · ${(active.signed_dpa_size_bytes / 1_048_576).toFixed(2)} MB`
                            : ""}
                        </p>
                        {active.signed_dpa_sha256 && (
                          <p className="mt-1 break-all font-mono text-[0.6rem] text-muted-foreground">
                            SHA-256 {active.signed_dpa_sha256}
                          </p>
                        )}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloading === active.id}
                          onClick={() => void openAgreement(active)}
                        >
                          {downloading === active.id ? (
                            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Download className="mr-2 h-3.5 w-3.5" />
                          )}
                          Open
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={uploading}
                          onClick={() => void removeAgreement()}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    <p className="mt-3 text-[0.65rem] text-muted-foreground">
                      Links expire after 15 minutes. The file is never publicly addressable.
                    </p>
                  </div>
                ) : (
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => !uploading && fileInputRef.current?.click()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragging(true);
                    }}
                    onDragLeave={() => setDragging(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setDragging(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) void uploadAgreement(file);
                    }}
                    className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border border-dashed p-8 text-center transition-colors ${
                      dragging ? "border-foreground bg-muted/50" : "border-border hover:bg-muted/30"
                    }`}
                  >
                    {uploading ? (
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    ) : (
                      <UploadCloud className="h-5 w-5 text-muted-foreground" />
                    )}
                    <p className="text-sm">
                      {uploading ? "Verifying and storing…" : "Drop the counter-signed PDF here"}
                    </p>
                    <p className="text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
                      PDF only · up to 10 MB
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,.pdf"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadAgreement(file);
                  }}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dpa-url">Executed agreement link (external)</Label>
                <Input
                  id="dpa-url"
                  placeholder="https://…"
                  value={form.dpa_url}
                  onChange={(e) => setForm((f) => ({ ...f, dpa_url: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Compliance notes</Label>
                <Textarea
                  id="notes"
                  rows={3}
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-xs text-muted-foreground">
                  Saving stamps today as the review date.
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => setActive(null)}>
                    Cancel
                  </Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Save record
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TradeAdminSubProcessors;
