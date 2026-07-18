import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link, useNavigate } from "react-router-dom";
import { z } from "zod";
import { Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const schema = z.object({
  full_name: z.string().trim().min(2, "Please enter your full name").max(120),
  email: z.string().trim().email("Enter a valid email").max(255),
  occupation: z.string().trim().max(200).optional().or(z.literal("")),
  collecting_interests: z.string().trim().max(1000).optional().or(z.literal("")),
  reference_notes: z.string().trim().max(1000).optional().or(z.literal("")),
});

const CollectorSignup = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [status, setStatus] = useState<"idle" | "submitting" | "existing" | "submitted">("idle");
  const [existingStatus, setExistingStatus] = useState<string | null>(null);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    occupation: "",
    collecting_interests: "",
    reference_notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!user) return;
    setForm((f) => ({ ...f, email: f.email || user.email || "" }));
    supabase
      .from("collector_applications")
      .select("status")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setStatus("existing");
          setExistingStatus(data.status);
        }
      });
  }, [user]);

  const onChange = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      navigate(`/trade/login?next=${encodeURIComponent("/collector-signup")}`);
      return;
    }
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      const fieldErrs: Record<string, string> = {};
      parsed.error.errors.forEach((er) => {
        if (er.path[0]) fieldErrs[String(er.path[0])] = er.message;
      });
      setErrors(fieldErrs);
      return;
    }
    setErrors({});
    setStatus("submitting");
    const { error } = await supabase.from("collector_applications").insert({
      user_id: user.id,
      full_name: parsed.data.full_name,
      email: parsed.data.email,
      occupation: parsed.data.occupation || null,
      collecting_interests: parsed.data.collecting_interests || null,
      reference_notes: parsed.data.reference_notes || null,
    });
    if (error) {
      setStatus("idle");
      toast({ title: "Submission failed", description: error.message, variant: "destructive" });
      return;
    }
    setStatus("submitted");
    toast({ title: "Application received", description: "Our team will review and be in touch." });
  };

  return (
    <>
      <Helmet>
        <title>Private Collector Access — Maison Affluency</title>
        <meta
          name="description"
          content="Request Private Collector access to view full pricing and provenance on Maison Affluency's curated masterpieces."
        />
        <meta name="robots" content="noindex,nofollow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-6 py-16">
          <div className="mb-8">
            <div className="inline-flex items-center gap-1.5 mb-4 px-2.5 py-1 rounded-full border border-primary/20 bg-primary/5">
              <ShieldCheck className="h-3 w-3 text-primary" />
              <span className="font-body text-[10px] uppercase tracking-[0.12em] text-primary">By Application</span>
            </div>
            <h1 className="font-display text-3xl md:text-4xl text-foreground mb-3">Private Collector Access</h1>
            <p className="font-body text-sm text-muted-foreground leading-relaxed">
              A discreet, application-only tier for private collectors. Approved members gain access to full pricing,
              historical provenance, and certificates of authenticity across our represented ateliers and masterpiece
              editions. Applications are reviewed by our curatorial team.
            </p>
          </div>

          {!user && !authLoading && (
            <div className="mb-6 p-4 border border-border rounded-md bg-muted/30 flex items-start gap-3">
              <Lock className="h-4 w-4 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-body text-sm text-foreground mb-2">
                  Please sign in or create an account first, then complete this short application.
                </p>
                <Link
                  to={`/trade/login?next=${encodeURIComponent("/collector-signup")}`}
                  className="inline-flex items-center px-3 py-1.5 rounded-md bg-foreground text-background font-body text-[11px] uppercase tracking-[0.12em] hover:bg-foreground/90"
                >
                  Sign In / Create Account
                </Link>
              </div>
            </div>
          )}

          {status === "existing" && (
            <div className="p-4 border border-primary/20 rounded-md bg-primary/5">
              <p className="font-body text-sm text-foreground">
                {existingStatus === "approved"
                  ? "Your Private Collector access is approved. Full pricing and provenance are now unlocked across the site."
                  : existingStatus === "rejected"
                  ? "Your previous application was not approved at this time. Please contact concierge@maisonaffluency.com to discuss."
                  : "Your application is under review. Our curatorial team will be in touch shortly."}
              </p>
            </div>
          )}

          {status === "submitted" && (
            <div className="p-4 border border-primary/20 rounded-md bg-primary/5">
              <p className="font-body text-sm text-foreground">
                Thank you — your application has been received. Our team will review and reply within 2 business days.
              </p>
            </div>
          )}

          {user && status !== "existing" && status !== "submitted" && (
            <form onSubmit={submit} className="space-y-4">
              <Field
                label="Full name"
                value={form.full_name}
                onChange={onChange("full_name")}
                error={errors.full_name}
                required
              />
              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={onChange("email")}
                error={errors.email}
                required
              />
              <Field
                label="Occupation (optional)"
                value={form.occupation}
                onChange={onChange("occupation")}
                error={errors.occupation}
              />
              <TextArea
                label="Collecting interests (optional)"
                placeholder="E.g. mid-century French decorative arts, contemporary sculpture, limited editions…"
                value={form.collecting_interests}
                onChange={onChange("collecting_interests")}
                error={errors.collecting_interests}
              />
              <TextArea
                label="Reference (optional)"
                placeholder="Gallery, advisor, designer, or auction house who can vouch for you."
                value={form.reference_notes}
                onChange={onChange("reference_notes")}
                error={errors.reference_notes}
              />

              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full mt-2 px-5 py-3.5 rounded-md bg-foreground text-background font-body text-xs uppercase tracking-[0.12em] hover:bg-foreground/90 disabled:opacity-60"
              >
                {status === "submitting" ? "Submitting…" : "Submit Application"}
              </button>

              <p className="font-body text-[11px] text-muted-foreground text-center leading-relaxed">
                Trade professional instead?{" "}
                <Link to="/trade/register" className="underline hover:text-foreground">
                  Apply to the Trade Program
                </Link>
                .
              </p>
            </form>
          )}
        </div>
      </div>
    </>
  );
};

const Field = ({
  label,
  error,
  ...rest
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) => (
  <label className="block">
    <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <input
      {...rest}
      className="mt-1 w-full px-3 py-2.5 rounded-md border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:border-foreground/60"
    />
    {error && <span className="font-body text-[11px] text-destructive mt-1 block">{error}</span>}
  </label>
);

const TextArea = ({
  label,
  error,
  ...rest
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string; error?: string }) => (
  <label className="block">
    <span className="font-body text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
    <textarea
      rows={3}
      {...rest}
      className="mt-1 w-full px-3 py-2.5 rounded-md border border-border bg-background font-body text-sm text-foreground focus:outline-none focus:border-foreground/60 resize-none"
    />
    {error && <span className="font-body text-[11px] text-destructive mt-1 block">{error}</span>}
  </label>
);

export default CollectorSignup;
