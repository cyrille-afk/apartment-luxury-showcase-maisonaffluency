import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import affluencyLogo from "@/assets/affluency-quote-logo.jpg";
import { quoteBrandingStorageKey, resolveQuoteBranding, type QuoteFolderBranding } from "@/lib/quoteBranding";
import type { Studio } from "@/hooks/useStudio";

export function useQuoteBranding(quoteId: string, projectId: string | null, userId: string | undefined, studio: Studio | null) {
  const workspace = useProjectWorkspace();
  const activeFolderId = projectId && workspace?.activeFolder?.projectId === projectId ? workspace.activeFolder.folderId : null;
  const queryClient = useQueryClient();
  const queryKey = ["quote-folder-branding", quoteId, projectId, activeFolderId];
  const { data: folder, refetch } = useQuery({
    queryKey,
    queryFn: async (): Promise<QuoteFolderBranding | null> => {
      const { data: quote, error } = await supabase.from("trade_quotes").select("project_id, project_board_id").eq("id", quoteId).maybeSingle();
      if (error) throw error;
      if (!quote || quote.project_id !== projectId) return null;
      let folderId = quote.project_board_id;
      if (!folderId) {
        const { data: items, error: itemsError } = await supabase.from("client_board_items").select("board_id").eq("procurement_quote_id", quoteId);
        if (itemsError) throw itemsError;
        const ids = [...new Set(items?.map(item => item.board_id) ?? [])];
        if (ids.length === 1) folderId = ids[0];
      }
      folderId ||= activeFolderId;
      if (!folderId) return null;
      const { data: board, error: boardError } = await supabase.from("client_boards").select("id, project_id, studio_logo_url, studio_name").eq("id", folderId).maybeSingle();
      if (boardError) throw boardError;
      return board?.project_id === projectId ? board : null;
    },
  });
  const [draft, setDraft] = useState({ key: "", hidePlatform: false, companyHeader: "" });
  const storageKey = userId ? quoteBrandingStorageKey(userId, quoteId) : "";
  useEffect(() => {
    let saved = { hidePlatform: false, companyHeader: "" };
    try {
      const raw = storageKey ? localStorage.getItem(storageKey) : null;
      const value = raw ? JSON.parse(raw) : null;
      saved = { hidePlatform: value?.hidePlatform === true, companyHeader: typeof value?.companyHeader === "string" ? value.companyHeader : "" };
    } catch { /* Storage is optional; the current document remains editable. */ }
    setDraft({ key: storageKey, ...saved });
  }, [storageKey]);
  const currentDraft = draft.key === storageKey ? draft : { key: storageKey, hidePlatform: false, companyHeader: "" };
  const updateDraft = (patch: Partial<Pick<typeof draft, "hidePlatform" | "companyHeader">>) => {
    const next = { ...currentDraft, ...patch };
    setDraft(next);
    try { if (storageKey) localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* No blocking save. */ }
  };
  useEffect(() => {
    const refresh = () => { void refetch(); };
    const update = (event: Event) => {
      const next = (event as CustomEvent<QuoteFolderBranding>).detail;
      if (next?.id === folder?.id) queryClient.setQueryData(queryKey, { ...folder, ...next });
    };
    window.addEventListener("ma:quote-folder-linked", refresh);
    window.addEventListener("ma:studio-branding-changed", update);
    window.addEventListener("focus", refresh);
    return () => {
      window.removeEventListener("ma:quote-folder-linked", refresh);
      window.removeEventListener("ma:studio-branding-changed", update);
      window.removeEventListener("focus", refresh);
    };
  }, [refetch, folder, queryClient, quoteId, projectId, activeFolderId]);
  return { ...resolveQuoteBranding(folder, studio, currentDraft.hidePlatform), ...currentDraft, updateDraft };
}

type BrandingState = ReturnType<typeof useQuoteBranding>;

export function QuoteBrandingControl({ branding }: { branding: BrandingState }) {
  return <div className="mb-4 flex h-5 items-center justify-end print:hidden">
    {branding.canHidePlatform && <label className="flex cursor-pointer items-center gap-2 font-body text-[11px] text-muted-foreground">
      <Checkbox checked={branding.hidePlatform} onCheckedChange={checked => branding.updateDraft({ hidePlatform: checked === true })} />
      Hide platform branding
    </label>}
  </div>;
}

export function QuoteBrandingHeader({ branding }: { branding: BrandingState }) {
  return <div className="h-36 min-w-0 w-full" data-testid="quote-branding-header">
    {branding.showPlatform ? <div className="flex items-start gap-3 md:gap-4">
      <img src={affluencyLogo} alt="Affluency" className="h-14 w-14 shrink-0 object-contain md:h-16 md:w-16 lg:h-20 lg:w-20" />
      <div className="min-w-0 text-left">
        <p className="font-display text-xs uppercase tracking-normal text-foreground">Affluency Etc Pte. Ltd.</p>
        <p className="mt-0.5 font-body text-[11px] leading-relaxed text-muted-foreground">1 Grange Garden<br />#16-05<br />The Grange<br />249631<br />Singapore</p>
      </div>
    </div> : branding.logoUrl ? <div className="flex h-full min-w-0 flex-col items-start gap-2">
      <div className="flex h-20 w-full items-start"><img src={branding.logoUrl} alt={branding.studioName || "Studio logo"} className="h-full w-auto max-w-full object-contain object-left-top" /></div>
      {branding.studioName && <p className="break-words font-display text-xs uppercase tracking-normal text-foreground">{branding.studioName}</p>}
    </div> : <>
      <Textarea aria-label="Company header information" value={branding.companyHeader} onChange={event => branding.updateDraft({ companyHeader: event.target.value })} placeholder="Company name and address" className="h-full min-h-0 resize-none rounded-none border-border/60 bg-transparent p-2 font-body text-[11px] leading-relaxed shadow-none focus-visible:ring-1 print:hidden" />
      <p className="hidden whitespace-pre-wrap break-words font-body text-[11px] leading-relaxed text-foreground print:block">{branding.companyHeader}</p>
    </>}
  </div>;
}