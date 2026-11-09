import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useLocation } from "@/lib/router-compat";
import { useProject } from "@/hooks/useProjects";
import { useUserBoards } from "@/hooks/useUserBoards";
import InviteCollaboratorDialog from "./procurement/InviteCollaboratorDialog";

const InviteContext = createContext<((projectId: string | null) => void) | null>(null);
export const useCollaboratorInvite = () => useContext(InviteContext);

export function CollaboratorInviteProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [request, setRequest] = useState<{ projectId: string | null; key: number } | null>(null);
  const openInvite = useCallback((quoteProjectId: string | null) => {
    let activeProjectId = new URLSearchParams(location.search).get("project");
    if (!activeProjectId) {
      try { activeProjectId = sessionStorage.getItem("trade:lastProjectFilter"); } catch { /* No active folder. */ }
    }
    // A saved quote's association wins over an unrelated browsing filter.
    setRequest({ projectId: quoteProjectId || activeProjectId, key: Date.now() });
  }, [location.search]);
  return <InviteContext.Provider value={openInvite}>
    {children}
    {request && <ProjectClientInvitation key={request.key} projectId={request.projectId} onClose={() => setRequest(null)} />}
  </InviteContext.Provider>;
}

function ProjectClientInvitation({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const { project, loading: projectLoading } = useProject(projectId || undefined);
  const { boards, loading, error } = useUserBoards(Boolean(projectId), projectId);
  const projectBoards = boards.filter(board => board.project_id === projectId);
  // Automatically select an unambiguous folder, never silently choose among rooms.
  const matching = projectBoards.filter(board => board.title.trim().toLowerCase() === project?.name.trim().toLowerCase());
  const boardId = matching.length === 1 ? matching[0]?.id : projectBoards.length === 1 ? projectBoards[0]?.id : undefined;
  const ready = Boolean(projectId && project?.id === projectId && !projectLoading && !error);
  return <InviteCollaboratorDialog open onOpenChange={open => { if (!open) onClose(); }} boardId={boardId || ""}
    projectId={ready ? projectId || undefined : undefined} projectName={project?.id === projectId ? project.name : undefined}
    boardOptions={ready ? projectBoards : []} boardsLoading={loading || projectLoading} workspaceInvite clientWorkspace
    readOnly onInvited={() => {}} />;
}