import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";

export type WorkspaceClientProfile = {
  companyName?: string; clientName?: string; email?: string; phone?: string;
  corporateAddress?: { line1?: string; line2?: string; city?: string; region?: string; postalCode?: string; country?: string };
};
export type WorkspaceContactState = { primaryContact: string; collaborators: string[]; clientProfile?: WorkspaceClientProfile };
export type ProjectWorkspaceState = WorkspaceContactState & { folders: Record<string, WorkspaceContactState> };
export type ActiveWorkspaceFolder = { projectId: string; folderId: string };
type Invitation = { key: number; projectId: string; folderId: string; email: string };
type WorkspaceContextValue = {
  activeFolder: ActiveWorkspaceFolder | null;
  setActiveFolder: (folder: ActiveWorkspaceFolder | null) => void;
  projects: Record<string, ProjectWorkspaceState>;
  hydrateFolderContacts: (projectId: string, folderId: string, emails: string[], profile?: WorkspaceClientProfile) => void;
  submitClientInvitation: (projectId: string, folderId: string, email: string) => () => void;
};
const Context = createContext<WorkspaceContextValue | null>(null);
export const useProjectWorkspace = () => useContext(Context);

export function ProjectWorkspaceProvider({ children }: { children: ReactNode }) {
  const [activeFolder, setActiveFolder] = useState<ActiveWorkspaceFolder | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [savedContacts, setSavedContacts] = useState<Record<string, Record<string, string[]>>>({});
  const [profiles, setProfiles] = useState<Record<string, Record<string, WorkspaceClientProfile>>>({});
  const hydrateFolderContacts = useCallback((projectId: string, folderId: string, emails: string[], profile?: WorkspaceClientProfile) => {
    if (profile) setProfiles(current => {
      if (JSON.stringify(current[projectId]?.[folderId]) === JSON.stringify(profile)) return current;
      return { ...current, [projectId]: { ...current[projectId], [folderId]: profile } };
    });
    setSavedContacts(current => {
      if (JSON.stringify(current[projectId]?.[folderId]) === JSON.stringify(emails)) return current;
      return { ...current, [projectId]: { ...current[projectId], [folderId]: emails } };
    });
  }, []);
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
    for (const [projectId, folders] of Object.entries(savedContacts)) {
      const project: ProjectWorkspaceState = { primaryContact: "", collaborators: [], folders: {} };
      for (const [folderId, emails] of Object.entries(folders)) {
        project.folders[folderId] = { primaryContact: emails[0] || "", collaborators: emails, ...(profiles[projectId]?.[folderId] ? { clientProfile: profiles[projectId][folderId] } : {}) };
        project.primaryContact ||= emails[0] || "";
        for (const email of emails) project.collaborators = append(project.collaborators, email);
      }
      result[projectId] = project;
    }
    for (const { projectId, folderId, email } of invitations) {
      const project = result[projectId] || { primaryContact: "", collaborators: [], folders: {} };
      const folder = project.folders[folderId] || { primaryContact: "", collaborators: [] };
      result[projectId] = {
        primaryContact: email,
        collaborators: append(project.collaborators, email),
        folders: { ...project.folders, [folderId]: { ...folder, primaryContact: email, collaborators: append(folder.collaborators, email) } },
      };
    }
    return result;
  }, [invitations, savedContacts, profiles]);
  return <Context.Provider value={{ projects, submitClientInvitation, hydrateFolderContacts, activeFolder, setActiveFolder }}>{children}</Context.Provider>;
}