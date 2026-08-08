"use client";

import * as React from "react";
import {
  MoreHorizontal,
  MailCheck,
  UserPlus,
  Shield,
  Trash2,
  Copy,
  Check,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/shared/empty-state";
import { toast } from "sonner";
import { initials, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import type { TeamMember } from "@/lib/types";

const roles = ["Owner", "Admin", "Manager", "Viewer"] as const;
type Role = (typeof roles)[number];

interface MemberResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: "active" | "invited";
  lastActive?: string;
  invitedAt?: string;
}

export default function TeamSettingsPage() {
  const me = useAuthStore((s) => s.user);
  const [members, setMembers] = React.useState<TeamMember[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<Role>("Manager");
  const [inviteOpen, setInviteOpen] = React.useState(false);
  const [removeTarget, setRemoveTarget] = React.useState<{ id: string; name: string } | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ members: MemberResponse[] }>("/api/v1/workspace/members");
      setMembers(
        (res.members ?? []).map((m) => ({
          id: m.id,
          name: m.name || m.email,
          email: m.email,
          role: m.role,
          status: m.status,
          lastActive: m.lastActive,
          invitedAt: m.invitedAt,
        }))
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load team members");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const run = async () => {
      await load();
    };
    run();
  }, [load]);

  const changeRole = async (id: string, role: Role) => {
    setWorking(id);
    try {
      await api.patch(`/api/v1/workspace/members/${id}`, { role: role.toLowerCase() });
      toast.success("Role updated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update role");
    } finally {
      setWorking(null);
    }
  };

  const removeMember = async (id: string, name: string) => {
    setWorking(id);
    try {
      await api.delete(`/api/v1/workspace/members/${id}`);
      toast.success(`Removed ${name} from the workspace`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove member");
    } finally {
      setWorking(null);
    }
  };

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return;
    setWorking("invite");
    try {
      await api.post("/api/v1/workspace/members/invite", {
        email: inviteEmail.trim(),
        role: inviteRole.toLowerCase(),
      });
      setInviteEmail("");
      setInviteOpen(false);
      toast.success(`Invite sent to ${inviteEmail}`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send invite");
    } finally {
      setWorking(null);
    }
  };

  const resendInvite = async (member: TeamMember) => {
    try {
      await api.post(`/api/v1/workspace/members/${member.id}/resend`, {});
      toast.success(`Invite resent to ${member.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not resend invite");
    }
  };

  const sendReminder = async (member: TeamMember) => {
    try {
      await api.post(`/api/v1/workspace/members/${member.id}/remind`, {});
      toast.success(`Reminder sent to ${member.email}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send reminder");
    }
  };

  const isMe = (member: TeamMember) => me?.id === member.id;

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Team members</CardTitle>
              <CardDescription>
                {loading ? "Loading members…" : `${members.length} members · manage access to your workspace.`}
              </CardDescription>
            </div>
            <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <UserPlus /> Invite member
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Invite a teammate</DialogTitle>
                  <DialogDescription>
                    They&apos;ll get an email with a link to join your workspace.
                  </DialogDescription>
                </DialogHeader>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-email">Email address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="teammate@company.com"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as Role)}>
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter((r) => r !== "Owner").map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
                    <p className="text-muted-foreground text-xs leading-relaxed">
                      <span className="font-medium text-foreground">Manager</span> can create
                      and send campaigns. <span className="font-medium text-foreground">Viewer</span>{" "}
                      can only read. <span className="font-medium text-foreground">Admin</span> has
                      full access including billing.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={sendInvite} disabled={!inviteEmail.trim() || working !== null}>
                    {working === "invite" ? <Loader2 className="animate-spin" /> : <MailCheck />}
                    Send invite
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col gap-3 p-6">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : members.length === 0 ? (
            <EmptyState
              title="No team members yet"
              description="Invite teammates to collaborate on campaigns."
              actionLabel="Invite member"
              onAction={() => setInviteOpen(true)}
              icon={UserPlus}
              compact
            />
          ) : (
            <div className="divide-y">
              {members.map((member) => (
                <div key={member.id} className="hover:bg-muted/40 flex items-center gap-4 px-5 py-4 transition-colors">
                  <Avatar className="size-10">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {member.name ? initials(member.name.split(" ")[0], member.name.split(" ")[1]) : member.email.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium">{member.name}</p>
                      {isMe(member) && <Badge variant="outline">You</Badge>}
                      {member.role === "Owner" && (
                        <Badge variant="outline" className="gap-1">
                          <Shield className="size-3" /> Owner
                        </Badge>
                      )}
                    </div>
                    <p className="text-muted-foreground truncate text-xs">{member.email}</p>
                  </div>
                  {member.status === "invited" ? (
                    <Badge variant="warning" className="hidden sm:inline-flex">
                      Invited
                    </Badge>
                  ) : (
                    <span className="text-muted-foreground hidden text-xs md:block">
                      Active {member.lastActive ? timeAgo(member.lastActive) : ""}
                    </span>
                  )}
                  {member.role !== "Owner" ? (
                    <Select
                      value={member.role}
                      onValueChange={(v) => changeRole(member.id, v as Role)}
                    >
                      <SelectTrigger className="h-8 w-28" disabled={working === member.id}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.filter((r) => r !== "Owner").map((role) => (
                          <SelectItem key={role} value={role}>
                            {role}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <span className="w-28" />
                  )}
                  {!isMe(member) && member.role !== "Owner" && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${member.name}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>{member.name}</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        {member.status === "invited" ? (
                          <DropdownMenuItem className="cursor-pointer" onClick={() => resendInvite(member)}>
                            <Copy /> Resend invite
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem className="cursor-pointer" onClick={() => sendReminder(member)}>
                            <MailCheck /> Send reminder
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => setRemoveTarget({ id: member.id, name: member.name })}
                        >
                          <Trash2 /> Remove member
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role permissions</CardTitle>
          <CardDescription>What each role can do in the workspace.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground border-b text-left text-xs">
                  <th className="px-5 py-3 font-medium">Permission</th>
                  {roles.map((role) => (
                    <th key={role} className="px-4 py-3 text-center font-medium">
                      {role}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y">
                {[
                  { label: "View campaigns & reports", values: [true, true, true, true] },
                  { label: "Create & edit campaigns", values: [true, true, true, false] },
                  { label: "Send campaigns", values: [true, true, false, false] },
                  { label: "Manage contacts & segments", values: [true, true, true, false] },
                  { label: "Manage templates & automations", values: [true, true, true, false] },
                  { label: "Manage team & billing", values: [true, true, false, false] },
                  { label: "Delete workspace", values: [true, false, false, false] },
                ].map((row) => (
                  <tr key={row.label} className="hover:bg-muted/30">
                    <td className="px-5 py-2.5">{row.label}</td>
                    {row.values.map((allowed, i) => (
                      <td key={i} className="px-4 py-2.5 text-center">
                        {allowed ? (
                          <span className="bg-success/15 text-success mx-auto flex size-5 items-center justify-center rounded-full">
                            <Check className="size-3" />
                          </span>
                        ) : (
                          <span className="mx-auto flex size-1.5 rounded-full bg-border" />
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <AlertDialog
        open={!!removeTarget}
        onOpenChange={(open) => !open && setRemoveTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this member?</AlertDialogTitle>
            <AlertDialogDescription>
              {removeTarget?.name} will immediately lose access to this workspace and all of
              its contacts, campaigns and templates. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={working !== null}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={working !== null}
              onClick={() => removeTarget && removeMember(removeTarget.id, removeTarget.name)}
            >
              <Trash2 /> Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
