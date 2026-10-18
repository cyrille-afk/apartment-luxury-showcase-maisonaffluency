import { useEffect, useState } from "react";
import { Download, Loader2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getClientSafeMode } from "@/lib/clientSafeMode";
import type { ProactiveTearsheetData } from "./ProactiveTearsheetCard";
import ClientPicker from "@/components/trade/ClientPicker";
import { ProjectPicker } from "@/components/trade/ProjectPicker";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import type { FelixQuoteDetails } from "@/lib/felixQuoteDetails";

export function FelixQuoteDownload({ cards, studioName, locale }: { cards: ProactiveTearsheetData[]; studioName?: string | null; locale?: string | null }) {
  const [details, setDetails] = useState<FelixQuoteDetails>({});
  const [editing, setEditing] = useState(false);
  const [projectError, setProjectError] = useState(false);
  const key = JSON.stringify({ cards, studioName, locale, details });
  const [ready, setReady] = useState<{ key: string; blob: Blob } | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setError(false);
    const input = JSON.parse(key);
    const timer = setTimeout(() => { import("@/lib/felixQuotePdf").then(({ buildFelixQuotePdf }) => buildFelixQuotePdf(input.cards, input.studioName, input.locale, input.details)).then((blob) => {
      if (!cancelled) setReady({ key, blob });
    }).catch(() => { if (!cancelled) setError(true); }); }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [key, retry]);
  useEffect(() => {
    let cancelled = false;
    setProjectError(false);
    if (!details.projectId) return;
    supabase.from("projects").select("name").eq("id", details.projectId).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setProjectError(true); return; }
      setDetails((current) => ({ ...current, projectName: data.name }));
    });
    return () => { cancelled = true; };
  }, [details.projectId]);
  const prepared = ready?.key === key ? ready.blob : null;
  return <div data-trade-sensitive className="px-3 pb-2">
    <Button variant="ghost" size="sm" className="w-full justify-between text-xs" aria-expanded={editing} onClick={() => setEditing((value) => !value)}>Client & project details<ChevronDown className={editing ? "rotate-180" : ""} /></Button>
    {editing && <div className="space-y-3 py-3">
      <div className="space-y-1"><Label>Client</Label><ClientPicker size="sm" value={details.clientId} readableNames showContactDetails={false} onChange={(client) => setDetails((current) => ({ ...current, clientId: client?.id ?? null, clientName: client?.name ?? "", contactName: [client?.primary_contact?.first_name, client?.primary_contact?.last_name].filter(Boolean).join(" "), email: client?.primary_contact?.email ?? "", phone: client?.primary_contact?.phone ?? "" }))} /></div>
      <div className="space-y-1"><Label>Project</Label><ProjectPicker compact value={details.projectId ?? null} onChange={(projectId) => setDetails((current) => ({ ...current, projectId, projectName: "" }))} />{projectError && <p className="text-xs text-destructive">Could not load project name. Enter it below.</p>}</div>
      {([['contactName', 'Contact name'], ['email', 'Email'], ['phone', 'Phone'], ['projectName', 'Project name'], ['projectAddress', 'Project location'], ['reference', 'Reference']] as const).map(([field, label]) => <div key={field} className="space-y-1"><Label htmlFor={`felix-pdf-${field}`}>{label}</Label><Input id={`felix-pdf-${field}`} type={field === 'email' ? 'email' : field === 'phone' ? 'tel' : 'text'} className="h-8 text-xs" maxLength={200} value={details[field] ?? ""} onChange={(event) => setDetails((current) => ({ ...current, [field]: event.target.value }))} /></div>)}
      <div className="space-y-1"><Label htmlFor="felix-pdf-note">Note</Label><Textarea id="felix-pdf-note" className="text-xs" maxLength={600} value={details.note ?? ""} onChange={(event) => setDetails((current) => ({ ...current, note: event.target.value }))} /></div>
    </div>}
    <Button variant="outline" size="sm" className="w-full text-[10px]" disabled={!prepared && !error} onClick={() => {
      if (getClientSafeMode()) return;
      if (error) { setRetry((value) => value + 1); return; }
      if (!prepared) return;
      const url = URL.createObjectURL(prepared);
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = "maison-affluency-felix-quote.pdf";
      document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    }}>{prepared ? <Download /> : error ? <Download /> : <Loader2 className="animate-spin" />}{error ? "Retry quote PDF" : prepared ? "Download current quote PDF" : "Preparing quote PDF"}</Button>
  </div>;
}