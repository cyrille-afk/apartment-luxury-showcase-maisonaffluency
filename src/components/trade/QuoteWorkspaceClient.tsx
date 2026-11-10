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
      if (!projectId) return null;
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
      const { data: board, error: boardError } = await supabase.from("client_boards").select("project_id, client_id, client_name, client_email").eq("id", folderId).maybeSingle();
      if (boardError) throw boardError;
      if (!board || board.project_id !== projectId) return null;
      const { data: invites, error: inviteError } = await supabase.from("board_invites").select("email").eq("board_id", folderId).eq("role", "client").neq("status", "revoked").order("created_at", { ascending: false });
      if (inviteError) throw inviteError;
      const emails = (invites ?? []).map(invite => invite.email.trim()).filter(Boolean)
        .filter((email, index, all) => all.findIndex(value => value.toLowerCase() === email.toLowerCase()) === index);
      const { data: project, error: projectError } = await supabase.from("projects").select("client_id, client_name").eq("id", projectId).maybeSingle();
      if (projectError) throw projectError;
      const clientId = board.client_id || project?.client_id;
      const profile = { companyName: "", clientName: "", email: emails[0] || board.client_email?.trim() || "" };
      if (clientId) {
        const [{ data: client, error: clientError }, { data: contacts, error: contactsError }] = await Promise.all([
          supabase.from("clients").select("name, type").eq("id", clientId).maybeSingle(),
          supabase.from("client_contacts").select("first_name, last_name, email, is_primary").eq("client_id", clientId).order("is_primary", { ascending: false }),
        ]);
        if (clientError) throw clientError;
        if (contactsError) throw contactsError;
        const contact = profile.email ? contacts?.find(contact => contact.email?.trim().toLowerCase() === profile.email.toLowerCase()) : contacts?.find(contact => contact.is_primary);
        if (client?.type === "company" || client?.type === "studio") profile.companyName = client.name.trim();
        profile.clientName = contact ? [contact.first_name, contact.last_name].filter(Boolean).join(" ").trim() : "";
        if (!profile.clientName && !profile.email && client?.type === "individual") profile.clientName = client.name.trim();
        if (!profile.email) profile.email = contact?.email?.trim() || "";
      }
      if (!profile.clientName && board.client_email?.trim().toLowerCase() === profile.email.toLowerCase()) profile.clientName = board.client_name?.trim() || "";
      if (!profile.clientName && !profile.email) profile.clientName = board.client_name?.trim() || project?.client_name?.trim() || "";
      if (!emails.length && profile.email) emails.push(profile.email);
      return { folderId, emails, profile };
    },
  });
  const hydrate = workspace?.hydrateFolderContacts;
  useEffect(() => {
    if (projectId && data) hydrate?.(projectId, data.folderId, data.emails, data.profile);
  }, [projectId, data, hydrate]);
  useEffect(() => {
    const refresh = () => { void refetch(); };
    window.addEventListener("ma:quote-folder-linked", refresh);
    return () => window.removeEventListener("ma:quote-folder-linked", refresh);
  }, [refetch]);
  const folderId = data?.folderId ?? (isPending ? activeFolderId : null);
  const email = projectId && folderId ? workspace?.projects[projectId]?.folders[folderId]?.primaryContact || data?.emails[0] : null;
  const profile = projectId && folderId ? workspace?.projects[projectId]?.folders[folderId]?.clientProfile || data?.profile : null;
  const matchesContact = !email || !profile?.email || profile.email.toLowerCase() === email.toLowerCase();
  const companyName = matchesContact ? profile?.companyName?.trim() : "";
  const clientName = matchesContact ? profile?.clientName?.trim() : "";
  const contactLine = clientName ? `Attn: ${clientName}${email ? ` (${email})` : ""}` : email;
  return <div className="mt-2 font-body" aria-live="polite" data-testid="quote-workspace-client">
    <span className="block text-[10px] uppercase tracking-normal text-muted-foreground">Client workspace</span>
    {companyName && <p className="mt-1 break-words text-sm font-semibold leading-snug text-foreground">{companyName}</p>}
    {contactLine && <p className="mt-0.5 break-words text-xs leading-snug text-foreground">{contactLine}</p>}
    {!companyName && !contactLine && <p className="mt-0.5 text-xs leading-snug text-muted-foreground">
      {projectId && isPending ? "Loading client…" : isError ? "Client details unavailable" : "CLIENT: UNASSIGNED TO PROJECT"}
    </p>}
  </div>;
}