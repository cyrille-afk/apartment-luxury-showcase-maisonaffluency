import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, ShieldCheck, Clock, AlertTriangle, Upload, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface AppRow {
  id: string;
  status: string;
  verification_notes: string | null;
  ai_confidence: number | null;
  ai_verified_at: string | null;
  tax_exempt_status: boolean;
  credential_document_path: string | null;
  company_name: string;
}

/**
 * Real-time trade credential status tracker for the member dashboard.
 * Moves through "Verifying credentials…" → "Trade Account Activated"
 * (or a manual-review state) as the AI verification edge function writes back.
 */
export default function TradeVerificationTracker() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [app, setApp] = useState<AppRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const pollRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("trade_applications")
      .select("id, status, verification_notes, ai_confidence, ai_verified_at, tax_exempt_status, credential_document_path, company_name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    setApp((data as AppRow | null) ?? null);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Poll while a verdict is still pending so the tracker updates live.
  useEffect(() => {
    const pending = app && app.status === "pending" && !app.ai_verified_at;
    if (!pending) {
      if (pollRef.current) window.clearInterval(pollRef.current);
      return;
    }
    pollRef.current = window.setInterval(load, 6000);
    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
  }, [app, load]);

  const uploadCredential = async (file: File) => {
    if (!user?.id || !app) return;
    if (file.size > 15 * 1024 * 1024) {
      toast({ title: "File too large", description: "Maximum 15 MB.", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
      const path = `${user.id}/credential-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("trade-credentials")
        .upload(path, file, { contentType: file.type || undefined, upsert: true });
      if (error) throw error;
      await supabase.from("trade_applications").update({ credential_document_path: path }).eq("id", app.id);
      await supabase.functions.invoke("verify-trade-application", { body: { application_id: app.id } });
      toast({ title: "Credentials received", description: "We're verifying your document now." });
      load();
    } catch (err: any) {
      toast({ title: "Upload failed", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  if (loading || !app) return null;

  const verifying = app.status === "pending";
  const approved = app.status === "approved";
  const flagged = app.status === "flagged";
  const rejected = app.status === "rejected";

  const tone = approved
    ? "border-success/40 bg-success/5"
    : flagged
    ? "border-warning/40 bg-warning/5"
    : rejected
    ? "border-destructive/40 bg-destructive/5"
    : "border-border bg-muted/30";

  return (
    <div className={`mb-6 rounded-lg border px-5 py-4 ${tone}`}>
      <div className="flex items-start gap-3">
        {verifying && <Loader2 className="h-4 w-4 mt-0.5 animate-spin text-muted-foreground" />}
        {approved && <ShieldCheck className="h-4 w-4 mt-0.5 text-success" />}
        {flagged && <Clock className="h-4 w-4 mt-0.5 text-warning" />}
        {rejected && <AlertTriangle className="h-4 w-4 mt-0.5 text-destructive" />}
        <div className="min-w-0 flex-1">
          <p className="font-body text-sm text-foreground">
            {verifying && "Verifying credentials…"}
            {approved && "Trade Account Activated"}
            {flagged && "Under manual review"}
            {rejected && "Application not approved"}
          </p>
          <p className="font-body text-xs text-muted-foreground mt-1 leading-relaxed">
            {verifying &&
              `We're checking ${app.company_name}'s website and credentials. This usually takes under a minute.`}
            {approved && (
              <>
                Trade pricing is unlocked across the catalogue
                {app.tax_exempt_status ? " and your account is marked tax-exempt." : "."}
              </>
            )}
            {flagged &&
              (app.verification_notes ||
                "Your credentials need a quick human look. Our team will confirm within 1–2 business days.")}
            {rejected && (app.verification_notes || "Please contact us if you believe this is an error.")}
          </p>

          {/* Progress rail */}
          <div className="mt-3 flex items-center gap-2" aria-hidden>
            {["Submitted", "Verifying", approved ? "Activated" : "Decision"].map((step, i) => {
              const reached = i === 0 || (i === 1 && (verifying || approved || flagged || rejected)) || (i === 2 && !verifying);
              return (
                <div key={step} className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-body text-[10px] uppercase tracking-wider border ${
                      reached ? "border-foreground/30 text-foreground" : "border-border text-muted-foreground/60"
                    }`}
                  >
                    {reached && i === 2 && approved && <CheckCircle2 className="h-3 w-3 text-success" />}
                    {step}
                  </span>
                  {i < 2 && <span className="h-px w-4 bg-border" />}
                </div>
              );
            })}
          </div>

          {(flagged || (!app.credential_document_path && !approved)) && (
            <div className="mt-3">
              <label
                htmlFor="tracker-credential-upload"
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border font-body text-[11px] uppercase tracking-[0.1em] text-foreground cursor-pointer hover:border-foreground/40 transition-colors"
              >
                {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />}
                {app.credential_document_path ? "Replace credentials" : "Upload credentials"}
              </label>
              <input
                id="tracker-credential-upload"
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) uploadCredential(f);
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
