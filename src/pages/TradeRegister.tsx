import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const COUNTRIES = [
  "Singapore", "Australia", "Canada", "China", "France", "Germany", "Hong Kong",
  "India", "Indonesia", "Italy", "Japan", "Malaysia", "Netherlands", "New Zealand",
  "Philippines", "South Korea", "Spain", "Switzerland", "Taiwan", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam", "Other"
];

const TradeRegister = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    email: "",
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

  const update = (field: string, value: string | boolean) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (form.password !== form.confirmPassword) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (form.password.length < 6) {
      toast({ title: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      // 1. Sign up
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: { emailRedirectTo: window.location.origin + "/trade" },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Registration failed");

      // 2. Update profile
      await supabase.from("profiles").update({
        first_name: form.firstName,
        last_name: form.lastName,
        company: form.companyName,
        phone: form.phone,
      }).eq("id", authData.user.id);

      // 3. Submit trade application
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

      // 4. Send email notification to concierge + confirmation to applicant
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

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-10">
          <Link to="/" className="inline-block">
            <h1 className="font-display text-2xl text-foreground tracking-wide">Maison Affluency</h1>
          </Link>
          <p className="font-body text-sm text-muted-foreground mt-2">Trade Account Application</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Account Details */}
          <div>
            <h2 className="font-display text-lg text-foreground mb-4">Account Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm text-foreground">Email<span className="text-destructive">*</span></label>
                <input type="email" required value={form.email} onChange={(e) => update("email", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Password<span className="text-destructive">*</span></label>
                <input type="password" required value={form.password} onChange={(e) => update("password", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Confirm Password<span className="text-destructive">*</span></label>
                <input type="password" required value={form.confirmPassword} onChange={(e) => update("confirmPassword", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
            </div>
          </div>

          {/* Personal Info */}
          <div>
            <h2 className="font-display text-lg text-foreground mb-4">Personal Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm text-foreground">First Name<span className="text-destructive">*</span></label>
                <input type="text" required value={form.firstName} onChange={(e) => update("firstName", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Last Name<span className="text-destructive">*</span></label>
                <input type="text" required value={form.lastName} onChange={(e) => update("lastName", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Phone<span className="text-destructive">*</span></label>
                <input type="tel" required value={form.phone} onChange={(e) => update("phone", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
            </div>
          </div>

          {/* Company Info */}
          <div>
            <h2 className="font-display text-lg text-foreground mb-4">Company Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="font-body text-sm text-foreground">Company Name<span className="text-destructive">*</span></label>
                <input type="text" required value={form.companyName} onChange={(e) => update("companyName", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Company Website</label>
                <input type="url" value={form.companyWebsite} onChange={(e) => update("companyWebsite", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Job Title<span className="text-destructive">*</span></label>
                <input type="text" required value={form.jobTitle} onChange={(e) => update("jobTitle", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
              </div>
              <div>
                <label className="font-body text-sm text-foreground">Country</label>
                <select value={form.country} onChange={(e) => update("country", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors appearance-none text-[16px]">
                  {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="font-body text-sm text-foreground">City</label>
                <input type="text" value={form.city} onChange={(e) => update("city", e.target.value)}
                  className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
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
              <input type="text" placeholder="Certification details (e.g. BCA, SIA, SIDS)"
                value={form.certificationDetails} onChange={(e) => update("certificationDetails", e.target.value)}
                className="w-full mt-3 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors text-[16px]" />
            )}
          </div>

          {/* Message */}
          <div>
            <label className="font-body text-sm text-foreground">Tell us about your practice or current project</label>
            <textarea value={form.message} onChange={(e) => update("message", e.target.value)} rows={3}
              className="w-full mt-1 pb-2 border-b border-border bg-transparent font-body text-sm text-foreground outline-none focus:border-foreground transition-colors resize-y text-[16px]" />
          </div>

          <button type="submit" disabled={loading}
            className="w-full py-3 bg-foreground text-background font-body text-sm uppercase tracking-[0.2em] rounded-full hover:opacity-90 transition-opacity disabled:opacity-50">
            {loading ? "Submitting..." : "Submit Application"}
          </button>
        </form>

        <div className="text-center mt-8 space-y-3">
          <p className="font-body text-xs text-muted-foreground">
            Already have a trade account?{" "}
            <Link to="/trade/login" className="text-foreground underline underline-offset-4 hover:opacity-70">Sign in</Link>
          </p>
          <p className="font-body text-xs text-muted-foreground">
            <Link to="/" className="hover:text-foreground transition-colors">← Back to Maison Affluency</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default TradeRegister;
