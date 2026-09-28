import { useState } from "react";
import { z } from "zod";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const COUNTRIES = ["Singapore", "Hong Kong", "Malaysia", "Thailand", "Indonesia", "Vietnam", "United Arab Emirates", "Saudi Arabia", "Qatar", "United Kingdom", "France", "Other"];
const CONTACT = ["Email", "Phone", "WhatsApp"];
const SERVICES = ["Sourcing", "Swatches & Samples", "Specification & FF&E", "Bespoke", "Quotation", "Logistics & Installation"];

const schema = z.object({
  first_name: z.string().trim().min(1, "Required").max(100),
  last_name: z.string().trim().min(1, "Required").max(100),
  company_name: z.string().trim().min(1, "Required").max(200),
  phone: z.string().trim().min(3, "Required").max(40).regex(/^[+\d\s().-]+$/, "Invalid phone"),
  email: z.string().trim().email("Invalid email").max(255),
  postal_code: z.string().trim().min(1, "Required").max(20),
  country: z.string().min(1, "Required"),
  preferred_contact: z.enum(["Email", "Phone", "WhatsApp"], { errorMap: () => ({ message: "Required" }) }),
  service_type: z.string().min(1, "Required"),
});
type Form = Record<keyof z.infer<typeof schema>, string>;
const empty: Form = { first_name: "", last_name: "", company_name: "", phone: "", email: "", postal_code: "", country: "", preferred_contact: "", service_type: "" };

const field = "h-14 w-full border border-border bg-background px-5 font-body text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-foreground transition-colors rounded-none";

export default function TradeServicesRequestModal({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const [form, setForm] = useState<Form>(empty);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [busy, setBusy] = useState(false);
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = schema.safeParse(form);
    if (!r.success) {
      const errs: Partial<Form> = {};
      r.error.issues.forEach((i) => { errs[i.path[0] as keyof Form] = i.message; });
      setErrors(errs);
      return;
    }
    setErrors({});
    setBusy(true);
    const { error } = await supabase.from("trade_service_requests").insert(r.data as any);
    setBusy(false);
    if (error) { toast.error("Could not send your request. Please try again."); return; }
    toast.success("Request received — our trade team will be in touch.");
    setForm(empty);
    onOpenChange(false);
  };

  const input = (k: keyof Form, label: string, type = "text") => (
    <div>
      <input type={type} aria-label={label} placeholder={`${label}*`} value={form[k]} onChange={set(k)} maxLength={255} className={field} />
      {errors[k] && <p className="mt-1 font-body text-xs text-destructive">{errors[k]}</p>}
    </div>
  );
  const select = (k: keyof Form, label: string, opts: string[]) => (
    <div>
      <select aria-label={label} value={form[k]} onChange={set(k)} className={`${field} appearance-none ${form[k] ? "" : "text-muted-foreground"}`}>
        <option value="" disabled>{label}*</option>
        {opts.map((o) => <option key={o} value={o} className="text-foreground">{o}</option>)}
      </select>
      {errors[k] && <p className="mt-1 font-body text-xs text-destructive">{errors[k]}</p>}
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-3xl sm:w-[calc(100%-2rem)] rounded-none border-none bg-background p-8 md:p-14 max-h-[92vh] overflow-y-auto">
        <DialogTitle className="font-display text-2xl md:text-4xl font-light uppercase tracking-[0.04em] text-foreground">
          Affluency Trade Services Request
        </DialogTitle>
        <DialogDescription className="mt-4 font-body text-sm md:text-base leading-relaxed text-muted-foreground">
          Affluency offers the product knowledge and design expertise to support your vision and leverage your business. From ideation to installation, swatches to specification, our team is here to service your creative and project management needs.
        </DialogDescription>
        <form onSubmit={submit} className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-x-10 md:gap-y-6" noValidate>
          {input("first_name", "First Name")}
          {input("last_name", "Last Name")}
          {input("company_name", "Company Name")}
          {input("phone", "Phone", "tel")}
          {input("email", "Email", "email")}
          {input("postal_code", "Business Postal Code")}
          {select("country", "Country", COUNTRIES)}
          {select("preferred_contact", "Preferred Method of Contact", CONTACT)}
          {select("service_type", "Type of Trade Service", SERVICES)}
          <button type="submit" disabled={busy} className="h-14 w-full bg-foreground font-body text-sm uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-90 disabled:opacity-60">
            {busy ? "Sending…" : "Submit Request"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
