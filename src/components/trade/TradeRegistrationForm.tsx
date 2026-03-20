import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";

const COUNTRIES = [
  "Singapore", "Australia", "Canada", "China", "France", "Germany", "Hong Kong",
  "India", "Indonesia", "Italy", "Japan", "Malaysia", "Netherlands", "New Zealand",
  "Philippines", "South Korea", "Spain", "Switzerland", "Taiwan", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam", "Other"
];

const tradeRegisterSchema = z.object({
  email: z.string().trim().email("Please enter a valid email address").max(255, "Email is too long"),
  password: z.string().min(8, "Password must be at least 8 characters").max(128, "Password is too long"),
  confirmPassword: z.string(),
  firstName: z.string().trim().min(1, "First name is required").max(100, "First name is too long"),
  lastName: z.string().trim().min(1, "Last name is required").max(100, "Last name is too long"),
  phone: z.string().trim().min(1, "Phone number is required").max(30, "Phone number is too long")
    .regex(/^[+\d\s()-]+$/, "Please enter a valid phone number"),
  companyName: z.string().trim().min(1, "Company name is required").max(200, "Company name is too long"),
  companyWebsite: z.string().trim().max(500, "URL is too long")
    .refine(v => !v || /^https?:\/\/.+/.test(v), "Please enter a valid URL starting with http:// or https://")
    .optional().or(z.literal("")),
  jobTitle: z.string().trim().min(1, "Job title is required").max(150, "Job title is too long"),
  country: z.string().min(1),
  city: z.string().trim().max(100, "City name is too long").optional().or(z.literal("")),
  isCertified: z.boolean(),
  certificationDetails: z.string().trim().max(300, "Certification details are too long").optional().or(z.literal("")),
  message: z.string().trim().max(2000, "Message is too long").optional().or(z.literal("")),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type FieldErrors = Partial<Record<string, string>>;

interface TradeRegistrationFormProps {
  prefillEmail?: string;
}

const TradeRegistrationForm = ({ prefillEmail = "" }: TradeRegistrationFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({
    email: prefillEmail,
    password: "",
    confirmPassword: "",
    firstName: "",
    lastName: "",
    phone: "",
    companyName: "",
    companyWebsite: "",
    jobTitle: "",
    country: "Singapore",
    city: "",
    isCertified: false,
    certificationDetails: "",
    message: "",
  });

  useEffect(() => {
    if (prefillEmail && !form.email) {
      setForm((prev) => ({ ...prev, email: prefillEmail }));
    }
  }, [prefillEmail]);

  const update = (field: string, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = tradeRegisterSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: FieldErrors = {};
      result.error.errors.forEach((err) => {
        const key = err.path[0] as string;
        if (!fieldErrors[key]) fieldErrors[key] = err.message;
      });
      setErrors(fieldErrors);
      toast({ title: "Please fix the errors below", variant: "destructive" });
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: window.location.origin + "/trade" },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");

      await supabase.from("profiles").update({
        first_name: form.firstName,
        last_name: form.lastName,
        company: form.companyName,
        phone: form.phone,
      }).eq("id", authData.user.id);

      await supabase.from("trade_applications").insert({
        user_id: authData.user.id,
        company_name: form.companyName,
        company_website: form.companyWebsite || null,
        job_title: form.jobTitle,
        country: form.country,
        city: form.city,
        is_certified_professional: form.isCertified,
        certification_details: form.certificationDetails || null,
        message: form.message || null,
      });

      const fullName = `${form.firstName} ${form.lastName}`.trim();
      const emailBody = [
        `Company: ${form.companyName}`,
        form.companyWebsite ? `Website: ${form.companyWebsite}` : null,
        `Role: ${form.jobTitle}`,
        `Location: ${form.city ? `${form.city}, ` : ""}${form.country}`,
        `Certified Professional: ${form.isCertified ? "Yes" : "No"}`,
        form.certificationDetails ? `Certification: ${form.certificationDetails}` : null,
        form.message ? `\nMessage:\n${form.message}` : null,
      ].filter(Boolean).join("\n");

      supabase.functions.invoke("send-inquiry", {
        body: {
          name: fullName,
          firm: form.companyName,
          email: form.email,
          phone: form.phone,
          message: emailBody,
          subject: `New Trade Application: ${fullName} — ${form.companyName}`,
        },
      }).catch((err) => console.error("Email notification failed:", err));

      toast({
        title: "Application Submitted",
        description: "Please check your email to verify your account. We'll review your application within 1-2 business days.",
      });

      navigate("/trade/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fieldClass = (field: string) =>
    `w-full mt-1 pb-2 border-b bg-transparent font-body text-sm text-foreground outline-none transition-colors text-[16px] ${
      errors[field] ? "border-destructive" : "border-border focus:border-foreground"
    }`;

  const FieldError = ({ field }: { field: string }) =>
    errors[field] ? <p className="text-destructive text-xs font-body mt-1">{errors[field]}</p> : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      {/* Account Details */}
      <div>
        <h3 className="font-display text-base text-foreground mb-3">Account Details</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-body text-sm text-foreground">Email<span className="text-destructive">*</span></label>
            <input type="email" value={form.email} onChange={(e) => update("email", e.target.value)}
              autoComplete="off" className={fieldClass("email")} />
            <FieldError field="email" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Password<span className="text-destructive">*</span></label>
            <input type="password" value={form.password} onChange={(e) => update("password", e.target.value)}
              className={fieldClass("password")} />
            <FieldError field="password" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Confirm Password<span className="text-destructive">*</span></label>
            <input type="password" value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)}
              className={fieldClass("confirmPassword")} />
            <FieldError field="confirmPassword" />
          </div>
        </div>
      </div>

      {/* Personal Info */}
      <div>
        <h3 className="font-display text-base text-foreground mb-3">Personal Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-body text-sm text-foreground">First Name<span className="text-destructive">*</span></label>
            <input type="text" value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
              className={fieldClass("firstName")} />
            <FieldError field="firstName" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Last Name<span className="text-destructive">*</span></label>
            <input type="text" value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
              className={fieldClass("lastName")} />
            <FieldError field="lastName" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Phone<span className="text-destructive">*</span></label>
            <input type="tel" value={form.phone} onChange={(e) => update("phone", e.target.value)}
              className={fieldClass("phone")} />
            <FieldError field="phone" />
          </div>
        </div>
      </div>

      {/* Company Info */}
      <div>
        <h3 className="font-display text-base text-foreground mb-3">Company Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="font-body text-sm text-foreground">Company Name<span className="text-destructive">*</span></label>
            <input type="text" value={form.companyName} onChange={(e) => update("companyName", e.target.value)}
              className={fieldClass("companyName")} />
            <FieldError field="companyName" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Company Website</label>
            <input type="url" value={form.companyWebsite} onChange={(e) => update("companyWebsite", e.target.value)}
              className={fieldClass("companyWebsite")} />
            <FieldError field="companyWebsite" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Job Title<span className="text-destructive">*</span></label>
            <input type="text" value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)}
              className={fieldClass("jobTitle")} />
            <FieldError field="jobTitle" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Country</label>
            <select value={form.country} onChange={(e) => update("country", e.target.value)}
              className={`${fieldClass("country")} appearance-none`}>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="font-body text-sm text-foreground">City</label>
            <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
              className={fieldClass("city")} />
            <FieldError field="city" />
          </div>
        </div>
      </div>

      {/* Professional Certification */}
      <div>
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input type="checkbox" checked={form.isCertified} onChange={(e) => update("isCertified", e.target.checked)}
            className="mt-0.5 w-4 h-4 accent-foreground" />
          <span className="font-body text-sm text-foreground">
            I am a certified architect, interior designer, or trade professional
          </span>
        </label>
        {form.isCertified && (
          <>
            <input type="text" placeholder="Certification details (e.g. BCA, SIA, SIDS)"
              value={form.certificationDetails} onChange={(e) => update("certificationDetails", e.target.value)}
              className={`${fieldClass("certificationDetails")} mt-3`} />
            <FieldError field="certificationDetails" />
          </>
        )}
      </div>

      {/* Message */}
      <div>
        <label className="font-body text-sm text-foreground">Tell us about your practice or current project</label>
        <textarea value={form.message} onChange={(e) => update("message", e.target.value)} rows={3}
          className={`${fieldClass("message")} resize-y`} />
        <FieldError field="message" />
      </div>

      <button type="submit" disabled={loading}
        className="w-full py-3 bg-[hsl(var(--gold))] text-white font-body text-sm uppercase tracking-[0.2em] rounded-full hover:bg-[hsl(var(--gold)/0.9)] transition-all disabled:opacity-50 font-bold">
        {loading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
};

export default TradeRegistrationForm;
