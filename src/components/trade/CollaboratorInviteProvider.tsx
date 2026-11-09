import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { useLocation } from "@/lib/router-compat";
import { useProject, useProjects } from "@/hooks/useProjects";
import { useUserBoards } from "@/hooks/useUserBoards";
import InviteCollaboratorDialog from "./procurement/InviteCollaboratorDialog";
import { ProjectWorkspaceProvider, useProjectWorkspace } from "@/contexts/ProjectWorkspaceContext";

const InviteContext = createContext<((projectId: string | null) => void) | null>(null);
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
  const [request, setRequest] = useState<{ projectId: string | null; key: number } | null>(null);
  const resolveProjectId = useCallback((quoteProjectId: string | null) => {
    let activeProjectId = new URLSearchParams(location.search).get("project");
    if (!activeProjectId) {
      try { activeProjectId = sessionStorage.getItem("trade:lastProjectFilter"); } catch { /* No active folder. */ }
    }
    // A saved quote's association wins over an unrelated browsing filter.
    return quoteProjectId || activeFolder?.projectId || activeProjectId || null;
  }, [location.search, activeFolder?.projectId]);
  const openInvite = useCallback((quoteProjectId: string | null) => {
    setRequest({ projectId: resolveProjectId(quoteProjectId), key: Date.now() });
  }, [resolveProjectId]);
  return <InviteDefaultContext.Provider value={resolveProjectId}><InviteContext.Provider value={openInvite}>
    {children}
    {request && <ProjectClientInvitation key={request.key} projectId={request.projectId} onClose={() => setRequest(null)} />}
  </InviteContext.Provider></InviteDefaultContext.Provider>;
}

function ProjectClientInvitation({ projectId, onClose }: { projectId: string | null; onClose: () => void }) {
  const [selectedProjectId, setSelectedProjectId] = useState(projectId);
  const { projects, loading: projectsLoading } = useProjects({ activeOnly: false });
  const { project, loading: projectLoading } = useProject(selectedProjectId || undefined);
  const { boards, loading, error } = useUserBoards(Boolean(selectedProjectId), selectedProjectId, true);
  const projectBoards = boards.filter(board => board.project_id === selectedProjectId);
  const ready = Boolean(selectedProjectId && project?.id === selectedProjectId && !projectLoading && !error);
  const projectOptions = project?.id === selectedProjectId && !projects.some(option => option.id === project.id) ? [project, ...projects] : projects;
  return <InviteCollaboratorDialog open onOpenChange={open => { if (!open) onClose(); }} boardId=""
    projectId={ready ? selectedProjectId || undefined : undefined} projectName={project?.id === selectedProjectId ? project.name : undefined}
    projectOptions={projectOptions} selectedProjectId={selectedProjectId || ""} projectsLoading={projectsLoading} onProjectChange={setSelectedProjectId}
    boardOptions={ready ? projectBoards : []} boardsLoading={loading || projectLoading} workspaceInvite clientWorkspace
    readOnly onInvited={() => {}} />;
}