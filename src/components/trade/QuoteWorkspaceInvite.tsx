import { useState } from "react";
import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserBoards } from "@/hooks/useUserBoards";
import InviteCollaboratorDialog from "./procurement/InviteCollaboratorDialog";

export default function QuoteWorkspaceInvite({ projectId }: { projectId: string | null }) {
  const [open, setOpen] = useState(false);
  const { boards, loading, error } = useUserBoards(open && Boolean(projectId), projectId);
  const projectBoards = boards.filter(board => projectId && board.project_id === projectId);
  return <>
    <Button variant="outline" className="h-auto min-h-10 w-full cursor-pointer whitespace-normal rounded-none border-border bg-transparent px-3 py-2 font-body text-[11px] font-normal uppercase tracking-normal text-foreground hover:bg-muted" onClick={() => setOpen(true)}>
      <UserPlus className="h-3.5 w-3.5 shrink-0" /> Add Client to Project
    </Button>
    {error && open && <p role="alert" className="font-body text-xs text-destructive">Project boards could not be loaded. Close and try again.</p>}
    <InviteCollaboratorDialog key={projectId || "unassigned"} open={open} onOpenChange={setOpen} boardId="" projectId={projectId || undefined} boardOptions={projectBoards} boardsLoading={loading} workspaceInvite readOnly onInvited={() => {}} />
  </>;
}