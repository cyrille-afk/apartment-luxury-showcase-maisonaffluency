import { UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCollaboratorInvite } from "./CollaboratorInviteProvider";

export default function QuoteWorkspaceInvite({ projectId }: { projectId: string | null }) {
  const openInvite = useCollaboratorInvite();
  return <Button variant="outline" disabled={!openInvite} className="h-auto min-h-10 w-full cursor-pointer whitespace-normal rounded-none border-border bg-transparent px-3 py-2 font-body text-[11px] font-normal uppercase tracking-normal text-foreground hover:bg-muted" onClick={() => openInvite?.(projectId)}>
      <UserPlus className="h-3.5 w-3.5 shrink-0" /> Add Client to Project
    </Button>;
}