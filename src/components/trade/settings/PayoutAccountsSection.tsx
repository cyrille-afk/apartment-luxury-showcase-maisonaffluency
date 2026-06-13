import { useEffect, useState, useCallback, useMemo } from "react";
import { Banknote, CheckCircle2, AlertTriangle, Plus, Trash2, ExternalLink, Loader2, Star, FileText, Upload } from "lucide-react";
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
import { useSearchParams } from "react-router-dom";

type PayoutAccount = {
  id: string;
  studio_id: string;
  label: string;
  account_holder_name: string;
  country_code: string;
  currency: string;
  is_default: boolean;
  iban: string | null;
  ach_routing_number: string | null;
  ach_account_number: string | null;
  swift_bic: string | null;
  bank_name: string | null;
  stripe_connect_account_id: string | null;
  stripe_connect_status: string;
  tax_form_kind: string | null;
  tax_form_reference: string | null;
  tax_form_document_path: string | null;
};

const STATUS_META: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; tone: string }> = {
  not_started: { label: "Not connected", variant: "outline", tone: "text-muted-foreground" },
  pending:     { label: "Pending verification", variant: "secondary", tone: "text-amber-700" },
  restricted:  { label: "Action required", variant: "destructive", tone: "text-destructive" },
  active:      { label: "Active", variant: "default", tone: "text-emerald-700" },
};

const COUNTRY_OPTIONS: { code: string; label: string; currency: string }[] = [
  { code: "US", label: "United States", currency: "USD" },
  { code: "GB", label: "United Kingdom", currency: "GBP" },
  { code: "FR", label: "France", currency: "EUR" },
  { code: "DE", label: "Germany", currency: "EUR" },
  { code: "IT", label: "Italy", currency: "EUR" },
  { code: "ES", label: "Spain", currency: "EUR" },
  { code: "NL", label: "Netherlands", currency: "EUR" },
  { code: "BE", label: "Belgium", currency: "EUR" },
  { code: "IE", label: "Ireland", currency: "EUR" },
  { code: "CH", label: "Switzerland", currency: "CHF" },
  { code: "NO", label: "Norway", currency: "NOK" },
  { code: "SE", label: "Sweden", currency: "SEK" },
  { code: "DK", label: "Denmark", currency: "DKK" },
  { code: "CA", label: "Canada", currency: "CAD" },
  { code: "MX", label: "Mexico", currency: "MXN" },
  { code: "AE", label: "United Arab Emirates", currency: "AED" },
  { code: "SA", label: "Saudi Arabia", currency: "SAR" },
  { code: "SG", label: "Singapore", currency: "SGD" },
  { code: "HK", label: "Hong Kong", currency: "HKD" },
  { code: "JP", label: "Japan", currency: "JPY" },
  { code: "AU", label: "Australia", currency: "AUD" },
];

// Tax form catalog — drives the dropdown and the per-country default.
const TAX_FORM_OPTIONS: { value: string; label: string; refLabel: string; refPlaceholder: string }[] = [
  { value: "W9",      label: "W-9 (US person / entity)",                    refLabel: "EIN or SSN",        refPlaceholder: "12-3456789" },
  { value: "W8BEN",   label: "W-8BEN (Non-US individual)",                  refLabel: "Foreign tax ID",    refPlaceholder: "Tax ID" },
  { value: "W8BENE",  label: "W-8BEN-E (Non-US entity)",                    refLabel: "Foreign tax ID",    refPlaceholder: "Tax ID" },
  { value: "VAT_ID",  label: "EU / UK VAT registration",                    refLabel: "VAT number",        refPlaceholder: "GB123456789" },
  { value: "TAX_ID",  label: "Other tax / business registration",           refLabel: "Tax / company ID",  refPlaceholder: "Tax ID" },
  { value: "NONE",    label: "Not registered (small business / exempt)",    refLabel: "Note",              refPlaceholder: "Optional note" },
];

function defaultTaxKindForCountry(code: string): string {
  if (code === "US") return "W9";
  if (code === "CA" || code === "MX") return "W8BENE";
  if (["GB","FR","DE","IT","ES","NL","BE","IE","CH","NO","SE","DK"].includes(code)) return "VAT_ID";
  return "TAX_ID";
}

