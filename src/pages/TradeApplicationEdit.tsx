import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Helmet } from "react-helmet-async";

interface AppData {
  company_name: string | null;
  company_website: string | null;
  job_title: string | null;
  city: string | null;
  country: string | null;
  is_certified_professional: boolean | null;
  certification_details: string | null;
  message: string | null;
  status: string;
}

const invoke = async (body: unknown) =>
  supabase.functions.invoke("trade-application-edit", { body });

const TradeApplicationEdit = () => {
  const { token = "" } = useParams();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorState, setErrorState] = useState<string | null>(null);
  const [data, setData] = useState<AppData | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const { data: res, error } = await invoke({ action: "get", token });
      if (!alive) return;
      if (error || (res as any)?.error) {
        setErrorState((res as any)?.error || error?.message || "invalid_token");
      } else {
        setData((res as any).application);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [token]);

  const patch = useMemo(() => data, [data]);

  const save = async () => {
    if (!patch) return;
    setSaving(true);
    const { data: res, error } = await invoke({ action: "update", token, patch });
    setSaving(false);
    if (error || (res as any)?.error) {
      toast({
        title: "Could not save",
        description: (res as any)?.error || error?.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }
    toast({
      title: "Thank you",
      description: "Your details have been sent to our team for review.",
    });
  };

  const set = <K extends keyof AppData>(k: K, v: AppData[K]) =>
    setData((d) => (d ? { ...d, [k]: v } : d));

  return (
    <>
      <Helmet>
        <title>Complete your trade application — Maison Affluency</title>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
      <div className="min-h-screen bg-background py-12 px-4">
        <div className="mx-auto max-w-2xl">
          <h1 className="font-display text-3xl mb-2">Complete your trade application</h1>
          <p className="font-body text-sm text-muted-foreground mb-8">
            Update the fields below so our team can finish verifying your trade access. No
            password or new application is needed — this link is tied to your original submission.
          </p>

          {loading && <p className="font-body text-sm text-muted-foreground">Loading…</p>}

          {!loading && errorState && (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 p-4 font-body text-sm">
              {errorState === "expired"
                ? "This link has expired. Please reply to the email we sent you and we'll issue a new one."
                : errorState === "already_reviewed"
                ? "Your application has already been reviewed. If you need to update anything, please contact concierge@myaffluency.com."
                : "This link is not valid. Please contact concierge@myaffluency.com."}
            </div>
          )}

          {!loading && !errorState && data && (
            <div className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="company_name">Company name</Label>
                <Input
                  id="company_name"
                  value={data.company_name || ""}
                  onChange={(e) => set("company_name", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="company_website">Company website or portfolio URL</Label>
                <Input
                  id="company_website"
                  placeholder="https://…"
                  value={data.company_website || ""}
                  onChange={(e) => set("company_website", e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="job_title">Job title</Label>
                <Input
                  id="job_title"
                  value={data.job_title || ""}
                  onChange={(e) => set("job_title", e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={data.city || ""}
                    onChange={(e) => set("city", e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={data.country || ""}
                    onChange={(e) => set("country", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Checkbox
                  id="cert"
                  checked={!!data.is_certified_professional}
                  onCheckedChange={(v) => set("is_certified_professional", !!v)}
                />
                <Label htmlFor="cert" className="font-body text-sm leading-snug">
                  I hold a professional certification (ASID, IIDA, RIBA, BIID, etc.)
                </Label>
              </div>
              {data.is_certified_professional && (
                <div className="grid gap-2">
                  <Label htmlFor="cert_details">Certification details</Label>
                  <Input
                    id="cert_details"
                    value={data.certification_details || ""}
                    onChange={(e) => set("certification_details", e.target.value)}
                  />
                </div>
              )}
              <div className="grid gap-2">
                <Label htmlFor="message">Anything else we should know?</Label>
                <Textarea
                  id="message"
                  rows={4}
                  value={data.message || ""}
                  onChange={(e) => set("message", e.target.value)}
                />
              </div>

              <div className="pt-2">
                <Button onClick={save} disabled={saving} className="font-body">
                  {saving ? "Saving…" : "Submit updates"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TradeApplicationEdit;
