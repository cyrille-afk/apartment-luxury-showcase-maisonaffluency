import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Building2, Mail, Trash2, UserPlus, Users, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useStudio, StudioRole } from "@/hooks/useStudio";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface Member {
  id: string;
  user_id: string;
  role: StudioRole;
  joined_at: string;
  profile?: { email: string | null; first_name: string | null; last_name: string | null };
}

interface Invite {
  id: string;
  email: string;
  role: StudioRole;
  created_at: string;
  expires_at: string;
  accepted_at: string | null;
}

const ROLE_DESC: Record<StudioRole, string> = {
  owner: "Full control including billing & deletion",
  admin: "Manage members and all studio content",
  editor: "Create and edit projects, quotes, boards",
  viewer: "Read-only access",
};

export default function TradeStudioSettings() {
  const { user } = useAuth();
  const { currentStudio, refresh: refreshStudios, isAdmin, isOwner } = useStudio();
  const { toast } = useToast();
  const [params, setParams] = useSearchParams();

  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<StudioRole>("editor");
  const [inviting, setInviting] = useState(false);

  const [newStudioOpen, setNewStudioOpen] = useState(params.get("new") === "1");
  const [newStudioName, setNewStudioName] = useState("");
  const [creatingStudio, setCreatingStudio] = useState(false);

  const [studioName, setStudioName] = useState("");

  useEffect(() => {
    if (currentStudio) setStudioName(currentStudio.name);
  }, [currentStudio?.id]);

  const fetchData = async () => {
    if (!currentStudio) return;
    setLoading(true);

    const [{ data: memberRows }, { data: inviteRows }] = await Promise.all([
      supabase
        .from("studio_members")
        .select("id, user_id, role, joined_at")
        .eq("studio_id", currentStudio.id)
        .order("joined_at"),
      supabase
        .from("studio_invites")
        .select("id, email, role, created_at, expires_at, accepted_at")
        .eq("studio_id", currentStudio.id)
        .is("accepted_at", null)
        .order("created_at", { ascending: false }),
    ]);

    if (memberRows) {
      const userIds = memberRows.map((m) => m.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, first_name, last_name")
        .in("id", userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? []);
      setMembers(
        memberRows.map((m) => ({
          ...m,
          role: m.role as StudioRole,
          profile: profileMap.get(m.user_id) as any,
        }))
      );
    }
    if (inviteRows) setInvites(inviteRows.map((i) => ({ ...i, role: i.role as StudioRole })));
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [currentStudio?.id]);

  const handleInvite = async () => {
    if (!currentStudio || !inviteEmail.trim() || !user) return;
    setInviting(true);
    const { error } = await supabase.from("studio_invites").insert({
      studio_id: currentStudio.id,
      email: inviteEmail.trim().toLowerCase(),
      role: inviteRole,
      invited_by: user.id,
    });
    setInviting(false);

    if (error) {
      toast({ title: "Invite failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: "Invite created",
      description: `${inviteEmail} will be added to ${currentStudio.name} when they sign up or sign in.`,
    });
    setInviteEmail("");
    setInviteRole("editor");
    fetchData();
  };

  const handleChangeRole = async (memberId: string, newRole: StudioRole) => {
    const { error } = await supabase
      .from("studio_members")
      .update({ role: newRole })
      .eq("id", memberId);
    if (error) {
      toast({ title: "Update failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!confirm("Remove this member from the studio?")) return;
    const { error } = await supabase.from("studio_members").delete().eq("id", memberId);
    if (error) {
      toast({ title: "Remove failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handleRevokeInvite = async (inviteId: string) => {
    const { error } = await supabase.from("studio_invites").delete().eq("id", inviteId);
    if (error) {
      toast({ title: "Revoke failed", description: error.message, variant: "destructive" });
      return;
    }
    fetchData();
  };

  const handleSaveName = async () => {
    if (!currentStudio || !studioName.trim()) return;
    const { error } = await supabase
      .from("studios")
      .update({ name: studioName.trim() })
      .eq("id", currentStudio.id);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Studio updated" });
    refreshStudios();
  };

  const handleCreateStudio = async () => {
    if (!newStudioName.trim() || !user) return;
    setCreatingStudio(true);
    const { data, error } = await supabase
      .from("studios")
      .insert({ name: newStudioName.trim(), created_by: user.id })
      .select()
      .single();
    if (error || !data) {
      setCreatingStudio(false);
      toast({ title: "Could not create studio", description: error?.message, variant: "destructive" });
      return;
    }
    await supabase.from("studio_members").insert({
      studio_id: data.id,
      user_id: user.id,
      role: "owner",
    });
    setCreatingStudio(false);
    setNewStudioOpen(false);
    setNewStudioName("");
    setParams({});
    refreshStudios();
    toast({ title: "Studio created", description: data.name });
  };

  if (!currentStudio) {
    return (
      <div className="max-w-3xl mx-auto py-12 text-center">
        <Building2 className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
        <h1 className="text-2xl font-display mb-2">No studio yet</h1>
        <p className="text-muted-foreground mb-6">
          Create your first studio to start collaborating with your team.
        </p>
        <Button onClick={() => setNewStudioOpen(true)}>
          <Plus className="h-4 w-4 mr-2" /> Create studio
        </Button>
        <CreateStudioDialog
          open={newStudioOpen}
          onOpenChange={setNewStudioOpen}
          name={newStudioName}
          setName={setNewStudioName}
          onSubmit={handleCreateStudio}
          creating={creatingStudio}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-display tracking-tight">Studio Settings</h1>
        <p className="text-muted-foreground">Manage your studio, members, and invitations.</p>
      </div>

      {/* Studio details */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Building2 className="h-5 w-5" /> Studio details
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="studio-name">Studio name</Label>
            <div className="flex gap-2 mt-1.5">
              <Input
                id="studio-name"
                value={studioName}
                onChange={(e) => setStudioName(e.target.value)}
                disabled={!isAdmin}
              />
              <Button onClick={handleSaveName} disabled={!isAdmin || studioName === currentStudio.name}>
                Save
              </Button>
            </div>
          </div>
          <div className="text-xs text-muted-foreground">
            Your role: <Badge variant="secondary" className="ml-1">{currentStudio.role}</Badge>
          </div>
        </CardContent>
      </Card>

      {/* Members */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Users className="h-5 w-5" /> Members ({members.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <div className="divide-y">
              {members.map((m) => {
                const isCurrentUser = m.user_id === user?.id;
                const displayName =
                  [m.profile?.first_name, m.profile?.last_name].filter(Boolean).join(" ") ||
                  m.profile?.email ||
                  "Unknown";
                const canEditThisMember = isAdmin && !isCurrentUser && m.role !== "owner";
                return (
                  <div key={m.id} className="py-3 flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="font-medium truncate">
                        {displayName} {isCurrentUser && <span className="text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground truncate">{m.profile?.email}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {canEditThisMember ? (
                        <Select value={m.role} onValueChange={(v) => handleChangeRole(m.id, v as StudioRole)}>
                          <SelectTrigger className="w-32 h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">Admin</SelectItem>
                            <SelectItem value="editor">Editor</SelectItem>
                            <SelectItem value="viewer">Viewer</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="secondary" className="capitalize">{m.role}</Badge>
                      )}
                      {canEditThisMember && (
                        <Button variant="ghost" size="icon" onClick={() => handleRemoveMember(m.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invite */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" /> Invite a teammate
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Input
                type="email"
                placeholder="teammate@studio.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1"
              />
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as StudioRole)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
                <Mail className="h-4 w-4 mr-2" />
                Send invite
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {ROLE_DESC[inviteRole]}. They'll auto-join the studio when they sign up or next sign in with this email.
            </p>

            {invites.length > 0 && (
              <div className="mt-4">
                <div className="text-sm font-medium mb-2">Pending invites</div>
                <div className="divide-y border rounded-md">
                  {invites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between p-3">
                      <div className="min-w-0">
                        <div className="text-sm truncate">{inv.email}</div>
                        <div className="text-xs text-muted-foreground">
                          {inv.role} • expires {new Date(inv.expires_at).toLocaleDateString()}
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleRevokeInvite(inv.id)}>
                        Revoke
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Create new studio */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Need another studio?</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => setNewStudioOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create new studio
          </Button>
        </CardContent>
      </Card>

      <CreateStudioDialog
        open={newStudioOpen}
        onOpenChange={setNewStudioOpen}
        name={newStudioName}
        setName={setNewStudioName}
        onSubmit={handleCreateStudio}
        creating={creatingStudio}
      />
    </div>
  );
}

function CreateStudioDialog({
  open,
  onOpenChange,
  name,
  setName,
  onSubmit,
  creating,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  setName: (v: string) => void;
  onSubmit: () => void;
  creating: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a studio</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="new-studio-name">Studio name</Label>
          <Input
            id="new-studio-name"
            placeholder="e.g. Atelier Lumière"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <p className="text-xs text-muted-foreground">
            You'll be the Owner. You can rename, invite teammates, and assign per-project roles later.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={onSubmit} disabled={!name.trim() || creating}>
            {creating ? "Creating…" : "Create studio"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