export default function PayoutAccountsSection() {
  const { user } = useAuth();
  const { currentStudio, isAdmin } = useStudio();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [accounts, setAccounts] = useState<PayoutAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [taxDocBusyId, setTaxDocBusyId] = useState<string | null>(null);

  const [form, setForm] = useState({
    label: "Primary payout",
    account_holder_name: "",
    country_code: "US",
    currency: "USD",
    iban: "",
    ach_routing_number: "",
    ach_account_number: "",
    swift_bic: "",
    bank_name: "",
    tax_form_kind: "W9",
    tax_form_reference: "",
    tax_form_file: null as File | null,
  });

  const selectedTaxOption = useMemo(
    () => TAX_FORM_OPTIONS.find((o) => o.value === form.tax_form_kind) ?? TAX_FORM_OPTIONS[0],
    [form.tax_form_kind],
  );

  const fetchAccounts = useCallback(async () => {
    if (!currentStudio) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("studio_payout_accounts")
      .select("*")
      .eq("studio_id", currentStudio.id)
      .order("is_default", { ascending: false })
      .order("created_at");
    if (!error && data) setAccounts(data as PayoutAccount[]);
    setLoading(false);
  }, [currentStudio]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  // Auto-refresh Connect status when returning from Stripe onboarding
  useEffect(() => {
    const flag = params.get("stripe_connect");
    const acct = params.get("account");
    if (!flag || !acct) return;
    (async () => {
      try {
        await supabase.functions.invoke("stripe-connect-status", { body: { account_id: acct } });
        toast({ title: "Status refreshed", description: "Stripe Connect status updated." });
      } catch (e) {
        // swallow
      } finally {
        const next = new URLSearchParams(params);
        next.delete("stripe_connect");
        next.delete("account");
        setParams(next, { replace: true });
        fetchAccounts();
      }
    })();
  }, [params, setParams, fetchAccounts, toast]);

  const handleCreate = async () => {
    if (!currentStudio || !user || !form.account_holder_name.trim()) return;
    setCreating(true);
    try {
      let taxDocPath: string | null = null;
      if (form.tax_form_file) {
        const ext = form.tax_form_file.name.split(".").pop() || "pdf";
        taxDocPath = `${currentStudio.id}/tax-forms/${form.tax_form_kind}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("client-documents")
          .upload(taxDocPath, form.tax_form_file, { contentType: form.tax_form_file.type, upsert: false });
        if (upErr) throw upErr;
      }

      const { error } = await supabase.from("studio_payout_accounts").insert({
        studio_id: currentStudio.id,
        created_by: user.id,
        label: form.label.trim() || "Primary payout",
        account_holder_name: form.account_holder_name.trim(),
        country_code: form.country_code,
        currency: form.currency,
        iban: form.iban.trim() || null,
        ach_routing_number: form.ach_routing_number.trim() || null,
        ach_account_number: form.ach_account_number.trim() || null,
        swift_bic: form.swift_bic.trim() || null,
        bank_name: form.bank_name.trim() || null,
        tax_form_kind: form.tax_form_kind === "NONE" ? null : form.tax_form_kind,
        tax_form_reference: form.tax_form_reference.trim() || null,
        tax_form_document_path: taxDocPath,
        is_default: accounts.length === 0,
      });
      if (error) throw error;

      setCreateOpen(false);
      setForm({
        ...form,
        account_holder_name: "", iban: "", ach_routing_number: "",
        ach_account_number: "", swift_bic: "", bank_name: "",
        tax_form_reference: "", tax_form_file: null,
      });
      fetchAccounts();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Could not save", description: msg, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const handleViewTaxDoc = async (account: PayoutAccount) => {
    if (!account.tax_form_document_path) return;
    setTaxDocBusyId(account.id);
    try {
      const { data, error } = await supabase.storage
        .from("client-documents")
        .createSignedUrl(account.tax_form_document_path, 60);
      if (error || !data?.signedUrl) throw error ?? new Error("No URL");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Could not open document", description: msg, variant: "destructive" });
    } finally {
      setTaxDocBusyId(null);
    }
  };

  const handleConnect = async (accountId: string) => {
    setBusyId(accountId);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-connect-onboard", {
        body: { account_id: accountId, return_path: "/trade/studio-settings" },
      });
      if (error) throw error;
      const url = (data as { url?: string })?.url;
      if (!url) throw new Error("No onboarding URL returned");
      window.location.href = url;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Stripe connect failed", description: msg, variant: "destructive" });
      setBusyId(null);
    }
  };

  const handleSetDefault = async (id: string) => {
    if (!currentStudio) return;
    await supabase.from("studio_payout_accounts").update({ is_default: false }).eq("studio_id", currentStudio.id);
    const { error } = await supabase.from("studio_payout_accounts").update({ is_default: true }).eq("id", id);
    if (error) {
      toast({ title: "Could not set default", description: error.message, variant: "destructive" });
      return;
    }
    fetchAccounts();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this payout account? Any pending payouts will need to be re-routed.")) return;
    const { error } = await supabase.from("studio_payout_accounts").delete().eq("id", id);
    if (error) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
      return;
    }
    fetchAccounts();
  };

  if (!currentStudio) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Banknote className="h-5 w-5" /> Payout accounts
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Where agent-mode commissions are wired after delivery. Stripe Connect handles bank verification and KYC. Commissions in a different currency are auto-converted at the ECB daily rate (frankfurter.app) and locked on the delivery date — the wired amount is final.
          </p>
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Add account
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : accounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No payout accounts yet. Add one to receive commissions from end-client-billed orders.
          </p>
        ) : (
          <div className="divide-y">
            {accounts.map((a) => {
              const meta = STATUS_META[a.stripe_connect_status] ?? STATUS_META.not_started;
              return (
                <div key={a.id} className="py-3 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2 flex-wrap">
                      {a.label}
                      {a.is_default && <Badge variant="secondary" className="gap-1"><Star className="h-3 w-3" /> Default</Badge>}
                      <Badge variant={meta.variant} className="capitalize">{meta.label}</Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {a.account_holder_name} • {a.country_code} • {a.currency}
                      {a.bank_name && <> • {a.bank_name}</>}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2 flex-wrap text-xs">
                      {a.tax_form_kind ? (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <FileText className="h-3 w-3" />
                          {a.tax_form_kind.replace("_", " ")}
                          {a.tax_form_reference ? ` • ${a.tax_form_reference}` : ""}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="gap-1 font-normal text-amber-700">
                          <AlertTriangle className="h-3 w-3" /> Tax form missing
                        </Badge>
                      )}
                      {a.tax_form_document_path && (
                        <button
                          onClick={() => handleViewTaxDoc(a)}
                          disabled={taxDocBusyId === a.id}
                          className="text-muted-foreground hover:text-foreground underline underline-offset-2"
                        >
                          {taxDocBusyId === a.id ? "Opening…" : "View document"}
                        </button>
                      )}
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1 shrink-0">
                      {a.stripe_connect_status !== "active" && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === a.id}
                          onClick={() => handleConnect(a.id)}
                        >
                          {busyId === a.id ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : a.stripe_connect_status === "restricted" ? (
                            <AlertTriangle className="h-4 w-4 mr-2" />
                          ) : (
                            <ExternalLink className="h-4 w-4 mr-2" />
                          )}
                          {a.stripe_connect_account_id ? "Resume Stripe" : "Connect Stripe"}
                        </Button>
                      )}
                      {a.stripe_connect_status === "active" && (
                        <CheckCircle2 className="h-5 w-5 text-emerald-600 mr-2" aria-label="Active" />
                      )}
                      {!a.is_default && (
                        <Button size="sm" variant="ghost" onClick={() => handleSetDefault(a.id)}>
                          Set default
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add payout account</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="po-label">Label</Label>
              <Input id="po-label" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div>
              <Label htmlFor="po-holder">Account holder (legal name)</Label>
              <Input id="po-holder" value={form.account_holder_name} onChange={(e) => setForm({ ...form, account_holder_name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Country</Label>
                <Select
                  value={form.country_code}
                  onValueChange={(v) => {
                    const c = COUNTRY_OPTIONS.find((c) => c.code === v);
                    setForm({
                      ...form,
                      country_code: v,
                      currency: c?.currency ?? form.currency,
                      tax_form_kind: defaultTaxKindForCountry(v),
                    });
                  }}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {COUNTRY_OPTIONS.map((c) => (
                      <SelectItem key={c.code} value={c.code}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="po-currency">Currency</Label>
                <Input id="po-currency" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} />
              </div>
            </div>
            <div>
              <Label htmlFor="po-bank">Bank name (optional)</Label>
              <Input id="po-bank" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
            </div>
            <p className="text-xs text-muted-foreground">
              Bank details are collected by Stripe directly during the next step — leave the fields below blank unless you want a backup reference.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="po-iban">IBAN</Label>
                <Input id="po-iban" value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="po-swift">SWIFT / BIC</Label>
                <Input id="po-swift" value={form.swift_bic} onChange={(e) => setForm({ ...form, swift_bic: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="po-routing">ACH routing</Label>
                <Input id="po-routing" value={form.ach_routing_number} onChange={(e) => setForm({ ...form, ach_routing_number: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="po-account">ACH account</Label>
                <Input id="po-account" value={form.ach_account_number} onChange={(e) => setForm({ ...form, ach_account_number: e.target.value })} />
              </div>
            </div>

            <div className="pt-4 mt-2 border-t space-y-3">
              <div>
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <FileText className="h-4 w-4" /> Tax form / VAT registration
                </Label>
                <p className="text-xs text-muted-foreground mt-1">
                  Required for US 1099 reporting and to display a correct VAT line on agent invoices. Stored privately and only accessible to your studio.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Form type</Label>
                  <Select
                    value={form.tax_form_kind}
                    onValueChange={(v) => setForm({ ...form, tax_form_kind: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TAX_FORM_OPTIONS.map((o) => (
                        <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="po-taxref">{selectedTaxOption.refLabel}</Label>
                  <Input
                    id="po-taxref"
                    placeholder={selectedTaxOption.refPlaceholder}
                    value={form.tax_form_reference}
                    onChange={(e) => setForm({ ...form, tax_form_reference: e.target.value })}
                  />
                </div>
              </div>
              {form.tax_form_kind !== "NONE" && (
                <div>
                  <Label htmlFor="po-taxfile" className="flex items-center gap-2 cursor-pointer">
                    <Upload className="h-4 w-4" /> Upload signed form (PDF, optional)
                  </Label>
                  <Input
                    id="po-taxfile"
                    type="file"
                    accept="application/pdf,image/*"
                    onChange={(e) => setForm({ ...form, tax_form_file: e.target.files?.[0] ?? null })}
                  />
                  {form.tax_form_file && (
                    <p className="text-xs text-muted-foreground mt-1">{form.tax_form_file.name}</p>
                  )}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !form.account_holder_name.trim()}>
              {creating ? "Saving…" : "Save & continue"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
