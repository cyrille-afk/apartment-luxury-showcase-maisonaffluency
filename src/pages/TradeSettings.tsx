import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { User, Lock, Building, Phone, Mail, Save } from "lucide-react";

const TradeSettings = () => {
  const { user, profile, refreshRoles } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const [form, setForm] = useState({
    first_name: "",
    last_name: "",
    company: "",
    phone: "",
  });

  const [passwords, setPasswords] = useState({
    newPassword: "",
    confirmPassword: "",
  });

  useEffect(() => {
    if (profile) {
      setForm({
        first_name: profile.first_name || "",
        last_name: profile.last_name || "",
        company: profile.company || "",
        phone: "",
      });
    }
  }, [profile]);

  // Fetch phone separately since it's not in the auth context profile
  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("phone")
      .eq("id", user.id)
      .single()
      .then(({ data }) => {
        if (data?.phone) setForm((f) => ({ ...f, phone: data.phone }));
      });
  }, [user]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        first_name: form.first_name,
        last_name: form.last_name,
        company: form.company,
        phone: form.phone,
      })
      .eq("id", user.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Profile updated" });
      refreshRoles(); // refresh profile data in context
    }
    setSaving(false);
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.newPassword !== passwords.confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }
    if (passwords.newPassword.length < 6) {
      toast({ title: "Error", description: "Password must be at least 6 characters", variant: "destructive" });
      return;
    }

    setChangingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: passwords.newPassword });

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

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl text-foreground mb-2">Account Settings</h1>
      <p className="font-body text-sm text-muted-foreground mb-8">
        Manage your trade account details and preferences.
      </p>

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
                className={inputClass}
              />
            </div>
            <div>
              <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
                Last Name
              </label>
              <input
                type="text"
                value={form.last_name}
                onChange={(e) => setForm({ ...form, last_name: e.target.value })}
                className={inputClass}
              />
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
              className={inputClass}
            />
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
                className={inputClass}
              />
            </div>
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
              placeholder="Min. 6 characters"
              className={inputClass}
            />
          </div>
          <div>
            <label className="font-body text-xs text-muted-foreground uppercase tracking-wider mb-1.5 block">
              Confirm New Password
            </label>
            <input
              type="password"
              value={passwords.confirmPassword}
              onChange={(e) => setPasswords({ ...passwords, confirmPassword: e.target.value })}
              className={inputClass}
            />
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
  );
};

export default TradeSettings;
