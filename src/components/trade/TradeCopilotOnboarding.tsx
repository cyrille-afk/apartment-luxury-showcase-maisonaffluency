import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "@/lib/router-compat";
import { Sparkles, Loader2, AlertCircle, Upload, ArrowLeft, ArrowRight, Check, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { saveName, DEFAULT_NAME, sanitizeName } from "@/components/trade/conciergeGreeting";
import { useAIGuideName } from "@/hooks/useAIGuideName";

import { STUDIO_SETUP_PATH } from "@/lib/studioSetup";

const STORAGE_KEY = "ma:copilot-onboarded";
const OVERLAY_ID = "trade-copilot-onboarding";

export function canAdvanceOnboarding(step: number, studioName: string, projectName: string) {
  return step === 3 ? studioName.trim().length > 0 : step === 4 ? studioName.trim().length > 0 && projectName.trim().length > 0 : true;
}

function useOnboardingOpen() {
  const { profile, loading, isTradeUser } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (loading) return;
    const p = pathname.replace(/\/+$/, "");
    const inWorkspace = p === STUDIO_SETUP_PATH || p === "/trade" || (p.startsWith("/trade/") && !p.startsWith("/trade/admin"));
    const completed = profile?.has_seen_trade_intro === true || localStorage.getItem(STORAGE_KEY) === "1";
    setOpen(prev => prev || (isTradeUser && inWorkspace && !completed));
  }, [profile?.has_seen_trade_intro, loading, isTradeUser, pathname]);
  const markDone = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(STORAGE_KEY, "1"); } catch {}

  }, []);
  return { open, markDone };
}

