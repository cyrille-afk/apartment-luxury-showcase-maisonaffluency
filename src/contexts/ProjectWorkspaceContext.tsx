import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type WorkspaceContactState = { primaryContact: string; collaborators: string[] };
export type ProjectWorkspaceState = WorkspaceContactState & { folders: Record<string, WorkspaceContactState> };
export type ActiveWorkspaceFolder = { projectId: string; folderId: string };
type Invitation = { key: number; projectId: string; folderId: string; email: string };
type WorkspaceContextValue = {
  activeFolder: ActiveWorkspaceFolder | null;
  setActiveFolder: (folder: ActiveWorkspaceFolder | null) => void;
  projects: Record<string, ProjectWorkspaceState>;
  submitClientInvitation: (projectId: string, folderId: string, email: string) => () => void;
};
const Context = createContext<WorkspaceContextValue | null>(null);
export const useProjectWorkspace = () => useContext(Context);

export function ProjectWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeFolder, setActiveFolder] = useState<ActiveWorkspaceFolder | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const sequence = useRef(0);
  const submitClientInvitation = useCallback((projectId: string, folderId: string, email: string) => {
    const key = ++sequence.current;
    const normalized = email.trim();
    setInvitations(current => [...current, { key, projectId, folderId, email: normalized }]);
    // Remove only this attempt: a failed request cannot undo a newer invitation.
    return () => setInvitations(current => current.filter(invitation => invitation.key !== key));
  }, []);
  const projects = useMemo(() => {
    const result: Record<string, ProjectWorkspaceState> = {};
    const append = (emails: string[], email: string) => emails.some(value => value.toLowerCase() === email.toLowerCase()) ? emails : [...emails, email];
    for (const { projectId, folderId, email } of invitations) {
      const project = result[projectId] || { primaryContact: "", collaborators: [], folders: {} };
      const folder = project.folders[folderId] || { primaryContact: "", collaborators: [] };
      result[projectId] = {
        primaryContact: email,
        collaborators: append(project.collaborators, email),
        folders: { ...project.folders, [folderId]: { primaryContact: email, collaborators: append(folder.collaborators, email) } },
      };
    }
    return result;
  }, [invitations]);
  return <Context.Provider value={{ projects, submitClientInvitation, activeFolder, setActiveFolder }}>{children}</Context.Provider>;
}