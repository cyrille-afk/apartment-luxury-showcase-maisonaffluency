import { contrastRatio, DEFAULT_COVER_THEME, normalizeCoverTheme, type CoverTheme } from "@/lib/pdfCoverTheme";
import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Copy, Mail, Trash2, UserPlus, Users, Plus } from "lucide-react";
import { copyTextToClipboard } from "@/lib/clipboard";
import { studioInvitationLink } from "@/lib/studioInvitationLink";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio, StudioRole } from "@/hooks/useStudio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PayoutAccountsSection from "@/components/trade/settings/PayoutAccountsSection";
import ResaleCertificatesSection from "@/components/trade/settings/ResaleCertificatesSection";
import { StudioBrand } from "@/components/trade/StudioBrand";
import { BrandedPdfPreview } from "@/components/trade/settings/BrandedPdfPreview";
import { PDF_LOCALE_LABELS, PDF_LOCALE_PRESETS, normalizePdfLocale, type PdfLocalePreset } from "@/lib/pdfFormatting";

interface Member {
  id: string;
  user_id: string;
  role: StudioRole;
  joined_at: string;
  profile?: { email: string | null; first_name: string | null; last_name: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: StudioRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const inviteExpired = (inv: Invite) => new Date(inv.expires_at).getTime() <= Date.now();
const inviteDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

const ROLE_DESC: Record<StudioRole, string> = {
  owner: "Full control including billing & deletion",
  admin: "Manage members and all studio content",
  editor: "Create and edit projects, quotes, boards",
  viewer: "Read-only access",
};

function CoverPreview({ theme, typeface, logoUrl, studioName }: { theme: CoverTheme; typeface: string; logoUrl: string; studioName: string }) {
  const heading = typeface === "modern" ? "font-body" : typeface === "classic" ? "font-serif" : "font-display";
  // Inline styles carry the studio's own chosen colours — this previews the PDF, not app theming.
  return <div aria-label="Cover preview" className="relative aspect-[297/210] w-full max-w-md overflow-hidden rounded-sm" style={{ background: theme.background }}>
    <div className="absolute inset-[3.5%] border" style={{ borderColor: theme.accent }} />
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-8 text-center">
      {logoUrl ? <img src={logoUrl} alt="" className="h-6 max-w-[40%] object-contain" /> : <span className="text-[8px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>{studioName || "Your studio"}</span>}
      <span className={`${heading} text-xl`} style={{ color: theme.text }}>Apartment name</span>
      <span className="text-[7px] uppercase tracking-[0.3em]" style={{ color: theme.accent }}>Project snapshot comparison</span>
    </div>
  </div>;
}

export default function TradeStudioSettings() {
  const { user } = useAuth();
  const { currentStudio, refresh: refreshStudios, isAdmin, isOwner } = useStudio();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StudioRole>("editor");
  const [inviting, setInviting] = useState(false);
  const [sendingInviteId, setSendingInviteId] = useState<string | null>(null);
  const inviteAttempts = useRef(new Map<string, string>());

  const [newStudioOpen, setNewStudioOpen] = useState(params.get("new") === "1");
  const [newStudioName, setNewStudioName] = useState("");
  const [creatingStudio, setCreatingStudio] = useState(false);

  const [studioName, setStudioName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [brandFont, setBrandFont] = useState("editorial");
  const [markup, setMarkup] = useState("0");
  const [pdfLocale, setPdfLocale] = useState<PdfLocalePreset>("en-GB");
  const [savingBrand, setSavingBrand] = useState(false);
  const [coverTheme, setCoverTheme] = useState<CoverTheme>(DEFAULT_COVER_THEME);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const uploadLogo = async (file: File) => {
    if (!currentStudio) return;
    if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 2 * 1024 * 1024) { toast({ title: "Use a PNG or JPEG logo under 2 MB", variant: "destructive" }); return; }
    setUploadingLogo(true);
    const path = `studio-logos/${currentStudio.id}/${Date.now()}.${file.type === "image/png" ? "png" : "jpg"}`;
    const { error } = await supabase.storage.from("assets").upload(path, file, { contentType: file.type, upsert: false });
    setUploadingLogo(false);
    if (error) { toast({ title: "Logo could not be uploaded", description: error.message, variant: "destructive" }); return; }
    setLogoUrl(supabase.storage.from("assets").getPublicUrl(path).data.publicUrl);
    toast({ title: "Logo uploaded — save branding to apply it" });
  };

  useEffect(() => {
    if (currentStudio) {
      setStudioName(currentStudio.name);
      setDisplayName(currentStudio.display_name || "");
      setLogoUrl(currentStudio.logo_url || "");
      setBrandFont(currentStudio.primary_brand_font || "editorial");
      setMarkup(String(currentStudio.default_project_markup_percentage ?? 0));
      setPdfLocale(normalizePdfLocale(currentStudio.pdf_locale));
      setCoverTheme(normalizeCoverTheme((currentStudio as { pdf_cover_theme?: unknown }).pdf_cover_theme));
    }
  }, [currentStudio?.id]);

  const fetchData = async () => {
    if (!currentStudio) return;
    setLoading(true);

    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("studio_members")
        .select("id, user_id, role, joined_at")
        .eq("studio_id", currentStudio.id)
        .order("joined_at"),
      supabase
        .from("studio_invites")
        .select("id, email, role, created_at, expires_at, accepted_at")
        .eq("studio_id", currentStudio.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    if (memberRows) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      setMembers(
        memberRows.map((m) => ({
          ...m,
          role: m.role as StudioRole,
          profile: profileMap.get(m.user_id) as any,
        }))
      );
    }
    if (inviteRows) setInvites(inviteRows.map((i) => ({ ...i, role: i.role as StudioRole })));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentStudio?.id]);

  const handleInvite = async () => {
    if (!currentStudio || !inviteEmail.trim() || !user) return;
    const email = inviteEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast({ title: "Enter a valid email address", variant: "destructive" });
      return;
    }
    setInviting(true);
    try {
      const existing = invites.find((invite) => invite.email.toLowerCase() === email);
      let inviteId = existing?.id;
      if (!inviteId) {
        const { data, error } = await supabase.from("studio_invites").insert({
          studio_id: currentStudio.id, email, role: inviteRole, invited_by: user.id,
        }).select("id").single();
        if (error || !data) throw new Error(error?.message || "Invitation could not be created");
        inviteId = data.id;
      }
      await sendInviteEmail(inviteId, email);
      setInviteEmail("");
      setInviteRole("editor");
    } catch (error) {
      toast({ title: "Invite failed", description: error instanceof Error ? error.message : "Please try again", variant: "destructive" });
    } finally {
      setInviting(false);
      await fetchData();
    }
  };

  const sendInviteEmail = async (inviteId: string, email: string) => {
    const attempt = inviteAttempts.current.get(inviteId) || crypto.randomUUID();
    inviteAttempts.current.set(inviteId, attempt);
    const { data, error } = await supabase.functions.invoke("send-transactional-email", {
      body: { templateName: "studio-teammate-invite", idempotencyKey: `studio-invite-${inviteId}-${attempt}`, templateData: { inviteId } },
    });
    if (error || data?.success !== true) throw new Error("Invitation saved, but its email could not be queued. Use Resend invite to retry.");
    inviteAttempts.current.delete(inviteId);
    toast({ title: "Invitation email queued", description: `Your studio invitation is on its way to ${email}.` });
  };

  const handleResendInvite = async (invite: Invite) => {
    setSendingInviteId(invite.id);
    try { await sendInviteEmail(invite.id, invite.email); }
    catch (error) { toast({ title: "Email not sent", description: error instanceof Error ? error.message : "Please retry", variant: "destructive" }); }
    finally { setSendingInviteId(null); await fetchData(); }
  };

  const handleCopyInvite = async (invite: Invite) => {
    const copied = await copyTextToClipboard(studioInvitationLink(invite.id));
    toast(copied
      ? { title: "Invitation link copied", description: `Only ${invite.email} can accept after signing in.` }
      : { title: "Link could not be copied", description: "Please try again.", variant: "destructive" });
  };

  const handleChangeRole = async (memberId: string, newRole: StudioRole) => {
    const { error } = await supabase
      .from("studio_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the studio?")) return;
    const { error } = await supabase.from("studio_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("studio_invites").delete().eq("id", inviteId);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handleSaveName = async () => {
    if (!currentStudio || !studioName.trim()) return;
    const { error } = await supabase
      .from("studios")
      .update({ name: studioName.trim() })
      .eq("id", currentStudio.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Studio updated" });
    refreshStudios();
  };

  const handleSaveBrand = async () => {
    if (!currentStudio || !isAdmin) return;
    const value = Number(markup);
    if (!Number.isFinite(value) || value < 0 || value > 1000 || (logoUrl.trim() && !/^https:\/\//i.test(logoUrl.trim()))) {
      toast({ title: "Enter a markup between 0 and 1000% and an HTTPS logo URL", variant: "destructive" });
      return;
    }
    setSavingBrand(true);
    const { error } = await supabase.from("studios").update({
      display_name: displayName.trim() || null,
      logo_url: logoUrl.trim() || null,
      primary_brand_font: brandFont,
      default_project_markup_percentage: value,
      pdf_locale: pdfLocale,
      pdf_cover_theme: coverTheme,
    }).eq("id", currentStudio.id);
    setSavingBrand(false);
    if (error) { toast({ title: "Branding could not be saved", description: error.message, variant: "destructive" }); return; }
    await refreshStudios();
    toast({ title: "Studio branding saved" });
  };

  const handleCreateStudio = async () => {
    if (!newStudioName.trim() || !user) return;
    setCreatingStudio(true);
    const { data, error } = await supabase
      .from("studios")
      .insert({ name: newStudioName.trim(), created_by: user.id })
      .select()
      .single();
    if (error || !data) {
      setCreatingStudio(false);
      toast({ title: "Could not create studio", description: error?.message, variant: "destructive" });
      return;
    }
    setCreatingStudio(false);
    setNewStudioOpen(false);
    setNewStudioName("");
    setParams({});
    refreshStudios();
    toast({ title: "Studio created", description: data.name });
  };

  if (!currentStudio) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-display mb-2">No studio yet</h1>
        <p className="text-muted-foreground mb-6">
          Create your first studio to start collaborating with your team.
        </p>
        <Button onClick={() => setNewStudioOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create studio
        </Button>
        <CreateStudioDialog
          open={newStudioOpen}
          onOpenChange={setNewStudioOpen}
          name={newStudioName}
          setName={setNewStudioName}
          onSubmit={handleCreateStudio}
          creating={creatingStudio}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display tracking-tight">Studio Settings</h1>
        <p className="text-muted-foreground">Manage your studio, members, and invitations.</p>
      </div>

      {/* Studio details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" /> Studio details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="studio-name">Studio name</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="studio-name"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                disabled={!isAdmin}
              />
              <Button onClick={handleSaveName} disabled={!isAdmin || studioName === currentStudio.name}>
                Save
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Your role: <Badge variant="secondary" className="ml-1">{currentStudio.role}</Badge>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-lg">Client-facing identity</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="border-b border-border pb-4"><StudioBrand studio={{ name: studioName, display_name: displayName, logo_url: logoUrl, primary_brand_font: brandFont }} /></div>
          <div><Label htmlFor="display-name">Display name</Label><Input id="display-name" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={studioName} disabled={!isAdmin} /></div>
          <div><Label htmlFor="brand-logo">Logo URL</Label><Input id="brand-logo" type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://…" disabled={!isAdmin} /></div>
          <div className="flex flex-wrap items-center gap-3"><Label htmlFor="brand-logo-file" className="cursor-pointer"><span className="inline-flex h-9 items-center rounded-md border border-input px-3 text-sm">{uploadingLogo ? "Uploading…" : "Upload logo (PNG or JPEG)"}</span></Label><input id="brand-logo-file" type="file" accept="image/png,image/jpeg" className="sr-only" disabled={!isAdmin || uploadingLogo} onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) void uploadLogo(f); }} />{logoUrl && isAdmin && <Button type="button" variant="ghost" size="sm" onClick={() => setLogoUrl("")}>Remove logo</Button>}</div>
          <div><Label htmlFor="brand-font">Brand typeface</Label><Select value={brandFont} onValueChange={setBrandFont} disabled={!isAdmin}><SelectTrigger id="brand-font"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="editorial">Editorial</SelectItem><SelectItem value="modern">Modern</SelectItem><SelectItem value="classic">Classic</SelectItem></SelectContent></Select></div>
          <fieldset className="space-y-3 border-t border-border pt-4">
            <legend className="text-sm font-medium">Client PDF cover</legend>
            <div className="flex flex-wrap gap-4">{([["background", "Background"], ["accent", "Accent"], ["text", "Title text"]] as const).map(([k, label]) => <div key={k} className="space-y-1"><Label htmlFor={`cover-${k}`}>{label}</Label><div className="flex items-center gap-2"><input id={`cover-${k}`} type="color" value={coverTheme[k]} disabled={!isAdmin} onChange={e => setCoverTheme(t => ({ ...t, [k]: e.target.value.toUpperCase() }))} className="h-9 w-12 cursor-pointer rounded border border-input bg-background" /><span className="font-mono text-xs text-muted-foreground">{coverTheme[k]}</span></div></div>)}<Button type="button" variant="ghost" size="sm" className="self-end" disabled={!isAdmin} onClick={() => setCoverTheme(DEFAULT_COVER_THEME)}>Reset</Button></div>
            {contrastRatio(coverTheme.background, coverTheme.text) < 4.5 && <p role="alert" className="text-xs text-destructive">Title text may be hard to read on this background.</p>}
            <CoverPreview theme={coverTheme} typeface={brandFont} logoUrl={logoUrl} studioName={displayName || studioName} />
            <BrandedPdfPreview theme={coverTheme} typeface={brandFont} logoUrl={logoUrl} studioName={displayName || studioName} />
          </fieldset>
          <div><Label htmlFor="default-markup">Default project markup (%)</Label><Input id="default-markup" type="number" min="0" max="1000" step="0.01" value={markup} onChange={(e) => setMarkup(e.target.value)} disabled={!isAdmin} /></div>
          <div>
            <Label htmlFor="pdf-locale">Proforma date &amp; number locale</Label>
            <Select value={pdfLocale} onValueChange={(value) => setPdfLocale(value as PdfLocalePreset)} disabled={!isAdmin}>
              <SelectTrigger id="pdf-locale"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PDF_LOCALE_PRESETS.map((preset) => <SelectItem key={preset} value={preset}>{PDF_LOCALE_LABELS[preset]}</SelectItem>)}
              </SelectContent>
            </Select>
            <p className="mt-1 text-xs text-muted-foreground">All PDF currency values retain two decimal places.</p>
          </div>
          {isAdmin && <Button onClick={handleSaveBrand} disabled={savingBrand}>{savingBrand ? "Saving…" : "Save branding"}</Button>}
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => {
                const isCurrentUser = m.user_id === user?.id;
                const displayName =
                  [m.profile?.first_name, m.profile?.last_name].filter(Boolean).join(" ") ||
                  m.profile?.email ||
                  "Unknown";
                const canEditThisMember = isAdmin && !isCurrentUser && m.role !== "owner";
                return (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {displayName} {isCurrentUser && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.profile?.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditThisMember ? (
                        <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, v as StudioRole)}>
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                      )}
                      {canEditThisMember && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> Invite a teammate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="teammate@studio.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as StudioRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                <Mail className="h-4 w-4 mr-2" />
                Send invite
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {ROLE_DESC[inviteRole]}. They'll receive an email and can accept the invitation after signing in.
            </p>

            {invites.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Pending invites</div>
                <div className="divide-y border rounded-md">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">{inv.role}</div>
                        <div className="mt-0.5 flex items-center gap-1.5">
                          <Badge variant={inviteExpired(inv) ? "destructive" : "secondary"} className="text-[10px] uppercase tracking-wide">
                            {inviteExpired(inv) ? "Expired" : "Valid"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {inviteExpired(inv)
                              ? `since ${inviteDate(inv.expires_at)} — link no longer works`
                              : `until ${inviteDate(inv.expires_at)} — link still works`}
                          </span>
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-1">
                      <Button variant="outline" size="sm" title={new Date(inv.expires_at).getTime() <= Date.now() ? "Resend to renew this expired invitation" : "Copy invitation link"} onClick={() => handleCopyInvite(inv)} disabled={new Date(inv.expires_at).getTime() <= Date.now()}>
                        <Copy className="mr-2 h-4 w-4" />Copy invitation link
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleResendInvite(inv)} disabled={inviting || sendingInviteId !== null}>
                        <Mail className="mr-2 h-4 w-4" />{sendingInviteId === inv.id ? "Sending…" : "Resend invite"}
                      </Button>
                      <Button variant="ghost" size="sm" disabled={sendingInviteId !== null} onClick={() => handleRevokeInvite(inv.id)}>
                        Revoke
                      </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Payout accounts (Stripe Connect) — for agent-mode commissions */}
      <PayoutAccountsSection />

      {/* US resale certificates — gates net-buy checkout per ship-to state */}
      <ResaleCertificatesSection />

      {/* Create new studio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need another studio?</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setNewStudioOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create new studio
          </Button>
        </CardContent>
      </Card>

      <CreateStudioDialog
        open={newStudioOpen}
        onOpenChange={setNewStudioOpen}
        name={newStudioName}
        setName={setNewStudioName}
        onSubmit={handleCreateStudio}
        creating={creatingStudio}
      />
    </div>
  );
}

function CreateStudioDialog({
  open,
  onOpenChange,
  name,
  setName,
  onSubmit,
  creating,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  setName: (v: string) => void;
  onSubmit: () => void;
  creating: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a studio</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-studio-name">Studio name</Label>
          <Input
            id="new-studio-name"
            placeholder="e.g. Atelier Lumière"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            You'll be the Owner. You can rename, invite teammates, and assign per-project roles later.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!name.trim() || creating}>
            {creating ? "Creating…" : "Create studio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