export default function TradeCopilotOnboarding() {
  const guideName = useAIGuideName();
  const navigate = useNavigate();
  const { profile, user, refreshRoles } = useAuth();
  const { currentStudio, loading: studioLoading, refresh, setCurrentStudioId, isStudioSetupComplete, studioSetupLoading } = useStudio();
  const { open, markDone } = useOnboardingOpen();
  const [confirmation, setConfirmation] = useState<{ id: string; name: string } | null>(null);
  const [finishingStudio, setFinishingStudio] = useState(false);
  const confirmationKey = user ? `ma:onboarding-project:${user.id}` : null;

  useEffect(() => {
    if (!confirmationKey) return;
    try {
      const stored = JSON.parse(sessionStorage.getItem(confirmationKey) || "null");
      if (stored && typeof stored.id === "string" && typeof stored.name === "string") {
        setConfirmation(stored);
        setFinishingStudio(stored.finishingStudio === true);
      }
    } catch {}
  }, [confirmationKey]);

  const dismissConfirmation = () => {
    if (confirmationKey) sessionStorage.removeItem(confirmationKey);
    setConfirmation(null);
  };
  const [step, setStep] = useState(1);
  const [nickname, setNickname] = useState("");
  const [studioName, setStudioName] = useState("");
  const [projectName, setProjectName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const studioDirty = useRef(false);
  const saving = useRef(false);
  // Retain successful writes across retries; never create a second folder on a late failure.
  const savedStudioId = useRef<string | null>(null);
  const savedProjectId = useRef<string | null>(null);
  const uploadedLogo = useRef<{ file: File; url: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const displayName = profile?.company?.trim() || profile?.first_name?.trim() || "Designer";

  useEffect(() => {
    if (open) setNickname(profile?.concierge_name?.trim() || DEFAULT_NAME);
  }, [open, profile?.concierge_name]);
  useEffect(() => {
    if (open && !studioDirty.current) setStudioName(currentStudio?.name || profile?.company || "");
  }, [open, currentStudio?.name, profile?.company]);
  useEffect(() => {
    if (!logo) { setLogoPreview(""); return; }
    const url = URL.createObjectURL(logo);
    setLogoPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const complete = async () => {
    if (!user || saving.current || studioLoading || !canAdvanceOnboarding(4, studioName, projectName)) return;
    saving.current = true;
    setBusy(true);
    setSaveError(null);
    try {
      let studioId = savedStudioId.current || currentStudio?.id;
      if (!studioId) {
        const { data, error } = await supabase.from("studios").insert({ name: studioName.trim(), created_by: user.id }).select("id").single();
        if (error || !data) throw new Error("Your studio could not be created. Please try again.");
        studioId = data.id;
        savedStudioId.current = studioId;
      }
      let logoUrl = currentStudio?.logo_url ?? null;
      if (logo) {
        if (uploadedLogo.current?.file === logo) logoUrl = uploadedLogo.current.url;
        else {
          const path = `studio-logos/${studioId}/${crypto.randomUUID()}.${logo.type === "image/png" ? "png" : "jpg"}`;
          const { error } = await supabase.storage.from("assets").upload(path, logo, { contentType: logo.type, upsert: false });
          if (error) throw new Error("Your logo could not be uploaded. Please try again.");
          logoUrl = supabase.storage.from("assets").getPublicUrl(path).data.publicUrl;
          uploadedLogo.current = { file: logo, url: logoUrl };
        }
      }
      const { error: studioError } = await supabase.from("studios").update({ name: studioName.trim(), display_name: studioName.trim(), logo_url: logoUrl }).eq("id", studioId).select("id").single();
      if (studioError) throw new Error("Studio details could not be saved. Check your studio editing permissions and try again.");
      const fields = { name: projectName.trim(), studio_id: studioId, user_id: user.id, client_name: "", location: "" };
      const projectWrite = savedProjectId.current
        ? supabase.from("projects").update({ name: fields.name }).eq("id", savedProjectId.current)
        : supabase.from("projects").insert(fields);
      const { data: project, error: projectError } = await projectWrite.select("id").single();
      if (projectError || !project) throw new Error("Your studio is saved, but your project folder could not be saved. Please try again.");
      savedProjectId.current = project.id;
      const chosen = sanitizeName(nickname) || DEFAULT_NAME;
      const { error: profileError } = await supabase.from("profiles").update({ concierge_name: chosen === DEFAULT_NAME ? null : chosen, has_seen_trade_intro: true }).eq("id", user.id).select("id").single();
      if (profileError) throw new Error("Your studio and project are saved. Please retry to finish onboarding.");
      saveName(chosen);
      window.dispatchEvent(new CustomEvent("concierge:name-changed", { detail: chosen }));
      setCurrentStudioId(studioId);
      await Promise.all([refresh(), refreshRoles()]);
      window.dispatchEvent(new Event("trade-projects:changed"));
      const createdProject = { id: project.id, name: fields.name };
      if (confirmationKey) sessionStorage.setItem(confirmationKey, JSON.stringify(createdProject));
      setConfirmation(createdProject);
      setFinishingStudio(false);
      markDone();
      navigate(STUDIO_SETUP_PATH, { replace: true });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Setup could not be saved. Please try again.");
    } finally { saving.current = false; setBusy(false); }
  };

  if (confirmation && (!finishingStudio || (!studioSetupLoading && isStudioSetupComplete))) return (
    <div className="fixed inset-0 z-[140] flex items-center justify-center bg-background/70 backdrop-blur-lg px-6 py-6" role="dialog" aria-modal="true" aria-labelledby="onboarding-confirmation-title">
      <div className="w-full max-w-md max-h-full overflow-y-auto text-center">
        <div className="mb-5 inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent"><Check className="h-6 w-6" /></div>
        <p className="mb-4 font-body text-[10px] uppercase text-accent">Maison Affluency · {guideName}</p>
        <h2 id="onboarding-confirmation-title" className="mb-5 font-display text-3xl text-foreground">Your studio is taking shape.</h2>
        <p className="mb-6 font-body text-sm text-muted-foreground">Your first project folder has been created.</p>
        <div className="mb-6 flex items-center gap-3 border-y border-border py-5 text-left"><FolderOpen className="h-6 w-6 shrink-0 text-accent" /><span className="break-words font-display text-xl text-foreground">{confirmation.name}</span></div>
        <div className="space-y-3">
          <Button className="w-full" disabled={studioSetupLoading || !isStudioSetupComplete} onClick={() => { const projectId = confirmation.id; dismissConfirmation(); navigate(`/trade/projects/${encodeURIComponent(projectId)}`); }}><FolderOpen className="mr-2 h-4 w-4" />Open project folder<ArrowRight className="ml-2 h-4 w-4" /></Button>
          {!isStudioSetupComplete && <p className="font-body text-xs text-muted-foreground">Save your studio identity to unlock your project.</p>}
          <Button className="w-full" variant="outline" onClick={() => {
            if (isStudioSetupComplete) dismissConfirmation();
            else {
              setFinishingStudio(true);
              if (confirmationKey) sessionStorage.setItem(confirmationKey, JSON.stringify({ ...confirmation, finishingStudio: true }));
            }
            navigate(STUDIO_SETUP_PATH, { replace: true });
          }}>{isStudioSetupComplete ? "Stay in Studio Settings" : "Complete Studio Setup"}</Button>
        </div>
      </div>
    </div>
  );
  if (!open) return null;
  const titles = ["Welcome to the Maison, " + displayName + ".", "Your tier progress", "Set up your studio", "Your first project folder"];
  return (
    <div id={OVERLAY_ID} className="fixed inset-0 z-[140] flex items-center justify-center bg-background/70 backdrop-blur-lg px-6 py-6" role="dialog" aria-modal="true" aria-labelledby="copilot-welcome-title">
      <div className="w-full max-w-md max-h-full overflow-y-auto text-center">
        <div className="mb-5 inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent"><Sparkles className="w-6 h-6" /></div>
        <p className="font-body text-[10px] uppercase tracking-[0.25em] text-accent mb-4">Maison Affluency Trade Portal · {step} / 4</p>
        <h2 id="copilot-welcome-title" className="font-display text-2xl md:text-3xl text-foreground leading-snug mb-5 break-words">{titles[step - 1]}</h2>
        {step === 1 && <>
          <p className="font-body text-sm text-muted-foreground leading-relaxed mb-6">I’m {DEFAULT_NAME}, your digital studio assistant. Welcome to your workspace.</p>
          <div className="text-left mb-6"><Label htmlFor="copilot-nickname">Copilot name</Label><Input id="copilot-nickname" className="mt-2" value={nickname} onChange={e => setNickname(sanitizeName(e.target.value))} maxLength={32} placeholder={DEFAULT_NAME} /></div>
        </>}
        {step === 2 && <p className="font-body text-sm text-muted-foreground leading-relaxed mb-8">Here is your tier progress. As a Silver Partner, you get a 10% discount, but you can track your journey to a 12% Gold tier right here on your dashboard.</p>}
        {step === 3 && <div className="text-left space-y-5 mb-8">
          <div><Label htmlFor="onboarding-studio-name">Studio Name</Label><Input id="onboarding-studio-name" className="mt-2" value={studioName} onChange={e => { studioDirty.current = true; setStudioName(e.target.value); setSaveError(null); }} maxLength={200} required /></div>
          <div><Label>Studio logo</Label><div className="mt-2 flex flex-wrap items-center gap-3">
            {(logoPreview || currentStudio?.logo_url) && <img src={logoPreview || currentStudio?.logo_url || ""} alt="Studio logo preview" className="h-14 max-w-40 object-contain" />}
            <Button type="button" variant="outline" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4 mr-2" />Upload Logo</Button>
            {logo && <Button type="button" variant="ghost" onClick={() => setLogo(null)}>Remove</Button>}
          </div><input ref={fileInput} aria-label="Upload Logo" type="file" accept="image/png,image/jpeg" className="sr-only" onChange={e => {
            const file = e.target.files?.[0]; e.target.value = "";
            if (!file) return;
            if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 2 * 1024 * 1024) { setSaveError("Use a PNG or JPEG logo under 2 MB."); return; }
            setSaveError(null); setLogo(file);
          }} /></div>
        </div>}
        {step === 4 && <div className="text-left mb-8"><Label htmlFor="onboarding-project-name">Name your first project folder (e.g., Hamptons Project or Singapore GCB Workflow)</Label><Input id="onboarding-project-name" className="mt-3" value={projectName} onChange={e => { setProjectName(e.target.value); setSaveError(null); }} maxLength={200} disabled={busy} required /></div>}
        {saveError && <div role="alert" className="mb-5 flex items-start gap-2 text-left border border-destructive/30 bg-destructive/5 px-4 py-3 rounded-sm text-xs text-destructive"><AlertCircle className="w-4 h-4 shrink-0" />{saveError}</div>}
        <div className="flex items-center justify-between gap-3">
          <Button variant="ghost" disabled={busy || step === 1} onClick={() => { setSaveError(null); setStep(step - 1); }}><ArrowLeft className="w-4 h-4 mr-2" />Back</Button>
          <Button disabled={busy || studioLoading || !canAdvanceOnboarding(step, studioName, projectName)} onClick={() => step === 4 ? void complete() : (setSaveError(null), setStep(step + 1))}>
            {busy ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Saving…</> : <>{step === 4 ? "Let’s Go" : "Next"}<ArrowRight className="w-4 h-4 ml-2" /></>}
          </Button>
        </div>
      </div>
    </div>
  );
}
