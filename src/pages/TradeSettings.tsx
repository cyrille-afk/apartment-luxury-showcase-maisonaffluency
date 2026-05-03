import { useState, useEffect, useRef } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Building, Phone, Mail, Save, Camera, Loader2, Award, TrendingUp, Compass } from "lucide-react";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import { useTradeDiscount } from "@/hooks/useTradeDiscount";

const COUNTRIES = [
  "Singapore", "Australia", "Canada", "China", "France", "Germany", "Hong Kong",
  "India", "Indonesia", "Italy", "Japan", "Malaysia", "Netherlands", "New Zealand",
  "Philippines", "South Korea", "Spain", "Switzerland", "Taiwan", "Thailand",
  "United Arab Emirates", "United Kingdom", "United States", "Vietnam", "Other",
];

const profileSchema = z.object({
  first_name: z.string().trim().min(1, "First name is required").max(100, "Max 100 characters"),
  last_name: z.string().trim().min(1, "Last name is required").max(100, "Max 100 characters"),
  company: z.string().trim().max(200, "Max 200 characters"),
  phone: z.string().trim().max(30, "Max 30 characters"),
  country: z.string().trim().max(100, "Max 100 characters").optional().or(z.literal("")),
});

const passwordSchema = z.object({
  newPassword: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

const TradeSettings = () => {
  const { user, profile, refreshRoles } = useAuth();
  const { toast } = useToast();
  const { tier, tierLabel, discountLabel, config: tierConfig } = useTradeDiscount();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [spendCents, setSpendCents] = useState<number>(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company: "",
    phone: "",
    country: "",
  });

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (profile) {
      setForm((f) => ({
        ...f,
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        company: profile.company || "",
      }));
    }
  }, [profile]);

  // Fetch phone, country, and avatar separately
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone, avatar_url, country, trade_tier_12mo_spend_cents")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.phone) setForm((f) => ({ ...f, phone: data.phone }));
        if ((data as any)?.country) setForm((f) => ({ ...f, country: (data as any).country }));
        if ((data as any)?.avatar_url) setAvatarUrl((data as any).avatar_url);
        if ((data as any)?.trade_tier_12mo_spend_cents != null) {
          setSpendCents((data as any).trade_tier_12mo_spend_cents);
        }
      });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 5 MB", variant: "destructive" });
      return;
    }

    setUploadingAvatar(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/avatar.${ext}`;

    // Upload (upsert)
    const { error: uploadErr } = await supabase.storage
      .from("avatars")
      .upload(path, file, { contentType: file.type, upsert: true });

    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      setUploadingAvatar(false);
      return;
    }

    const { data: urlData } = supabase.storage.from("avatars").getPublicUrl(path);
    const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`; // cache-bust

    // Save to profile
    await supabase.from("profiles").update({ avatar_url: publicUrl } as any).eq("id", user.id);
    setAvatarUrl(publicUrl);
    toast({ title: "Photo updated" });
    setUploadingAvatar(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileErrors({});
    const result = profileSchema.safeParse(form);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setProfileErrors(errs);
      return;
    }
    if (!user) return;
    setSaving(true);

    const countryChanged = !!result.data.country;

    const { error } = await supabase
      .from("profiles")
      .update(result.data)
      .eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      // Clear manual currency override so the new country drives the default.
      if (countryChanged) {
        try {
          window.localStorage.removeItem("trade.displayCurrency");
          window.localStorage.removeItem("trade.displayCurrency.manual");
          window.dispatchEvent(new CustomEvent("trade-display-currency-change", { detail: "original" }));
        } catch { /* ignore */ }
      }
      refreshRoles();
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordErrors({});
    const result = passwordSchema.safeParse(passwords);
    if (!result.success) {
      const errs: Record<string, string> = {};
      result.error.issues.forEach((i) => { errs[i.path[0] as string] = i.message; });
      setPasswordErrors(errs);
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: result.data.newPassword });

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Password updated" });
      setPasswords({ newPassword: "", confirmPassword: "" });
    }
    setChangingPassword(false);
  };

  const inputClass =
    "w-full px-4 py-3 bg-background border border-border rounded-md font-body text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30 focus:border-primary/50 transition-colors";

  const errorInputClass = "border-destructive focus:ring-destructive/30 focus:border-destructive/50";

  const FieldError = ({ field, errors }: { field: string; errors: Record<string, string> }) =>
    errors[field] ? <p className="font-body text-[10px] text-destructive mt-1">{errors[field]}</p> : null;

  const initials = `${form.first_name?.[0] || ""}${form.last_name?.[0] || ""}`.toUpperCase() || "?";

  return (
    <>
      <Helmet><title>Settings — Trade Portal — Maison Affluency</title></Helmet>
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-foreground mb-2">Account Settings</h1>
      <p className="font-body text-sm text-muted-foreground mb-6">
        Manage your trade account details and preferences.
      </p>

      {/* Trade tier badge */}
      <div className={`mb-8 flex items-center gap-3 px-4 py-3 rounded-lg border ${
        tier === "platinum" ? "bg-gradient-to-r from-zinc-100 via-white to-zinc-100 border-zinc-300" :
        tier === "gold" ? "bg-amber-50 border-amber-200" :
        tier === "silver" ? "bg-slate-50 border-slate-200" :
        "bg-muted/40 border-border"
      }`}>
        <div className={`h-9 w-9 rounded-full flex items-center justify-center ${
          tier === "platinum" ? "bg-zinc-200 text-zinc-900" :
          tier === "gold" ? "bg-amber-200 text-amber-900" :
          tier === "silver" ? "bg-slate-200 text-slate-800" :
          "bg-foreground/10 text-foreground"
        }`}>
          <Award className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <div className="font-display text-sm text-foreground">
            {tierLabel} Trade Tier
          </div>
          <div className="font-body text-xs text-muted-foreground">
            You receive a {discountLabel} trade discount on all eligible products.
            {tier !== "platinum" && " Tier upgrades are assigned by the Maison Affluency team based on your rolling 12-month confirmed spend."}
          </div>
        </div>
      </div>

      {/* Tier upgrade callout */}
      {tier !== "platinum" && (() => {
        const SILVER_THRESHOLD = tierConfig.silver.min_spend_cents;
        const GOLD_THRESHOLD = tierConfig.gold.min_spend_cents;
        const PLATINUM_THRESHOLD = tierConfig.platinum.min_spend_cents;
        const nextCfg = tier === "silver" ? tierConfig.gold : tierConfig.platinum;
        const nextTier = nextCfg.label;
        const nextDiscount = `${(nextCfg.discount_pct * 100).toFixed(nextCfg.discount_pct * 100 % 1 === 0 ? 0 : 1)}%`;
        const nextThreshold = nextCfg.min_spend_cents;
        const prevThreshold = tier === "silver" ? SILVER_THRESHOLD : GOLD_THRESHOLD;
        const remainingCents = Math.max(0, nextThreshold - spendCents);
        const progressPct = Math.min(100, Math.max(0,
          ((spendCents - prevThreshold) / (nextThreshold - prevThreshold)) * 100
        ));
        const fmt = (cents: number) =>
          new Intl.NumberFormat("en-GB", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);
        const accent = tier === "silver" ? "text-amber-700" : "text-zinc-700";
        const bar = tier === "silver" ? "bg-amber-500" : "bg-zinc-700";

        return (
          <div className="mb-8 px-4 py-4 rounded-lg border border-border bg-card">
            <div className="flex items-start gap-3">
              <div className={`h-9 w-9 rounded-full flex items-center justify-center bg-foreground/5 ${accent}`}>
                <TrendingUp className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="font-display text-sm text-foreground">
                    Unlock {nextTier} — {nextDiscount} trade discount
                  </div>
                  <div className="font-body text-[11px] text-muted-foreground tabular-nums">
                    {fmt(spendCents)} <span className="opacity-60">/ {fmt(nextThreshold)}</span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className={`h-full ${bar} rounded-full transition-all`}
                    style={{ width: `${progressPct}%` }}
                  />
                </div>

                <div className="mt-3 font-body text-xs text-muted-foreground leading-relaxed">
                  {remainingCents > 0 ? (
                    <>
                      <span className="text-foreground font-medium">{fmt(remainingCents)}</span> of additional confirmed spend over the next 12 months will qualify you for{" "}
                      <span className="text-foreground font-medium">{nextTier}</span> status.
                    </>
                  ) : (
                    <>
                      You've crossed the {nextTier} threshold. Our team reviews tier upgrades weekly — your status will be promoted shortly.
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Studio & team */}
      <a
        href="/trade/settings/studio"
        className="mb-8 flex items-center gap-3 px-4 py-3 rounded-lg border border-border bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="h-9 w-9 rounded-full bg-foreground/10 flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 21h18"/><path d="M5 21V7l8-4v18"/><path d="M19 21V11l-6-4"/></svg>
        </div>
        <div className="flex-1">
          <div className="font-display text-sm text-foreground">Studio &amp; team</div>
          <div className="font-body text-xs text-muted-foreground">
            Manage your studio, invite teammates, assign roles.
          </div>
        </div>
        <span className="text-xs text-muted-foreground">→</span>
      </a>

      {/* Profile Photo */}
      <div className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <Camera className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-base text-foreground">Profile Photo</h2>
        </div>
        <div className="flex items-center gap-5">
          <div className="relative group">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-muted border border-border flex items-center justify-center">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-xl text-muted-foreground">{initials}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="absolute inset-0 rounded-full bg-foreground/0 group-hover:bg-foreground/40 flex items-center justify-center transition-colors cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-background animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-background opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
            />
          </div>
          <div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingAvatar}
              className="font-body text-xs text-foreground hover:underline underline-offset-4 transition-colors"
            >
              {uploadingAvatar ? "Uploading…" : "Change photo"}
            </button>
            <p className="font-body text-[10px] text-muted-foreground mt-1">JPG, PNG or WebP · Max 5 MB</p>
          </div>
        </div>
      </div>

      {/* Profile Section */}
      <form onSubmit={handleSaveProfile} className="mb-10">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-base text-foreground">Profile Details</h2>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                First Name
              </label>
              <input
                type="text"
                value={form.first_name}
                onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                className={`${inputClass} ${profileErrors.first_name ? errorInputClass : ""}`}
              />
              <FieldError field="first_name" errors={profileErrors} />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Last Name
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className={`${inputClass} ${profileErrors.last_name ? errorInputClass : ""}`}
              />
              <FieldError field="last_name" errors={profileErrors} />
            </div>
          </div>

          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building className="h-3 w-3" /> Company
            </label>
            <input
              type="text"
              value={form.company}
              onChange={(e) => setForm({ ...form, company: e.target.value })}
              className={`${inputClass} ${profileErrors.company ? errorInputClass : ""}`}
            />
            <FieldError field="company" errors={profileErrors} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Mail className="h-3 w-3" /> Email
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className={`${inputClass} opacity-60 cursor-not-allowed`}
              />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                <Phone className="h-3 w-3" /> Phone
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={`${inputClass} ${profileErrors.phone ? errorInputClass : ""}`}
              />
              <FieldError field="phone" errors={profileErrors} />
            </div>
          </div>

          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <Building className="h-3 w-3" /> Country
            </label>
            <select
              value={form.country}
              onChange={(e) => setForm({ ...form, country: e.target.value })}
              className={`${inputClass} appearance-none ${!form.country ? "text-muted-foreground" : ""}`}
            >
              <option value="">— Select country —</option>
              {COUNTRIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <p className="font-body text-[10px] text-muted-foreground/70 mt-1.5">
              Used to set your default trade currency (GBP, EUR, USD, HKD, AED, …). You can still change it any time from the currency toggle.
            </p>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 bg-foreground text-background font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground/90 transition-colors disabled:opacity-50"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>

      {/* Password Section */}
      <form onSubmit={handleChangePassword}>
        <div className="flex items-center gap-2 mb-5">
          <Lock className="h-4 w-4 text-muted-foreground" />
          <h2 className="font-display text-base text-foreground">Change Password</h2>
        </div>

        <div className="space-y-4">
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              New Password
            </label>
            <input
              type="password"
              value={passwords.newPassword}
              onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              placeholder="Min. 8 characters"
              className={`${inputClass} ${passwordErrors.newPassword ? errorInputClass : ""}`}
            />
            <FieldError field="newPassword" errors={passwordErrors} />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              className={`${inputClass} ${passwordErrors.confirmPassword ? errorInputClass : ""}`}
            />
            <FieldError field="confirmPassword" errors={passwordErrors} />
          </div>
        </div>

        <button
          type="submit"
          disabled={changingPassword}
          className="mt-6 inline-flex items-center gap-2 px-6 py-2.5 border border-foreground text-foreground font-body text-xs uppercase tracking-[0.1em] rounded-md hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
        >
          <Lock className="h-3.5 w-3.5" />
          {changingPassword ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
    </>
  );
};

export default TradeSettings;
