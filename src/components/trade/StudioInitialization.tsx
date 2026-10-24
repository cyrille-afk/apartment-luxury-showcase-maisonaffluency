import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useStudio } from "@/hooks/useStudio";
import { supabase } from "@/integrations/supabase/client";
import { normalizeCoverTheme } from "@/lib/pdfCoverTheme";
import { hasRealStudioName } from "@/lib/studioSetup";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { canInitializeStep, initializationEmails } from "./studioInitializationRules";

export function StudioInitialization({ onComplete, onSkip }: { onComplete: (projectId: string) => void; onSkip: () => void }) {
  const { user, profile } = useAuth();
  const { currentStudio, refresh, setCurrentStudioId } = useStudio();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(currentStudio?.name || profile?.company || "");
  const [logo, setLogo] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [emails, setEmails] = useState([""]);
  const [projectName, setProjectName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const studioId = useRef(currentStudio?.id ?? null);
  const projectId = useRef<string | null>(null);
  const uploaded = useRef<{ file: File; url: string } | null>(null);
  const invites = useRef(new Map<string, { id: string; attempt: string; sent: boolean }>());
  const saving = useRef(false);
  const canManage = !currentStudio || ["owner", "admin"].includes(currentStudio.role);
  useEffect(() => {
    if (!logo) { setPreview(""); return; }
    const url = URL.createObjectURL(logo); setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [logo]);

  const run = async (skipInvites = false) => {
    if (!user || saving.current) return;
    saving.current = true; setBusy(true); setError(null);
    try {
      if (step === 1) {
        if (!hasRealStudioName(name)) throw new Error("Enter your studio’s name, rather than a default workspace name.");
        if (!studioId.current) {
          const { data, error } = await supabase.from("studios").insert({ name: name.trim(), created_by: user.id }).select("id").single();
          if (error || !data) throw new Error("Your studio could not be created. Please try again.");
          studioId.current = data.id;
        }
        if (canManage) {
          let logoUrl = currentStudio?.logo_url ?? null;
          if (logo) {
            if (uploaded.current?.file !== logo) {
              const path = `studio-logos/${studioId.current}/${crypto.randomUUID()}.${logo.type === "image/png" ? "png" : "jpg"}`;
              const { error } = await supabase.storage.from("assets").upload(path, logo, { contentType: logo.type, upsert: false });
              if (error) throw new Error("Your logo could not be uploaded. Please try again.");
              uploaded.current = { file: logo, url: supabase.storage.from("assets").getPublicUrl(path).data.publicUrl };
            }
            logoUrl = uploaded.current?.url ?? logoUrl;
          }
          const { error } = await supabase.from("studios").update({ name: name.trim(), display_name: name.trim(), logo_url: logoUrl, pdf_cover_theme: normalizeCoverTheme(currentStudio?.pdf_cover_theme) }).eq("id", studioId.current).select("id").single();
          if (error) throw new Error("Your studio details could not be saved. Please try again.");
        }
        setCurrentStudioId(studioId.current); await refresh(); setStep(2);
      } else if (step === 2) {
        if (!studioId.current) throw new Error("Return to Studio identity and save your studio first.");
        const recipients = skipInvites ? [] : initializationEmails(emails);
        for (const email of recipients) {
          let invite = invites.current.get(email);
          if (!invite) {
            const { data: existing, error: readError } = await supabase.from("studio_invites").select("id").eq("studio_id", studioId.current).eq("email", email).is("accepted_at", null).limit(1).maybeSingle();
            if (readError) throw new Error("Your invitations could not be checked. Please try again.");
            let id = existing?.id;
            if (!id) {
              const { data, error } = await supabase.from("studio_invites").insert({ studio_id: studioId.current, email, role: "editor", invited_by: user.id }).select("id").single();
              if (error || !data) throw new Error("A teammate invitation could not be saved. Please try again.");
              id = data.id;
            }
            invite = { id, attempt: crypto.randomUUID(), sent: false }; invites.current.set(email, invite);
          }
          if (!invite.sent) {
            const { data, error } = await supabase.functions.invoke("send-transactional-email", { body: { templateName: "studio-teammate-invite", idempotencyKey: `studio-invite-${invite.id}-${invite.attempt}`, templateData: { inviteId: invite.id } } });
            if (error || data?.success !== true) throw new Error("Invitation saved, but its email could not be sent. Retry, or skip and resend from Studio Settings.");
            invite.sent = true;
          }
        }
        setStep(3);
      } else {
        if (!studioId.current || !projectName.trim()) throw new Error("Name your first project folder.");
        const fields = { name: projectName.trim(), studio_id: studioId.current, user_id: user.id, client_name: "", location: "", status: "active" as const };
        const write = projectId.current ? supabase.from("projects").update({ name: fields.name }).eq("id", projectId.current) : supabase.from("projects").insert(fields);
        const { data, error } = await write.select("id").single();
        if (error || !data) throw new Error("Your project folder could not be saved. Please try again.");
        projectId.current = data.id;
        await refresh();
        window.dispatchEvent(new Event("trade-projects:changed"));
        onComplete(data.id);
      }
    } catch (error) { setError(error instanceof Error ? error.message : "Setup could not be saved. Please try again."); }
    finally { saving.current = false; setBusy(false); }
  };

  return <Dialog open onOpenChange={open => { if (!open && !busy) onSkip(); }}>
    <DialogContent hideClose overlayClassName="z-[150] bg-background/80 backdrop-blur-md" className="z-[151] w-[calc(100%-2rem)] max-w-xl max-h-[90dvh] overflow-y-auto rounded-none border-border p-8 shadow-none sm:rounded-none sm:p-10" onInteractOutside={event => event.preventDefault()}>
      <p className="font-body text-[10px] uppercase text-accent">Maison Affluency · Studio Initialization · {step} / 3</p>
      <div className="flex gap-2" aria-hidden="true">{[1, 2, 3].map(value => <span key={value} className={`h-px flex-1 ${value <= step ? "bg-accent" : "bg-border"}`} />)}</div>
      <DialogTitle className="font-display text-3xl font-normal">{["Your studio identity", "Invite your team", "Your first project"][step - 1]}</DialogTitle>
      <DialogDescription className="font-body text-sm">{["A name of your own. A signature, if you wish.", "Invite colleagues to collaborate as editors. You can also do this later.", "Give your first engagement a place in your studio."][step - 1]}</DialogDescription>
      <form onSubmit={event => { event.preventDefault(); void run(); }} className="space-y-6 pt-3">
        {step === 1 && <>
          <div className="space-y-2"><Label htmlFor="initialize-studio-name">Studio Name</Label><Input id="initialize-studio-name" value={name} disabled={busy || !canManage} onChange={event => setName(event.target.value)} maxLength={200} required /></div>
          <div className="space-y-3"><Label>Brand logo <span className="text-muted-foreground">— optional</span></Label><div className="flex items-center gap-4">{(preview || currentStudio?.logo_url) && <img src={preview || currentStudio?.logo_url || ""} alt="Studio logo preview" className="h-14 max-w-40 object-contain" />}<Button type="button" variant="ghost" disabled={busy || !canManage} onClick={() => fileInput.current?.click()}><Upload className="mr-2 h-4 w-4" />Upload logo</Button>{logo && <Button type="button" variant="ghost" size="icon" aria-label="Remove logo" disabled={busy} onClick={() => setLogo(null)}><Trash2 className="h-4 w-4" /></Button>}</div>
            <input ref={fileInput} type="file" accept="image/png,image/jpeg" aria-label="Upload studio logo" className="sr-only" onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; if (!file) return; if (!/^image\/(png|jpeg)$/.test(file.type) || file.size > 2 * 1024 * 1024) { setError("Use a PNG or JPEG logo under 2 MB."); return; } setError(null); setLogo(file); }} />
          </div>
        </>}
        {step === 2 && <div className="space-y-3">{canManage ? <>{emails.map((email, index) => <div key={index} className="flex items-center gap-2"><Label htmlFor={`initialize-email-${index}`} className="sr-only">Teammate email {index + 1}</Label><Input id={`initialize-email-${index}`} type="email" placeholder="colleague@studio.com" value={email} disabled={busy} onChange={event => setEmails(rows => rows.map((row, position) => position === index ? event.target.value : row))} /><Button type="button" variant="ghost" size="icon" aria-label={`Remove teammate ${index + 1}`} disabled={busy} onClick={() => setEmails(rows => rows.filter((_, position) => position !== index))}><Trash2 className="h-4 w-4" /></Button></div>)}<Button type="button" variant="ghost" disabled={busy} onClick={() => setEmails(rows => [...rows, ""])}><Plus className="mr-2 h-4 w-4" />Add teammate</Button></> : <p className="text-sm text-muted-foreground">Your studio owner or administrator can invite teammates from Studio Settings.</p>}</div>}
        {step === 3 && <div className="space-y-2"><Label htmlFor="initialize-project-name">Project folder name</Label><Input id="initialize-project-name" placeholder="New Residential Project" value={projectName} disabled={busy} onChange={event => setProjectName(event.target.value)} maxLength={200} required /></div>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-5"><Button type="button" variant="ghost" disabled={busy || step === 1} onClick={() => { setError(null); setStep(value => value - 1); }}><ArrowLeft className="mr-2 h-4 w-4" />Back</Button><Button type="submit" variant="outline" className="rounded-none" disabled={busy || !canInitializeStep(step, name, projectName)}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{busy ? "Saving…" : step === 3 ? "Open Studio Dashboard" : step === 2 && emails.some(email => email.trim()) && canManage ? "Send invitations & Continue" : "Continue"}{step === 3 ? <Check className="ml-2 h-4 w-4" /> : <ArrowRight className="ml-2 h-4 w-4" />}</Button></div>
        {step === 2 && <Button type="button" variant="link" className="h-auto p-0 text-muted-foreground" disabled={busy} onClick={() => void run(true)}>Skip invitations</Button>}
        <Button type="button" variant="link" className="block h-auto p-0 text-muted-foreground" disabled={busy} onClick={onSkip}>Skip to Dashboard</Button>
      </form>
    </DialogContent>
  </Dialog>;
}