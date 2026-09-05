import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import { Loader2, AlertCircle, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

import { getPhonePlaceholder } from "@/lib/phonePlaceholder";
import { trackForm } from "@/lib/analytics";

const COUNTRIES = [
  "Singapore", "Australia", "Canada", "China", "France", "Germany", "Hong Kong",
  "India", "Indonesia", "Italy", "Japan", "Malaysia", "Netherlands", "New Zealand",
  "Philippines", "South Korea", "Spain", "Switzerland", "Taiwan", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam", "Other"
];

// Per-country registry / tax-id format rules. Each returns an error string or null.
const CORPORATE_REG_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  // ACRA UEN: 8–9 digits + check letter (e.g. 200012345A) or newer TyyPQnnnnX format
  Singapore: {
    pattern: /^(\d{8,9}[A-Za-z]|[RT]\d{2}[A-Za-z]{2}\d{4}[A-Za-z])$/,
    hint: "Enter a valid ACRA UEN (e.g. 200012345A or T08LL1234A)",
  },
  // UAE DED trade licence: digits, optionally prefixed (e.g. CN-1234567 or 1234567)
  "United Arab Emirates": {
    pattern: /^([A-Za-z]{1,3}-?)?\d{5,8}$/,
    hint: "Enter a valid DED trade licence number (e.g. CN-1234567)",
  },
  "Saudi Arabia": {
    pattern: /^\d{10}$/,
    hint: "Enter your 10-digit Commercial Registration (CR) number",
  },
  // UK Companies House: 8 digits, or 2 letters + 6 digits (e.g. SC123456)
  "United Kingdom": {
    pattern: /^(\d{8}|[A-Za-z]{2}\d{6})$/,
    hint: "Enter a valid Companies House number (e.g. 12345678 or SC123456)",
  },
  // US EIN: 9 digits, often written 12-3456789
  "United States": {
    pattern: /^\d{2}-?\d{7}$/,
    hint: "Enter a valid 9-digit EIN (e.g. 12-3456789)",
  },
  // Australia ABN: 11 digits
  Australia: {
    pattern: /^\d{2}\s?\d{3}\s?\d{3}\s?\d{3}$/,
    hint: "Enter a valid 11-digit ABN (e.g. 51 824 753 556)",
  },
  // Hong Kong BR number: 8 digits
  "Hong Kong": {
    pattern: /^\d{8}(-\d{3})?$/,
    hint: "Enter a valid Business Registration number (8 digits)",
  },
};

const TAX_VAT_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  // SG GST registration mirrors the UEN
  Singapore: {
    pattern: /^(\d{8,9}[A-Za-z]|[RT]\d{2}[A-Za-z]{2}\d{4}[A-Za-z]|M\d{8}[A-Za-z])$/,
    hint: "Enter a valid GST registration number (same format as your UEN)",
  },
  // UAE TRN: exactly 15 digits
  "United Arab Emirates": {
    pattern: /^\d{15}$/,
    hint: "Enter your 15-digit TRN",
  },
  "Saudi Arabia": {
    pattern: /^3\d{14}$/,
    hint: "Enter your 15-digit VAT number (starts with 3)",
  },
  // UK VAT: GB + 9 digits (or 12 for branch traders)
  "United Kingdom": {
    pattern: /^(GB)?\d{9}(\d{3})?$/i,
    hint: "Enter a valid UK VAT number (9 digits, optionally prefixed GB)",
  },
  // EU member states in the list: 2-letter country code + 8–12 alphanumerics
  France: { pattern: /^FR[A-Za-z0-9]{2}\d{9}$/i, hint: "Enter a valid FR VAT number (e.g. FR12345678901)" },
  Germany: { pattern: /^DE\d{9}$/i, hint: "Enter a valid DE VAT number (e.g. DE123456789)" },
  Italy: { pattern: /^IT\d{11}$/i, hint: "Enter a valid IT VAT number (e.g. IT12345678901)" },
  Spain: { pattern: /^ES[A-Za-z0-9]\d{7}[A-Za-z0-9]$/i, hint: "Enter a valid ES VAT number (e.g. ESA12345678)" },
  Netherlands: { pattern: /^NL\d{9}B\d{2}$/i, hint: "Enter a valid NL VAT number (e.g. NL123456789B01)" },
};

