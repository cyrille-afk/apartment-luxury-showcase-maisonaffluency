import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";
import { supabase } from "@/integrations/supabase/client";

/** Saved quote sheet wins; unrelated project contacts must never appear on this document. */
export default function QuoteWorkspaceClient({ quoteId, projectId }: { quoteId: string; projectId: string | null }) {
  const workspace = useProjectWorkspace();
  const activeFolderId = workspace?.activeFolder?.projectId === projectId ? workspace.activeFolder.folderId : null;
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["quote-workspace-client", quoteId, projectId, activeFolderId],
    enabled: Boolean(projectId),
    queryFn: async () => {
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
      const { data: board, error: boardError } = await supabase.from("client_boards").select("project_id").eq("id", folderId).maybeSingle();
      if (boardError) throw boardError;
      if (!board || board.project_id !== projectId) return null;
      const { data: invites, error: inviteError } = await supabase.from("board_invites").select("email").eq("board_id", folderId).eq("role", "client").neq("status", "revoked").order("created_at", { ascending: false });
      if (inviteError) throw inviteError;
      const emails = (invites ?? []).map(invite => invite.email.trim()).filter(Boolean)
        .filter((email, index, all) => all.findIndex(value => value.toLowerCase() === email.toLowerCase()) === index);
      return { folderId, emails };
    },
  });
  const hydrate = workspace?.hydrateFolderContacts;
  useEffect(() => {
    if (projectId && data) hydrate?.(projectId, data.folderId, data.emails);
  }, [projectId, data, hydrate]);
  useEffect(() => {
    const refresh = () => { void refetch(); };
    window.addEventListener("ma:quote-folder-linked", refresh);
    return () => window.removeEventListener("ma:quote-folder-linked", refresh);
  }, [refetch]);
  const folderId = data?.folderId ?? (isPending ? activeFolderId : null);
  const email = projectId && folderId ? workspace?.projects[projectId]?.folders[folderId]?.primaryContact || data?.emails[0] : null;
  return <div className="mt-2 font-body" aria-live="polite" data-testid="quote-workspace-client">
    <span className="block text-[10px] uppercase tracking-normal text-muted-foreground">Client workspace</span>
    <p className={`mt-0.5 break-all text-xs leading-snug ${email ? "text-foreground" : "text-muted-foreground"}`}>
      {email || (projectId && isPending ? "Loading client…" : isError ? "Client details unavailable" : "CLIENT: UNASSIGNED TO PROJECT")}
    </p>
  </div>;
}