import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "@/lib/router-compat";
import { useProject, useProjects } from "@/hooks/useProjects";
import { useUserBoards } from "@/hooks/useUserBoards";
import InviteCollaboratorDialog from "./procurement/InviteCollaboratorDialog";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";

const InviteContext = createContext<((projectId: string | null, quoteId?: string) => void) | null>(null);
export const useCollaboratorInvite = () => useContext(InviteContext);
const InviteDefaultContext = createContext<((quoteProjectId: string | null) => string | null) | null>(null);
/** Resolves the project the invitation will open on, so callers can name it before opening. */
export const useCollaboratorInviteDefault = () => useContext(InviteDefaultContext);

export function CollaboratorInviteProvider({ children }: { children: ReactNode }) {
  return <ProjectWorkspaceProvider><CollaboratorInviteState>{children}</CollaboratorInviteState></ProjectWorkspaceProvider>;
}

function CollaboratorInviteState({ children }: { children: ReactNode }) {
  const location = useLocation();
  const activeFolder = useProjectWorkspace()?.activeFolder;
  const [request, setRequest] = useState<{ projectId: string | null; quoteId?: string; key: number } | null>(null);
  const resolveProjectId = useCallback((quoteProjectId: string | null) => {
    let activeProjectId = new URLSearchParams(location.search).get("project");
    if (!activeProjectId) {
      try { activeProjectId = sessionStorage.getItem("trade:lastProjectFilter"); } catch { /* No active folder. */ }
    }
    // A saved quote's association wins over an unrelated browsing filter.
    return quoteProjectId || activeFolder?.projectId || activeProjectId || null;
  }, [location.search, activeFolder?.projectId]);
  const openInvite = useCallback((quoteProjectId: string | null, quoteId?: string) => {
    setRequest({ projectId: resolveProjectId(quoteProjectId), quoteId, key: Date.now() });
  }, [resolveProjectId]);
  return <InviteDefaultContext.Provider value={resolveProjectId}><InviteContext.Provider value={openInvite}>
    {children}
    {request && <ProjectClientInvitation key={request.key} projectId={request.projectId} quoteId={request.quoteId} onClose={() => setRequest(null)} />}
  </InviteContext.Provider></InviteDefaultContext.Provider>;
}

function ProjectClientInvitation({ projectId, quoteId, onClose }: { projectId: string | null; quoteId?: string; onClose: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const [quoteFolder, setQuoteFolder] = useState<{ projectId: string; boardId: string } | null>(null);
  const [quoteFolderLoading, setQuoteFolderLoading] = useState(Boolean(quoteId));
  useEffect(() => {
    if (!quoteId) return;
    let cancelled = false;
    void supabase.from("trade_quotes").select("project_id, project_board_id").eq("id", quoteId).maybeSingle().then(async ({ data }) => {
      if (cancelled) return;
      if (data?.project_id) {
        let boardId = data.project_board_id;
        if (!boardId) {
          const { data: sourceItems } = await supabase.from("client_board_items").select("board_id").eq("procurement_quote_id", quoteId);
          const sourceBoards = [...new Set(sourceItems?.map(item => item.board_id) ?? [])];
          if (sourceBoards.length === 1) boardId = sourceBoards[0];
        }
        if (cancelled) return;
        if (boardId) setQuoteFolder({ projectId: data.project_id, boardId });
      }
      setQuoteFolderLoading(false);
    });
    return () => { cancelled = true; };
  }, [quoteId]);
  const { projects, loading: projectsLoading } = useProjects({ activeOnly: false });
  const { project, loading: projectLoading } = useProject(selectedProjectId || undefined);
  const { boards, loading, error } = useUserBoards(Boolean(selectedProjectId), selectedProjectId, true);
  const projectBoards = boards.filter(board => board.project_id === selectedProjectId);
  const ready = Boolean(selectedProjectId && project?.id === selectedProjectId && !projectLoading && !error);
  const projectOptions = project?.id === selectedProjectId && !projects.some(option => option.id === project.id) ? [project, ...projects] : projects;
  return <InviteCollaboratorDialog open onOpenChange={open => { if (!open) onClose(); }} boardId={quoteFolder?.projectId === selectedProjectId ? quoteFolder.boardId : ""}
    projectId={ready ? selectedProjectId || undefined : undefined} projectName={project?.id === selectedProjectId ? project.name : undefined}
    projectOptions={projectOptions} selectedProjectId={selectedProjectId || ""} projectsLoading={projectsLoading} onProjectChange={setSelectedProjectId}
    boardOptions={ready ? projectBoards : []} boardsLoading={loading || projectLoading || quoteFolderLoading} workspaceInvite clientWorkspace
    quoteId={quoteId} readOnly onInvited={() => {}} />;
}