const GENERIC_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9\s./-]{2,58}[A-Za-z0-9]$/;

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
  instagramHandle: z.string().trim().max(60, "Instagram handle is too long").optional().or(z.literal("")),
  corporateRegNumber: z.string().trim().min(4, "Corporate registry number is required (min 4 characters)").max(60, "Registry number is too long"),
  taxVatId: z.string().trim().max(60, "Tax/VAT ID is too long").optional().or(z.literal("")),
  isCertified: z.boolean(),
  certificationDetails: z.string().trim().max(300, "Certification details are too long").optional().or(z.literal("")),
  message: z.string().trim().max(2000, "Message is too long").optional().or(z.literal("")),
}).superRefine((d, ctx) => {
  if (d.password !== d.confirmPassword) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Passwords don't match", path: ["confirmPassword"] });
  }
  const regRule = CORPORATE_REG_RULES[d.country];
  if (regRule && !regRule.pattern.test(d.corporateRegNumber)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: regRule.hint, path: ["corporateRegNumber"] });
  } else if (!regRule && !GENERIC_ID_PATTERN.test(d.corporateRegNumber)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Enter a valid registry number (4–60 characters: letters, digits, spaces, . / -)",
      path: ["corporateRegNumber"],
    });
  }
  if (d.taxVatId) {
    const vatRule = TAX_VAT_RULES[d.country];
    if (vatRule && !vatRule.pattern.test(d.taxVatId.replace(/\s/g, ""))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: vatRule.hint, path: ["taxVatId"] });
    } else if (!vatRule && !GENERIC_ID_PATTERN.test(d.taxVatId)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid Tax/VAT ID (4–60 characters: letters, digits, spaces, . / -)",
        path: ["taxVatId"],
      });
    }
  }
});

const getCorporateRegPlaceholder = (country: string): string => {
  if (country === "Singapore") return "Enter your 9 or 10-digit ACRA UEN (e.g., 2026XXXXXX)";
  if (country === "United Arab Emirates" || country === "Saudi Arabia")
    return "Enter your DED Trade License / CR Number";
  return "Business registration number";
};

type FieldErrors = Partial<Record<string, string>>;

interface TradeRegistrationFormProps {
  prefillEmail?: string;
  prefillFirstName?: string;
  prefillLastName?: string;
  prefillCompany?: string;
  prefillPhone?: string;
}

