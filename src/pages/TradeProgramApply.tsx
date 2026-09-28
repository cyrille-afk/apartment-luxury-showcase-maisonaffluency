import { FormEvent, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Secondary screen after the moodboard gate: collects company registration
 * and tax ID, then hands off to the full Trade Program application.
 * Nothing here grants access — unlock only follows admin verification.
 */
export default function TradeProgramApply() {
  const [params] = useSearchParams();
  const email = params.get("email") ?? "";
  const [company, setCompany] = useState("");
  const [country, setCountry] = useState("");
  const [registration, setRegistration] = useState("");
  const [taxId, setTaxId] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!e.currentTarget.reportValidity()) return;
    setBusy(true);
    sessionStorage.setItem("trade_apply_prefill", JSON.stringify({ email, company, country, registration, taxId }));
    window.location.assign(`/trade-program?apply=1&email=${encodeURIComponent(email)}`);
  };

  const field = "h-11 rounded-none border-moodboard-ink/20 bg-card text-moodboard-ink focus-visible:ring-moodboard-teal";

  return (
    <main className="min-h-screen bg-moodboard-cream px-5 py-16 text-moodboard-ink md:py-24">
      <Helmet>
        <title>Complete Your Trade Profile | Maison Affluency</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="mx-auto max-w-xl">
        <p className="font-body text-[11px] uppercase tracking-[0.2em] text-moodboard-teal">Trade verification / 02</p>
        <h1 className="mt-3 font-display text-4xl leading-tight md:text-5xl">Complete Your Professional Trade Profile</h1>
        <p className="mt-4 text-sm leading-relaxed text-moodboard-ink/60">
          Your request is <span className="text-moodboard-teal">pending verification</span>. Share your company registration details to finalise access to the full Maison Affluency sourcing index.
        </p>
        <form onSubmit={submit} className="mt-10 space-y-5 border-t-2 border-moodboard-teal bg-card p-6 shadow-elegant md:p-8">
          <div className="space-y-2"><Label htmlFor="ta-email">Professional email</Label><Input id="ta-email" value={email} readOnly className={`${field} opacity-70`} /></div>
          <div className="space-y-2"><Label htmlFor="ta-company">Registered company name</Label><Input id="ta-company" required maxLength={200} value={company} onChange={(e) => setCompany(e.target.value)} className={field} /></div>
          <div className="space-y-2"><Label htmlFor="ta-country">Country of registration</Label><Input id="ta-country" required maxLength={80} value={country} onChange={(e) => setCountry(e.target.value)} className={field} /></div>
          <div className="space-y-2"><Label htmlFor="ta-reg">Company registration number</Label><Input id="ta-reg" required maxLength={60} value={registration} onChange={(e) => setRegistration(e.target.value)} placeholder="e.g. UEN, SIREN, Companies House no." className={field} /></div>
          <div className="space-y-2"><Label htmlFor="ta-tax">Tax / VAT ID</Label><Input id="ta-tax" required maxLength={60} value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="e.g. GST, VAT, TRN, EIN" className={field} /></div>
          <Button type="submit" disabled={busy || !email} className="h-12 w-full rounded-none bg-moodboard-teal text-xs uppercase tracking-[0.18em] text-moodboard-teal-foreground hover:bg-moodboard-teal/90">
            {busy ? <Loader2 className="animate-spin" /> : <>Continue to verification <ArrowRight /></>}
          </Button>
          {!email && <p className="text-xs text-destructive">Start from the <Link to="/moodboard" className="underline">moodboard</Link> or the <Link to="/trade-program" className="underline">Trade Program</Link>.</p>}
          <p className="flex items-center gap-2 text-xs text-moodboard-ink/50"><ShieldCheck className="size-4 text-moodboard-teal" />Access is granted only after our team verifies your credentials.</p>
        </form>
      </div>
    </main>
  );
}