const TradeRegistrationForm = ({
  prefillEmail = "",
  prefillFirstName = "",
  prefillLastName = "",
  prefillCompany = "",
  prefillPhone = "",
}: TradeRegistrationFormProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const inferredCountryRef = useRef<string>("");
  const [credentialFile, setCredentialFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string>("");
  const [uploading, setUploading] = useState(false);
  const [uploadedPath, setUploadedPath] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [form, setForm] = useState({
    email: prefillEmail,
    password: "",
    confirmPassword: "",
    firstName: prefillFirstName,
    lastName: prefillLastName,
    phone: prefillPhone,
    companyName: prefillCompany,
    companyWebsite: "",
    jobTitle: "",
    country: "",
    city: "",
    instagramHandle: "",
    corporateRegNumber: "",
    taxVatId: "",
    isCertified: false,
    certificationDetails: "",
    message: "",
  });

  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      email: prev.email || prefillEmail,
      firstName: prev.firstName || prefillFirstName,
      lastName: prev.lastName || prefillLastName,
      companyName: prev.companyName || prefillCompany,
      phone: prev.phone || prefillPhone,
    }));
  }, [prefillEmail, prefillFirstName, prefillLastName, prefillCompany, prefillPhone]);

  const update = (field: string, value: string | boolean) => {
    if (field === "country" && typeof value === "string") {
      trackForm.countryChanged("trade_registration", inferredCountryRef.current, value);
    }
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
        country: form.country,
      }).eq("id", authData.user.id);

      // Upload the credential document to the private bucket. Anonymous
      // uploads land in the `anon/` folder (allowed by storage policy) so the
      // file is captured even when e-mail confirmation is still pending.
      let credentialPath: string | null = null;
      const { data: sessionData } = await supabase.auth.getSession();
      if (credentialFile) {
        setUploading(true);
        try {
          const ext = credentialFile.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
          const folder = sessionData.session ? authData.user.id : `anon/${crypto.randomUUID()}`;
          const path = `${folder}/credential-${Date.now()}.${ext}`;
          const { error: upErr } = await supabase.storage
            .from("trade-credentials")
            .upload(path, credentialFile, { contentType: credentialFile.type || undefined, upsert: true });
          if (upErr) {
            setFileError("Your document could not be uploaded. Please try again or submit without it.");
            toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
          } else {
            credentialPath = path;
            setUploadedPath(path);
          }
        } finally {
          setUploading(false);
        }
      }

      const { data: appRow } = await supabase.from("trade_applications").insert({
        user_id: authData.user.id,
        company_name: form.companyName,
        company_website: form.companyWebsite || null,
        job_title: form.jobTitle,
        country: form.country,
        city: form.city,
        instagram_handle: form.instagramHandle || null,
        corporate_reg_number: form.corporateRegNumber,
        tax_vat_id: form.taxVatId || null,
        credential_document_path: credentialPath,
        is_certified_professional: form.isCertified,
        certification_details: form.certificationDetails || null,
        message: form.message || null,
      }).select("id").maybeSingle();

      // Kick off the asynchronous AI credential check (fire-and-forget).
      if (appRow?.id && sessionData.session) {
        supabase.functions
          .invoke("verify-trade-application", { body: { application_id: appRow.id } })
          .catch((err) => console.error("Verification kickoff failed:", err));
      }

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
        description: "Please check your email to verify your account. Get verified instantly — our automated system reviews global design credentials in real time.",
      });

      navigate("/trade/login");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const uploadCredential = async (file: File) => {
    setUploading(true);
    setFileError("");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "pdf";
      const folder = `anon/${crypto.randomUUID()}`;
      const path = `${folder}/credential-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("trade-credentials")
        .upload(path, file, { contentType: file.type || undefined, upsert: true });
      if (upErr) {
        setFileError("Your document could not be uploaded. Please try again.");
        toast({ title: "Upload failed", description: upErr.message, variant: "destructive" });
        setUploadedPath(null);
      } else {
        setUploadedPath(path);
      }
    } finally {
      setUploading(false);
    }
  };

  const openPreview = async () => {
    if (!uploadedPath) return;
    setPreviewOpen(true);
    setPreviewLoading(true);
    const { data, error } = await supabase.storage
      .from("trade-credentials")
      .createSignedUrl(uploadedPath, 600);
    if (error || !data?.signedUrl) {
      toast({ title: "Preview unavailable", description: error?.message || "Could not create a secure preview link.", variant: "destructive" });
      setPreviewOpen(false);
    } else {
      setPreviewUrl(data.signedUrl);
    }
    setPreviewLoading(false);
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
              placeholder={getPhonePlaceholder(form.country)}
              className={`${fieldClass("phone")} placeholder:text-muted-foreground/50`} />
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
              className={`${fieldClass("country")} appearance-none ${!form.country ? "text-muted-foreground" : ""}`}>
              <option value="" disabled>— Select country —</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="font-body text-sm text-foreground">City</label>
            <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
              className={fieldClass("city")} />
            <FieldError field="city" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Instagram Handle</label>
            <input type="text" inputMode="text" placeholder="@studio" value={form.instagramHandle}
              onChange={(e) => update("instagramHandle", e.target.value)}
              className={`${fieldClass("instagramHandle")} placeholder:text-muted-foreground/50`} />
            <FieldError field="instagramHandle" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Corporate Registry Number<span className="text-destructive">*</span></label>
            <input type="text" value={form.corporateRegNumber} onChange={(e) => update("corporateRegNumber", e.target.value)}
              placeholder={getCorporateRegPlaceholder(form.country)}
              className={`${fieldClass("corporateRegNumber")} placeholder:text-muted-foreground/50`} />
            <p className="font-body text-[11px] text-muted-foreground mt-1">
              UEN for SG, Trade License / TRN for GCC, Business Reg No. elsewhere
            </p>
            <FieldError field="corporateRegNumber" />
          </div>
          <div>
            <label className="font-body text-sm text-foreground">Tax / VAT ID</label>
            <input type="text" value={form.taxVatId} onChange={(e) => update("taxVatId", e.target.value)}
              className={fieldClass("taxVatId")} />
            <FieldError field="taxVatId" />
          </div>
        </div>
      </div>

      {/* Professional Credentials upload */}
      <div>
        <h3 className="font-display text-base text-foreground mb-1">Professional Credentials</h3>
        <p className="font-body text-xs text-muted-foreground mb-3">
          ASID / RIBA / SIA card, business licence, or a recent project invoice. Stored privately and reviewed
          only for verification. PDF, JPG or PNG, up to 15&nbsp;MB.
        </p>
        <label
          htmlFor="credential-upload"
          className={`flex flex-col items-center justify-center gap-1 w-full py-7 px-4 border border-dashed border-border rounded-lg transition-colors text-center ${
            uploading ? "opacity-60 pointer-events-none" : "cursor-pointer hover:border-foreground/40"
          }`}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              <span className="font-body text-sm text-foreground">Uploading {credentialFile?.name}…</span>
            </>
          ) : (
            <span className="font-body text-sm text-foreground">
              {credentialFile ? credentialFile.name : "Upload a credential document"}
            </span>
          )}
          <span className="font-body text-[11px] text-muted-foreground">
            {!uploading &&
              (credentialFile
                ? `${Math.round(credentialFile.size / 1024)} KB · tap to replace`
                : "Drag a file here or tap to browse")}
          </span>
        </label>
        <input
          id="credential-upload"
          type="file"
          accept="application/pdf,image/jpeg,image/png"
          className="sr-only"
          onChange={async (e) => {
            const f = e.target.files?.[0] || null;
            e.target.value = "";
            if (!f) return;
            const okTypes = ["application/pdf", "image/jpeg", "image/png"];
            if (!okTypes.includes(f.type)) {
              setFileError("Only PDF, JPG or PNG files are accepted.");
              setCredentialFile(null);
              setUploadedPath(null);
              return;
            }
            if (f.size > 15 * 1024 * 1024) {
              setFileError(`"${f.name}" is ${(f.size / 1024 / 1024).toFixed(1)} MB — the maximum is 15 MB.`);
              setCredentialFile(null);
              setUploadedPath(null);
              return;
            }
            setFileError("");
            setCredentialFile(f);
            setUploadedPath(null);
            await uploadCredential(f);
          }}
        />
        {uploadedPath && !uploading && (
          <div className="mt-3 flex items-start gap-3 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="font-body text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                Document uploaded successfully
              </p>
              <p className="font-body text-[11px] text-emerald-600/80 dark:text-emerald-400/80 truncate">
                {credentialFile?.name}
              </p>
            </div>
            <button
              type="button"
              onClick={openPreview}
              className="inline-flex items-center gap-1.5 font-body text-xs text-emerald-700 dark:text-emerald-300 hover:underline shrink-0"
            >
              <Eye className="w-3.5 h-3.5" />
              Preview
            </button>
          </div>
        )}
        {fileError && (
          <div className="mt-2 flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2.5">
            <AlertCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
            <p className="text-destructive text-xs font-body">{fileError}</p>
          </div>
        )}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl w-[calc(100%-2rem)] p-0 overflow-hidden">
            <DialogHeader className="px-5 pt-5 pb-2">
              <DialogTitle className="font-display text-base">Credential Preview</DialogTitle>
              <DialogDescription className="font-body text-xs">
                {credentialFile?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="relative bg-muted/50 flex items-center justify-center min-h-[320px] max-h-[70vh]">
              {previewLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  <span className="font-body text-xs text-muted-foreground">Generating secure preview…</span>
                </div>
              )}
              {previewUrl && credentialFile?.type === "application/pdf" ? (
                <iframe
                  src={previewUrl}
                  title="Credential preview"
                  className="w-full h-[70vh] min-h-[320px] border-0"
                />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Credential preview"
                  className="max-h-[70vh] max-w-full object-contain"
                />
              ) : null}
            </div>
          </DialogContent>
        </Dialog>
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
        className="w-full py-3 bg-[hsl(var(--gold))] text-white font-body text-sm uppercase tracking-[0.2em] rounded-full hover:bg-[hsl(var(--gold)/0.9)] transition-all disabled:opacity-50 font-bold inline-flex items-center justify-center gap-2">
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        {uploading ? "Uploading document…" : loading ? "Submitting..." : "Submit Application"}
      </button>
    </form>
  );
};

export default TradeRegistrationForm;
