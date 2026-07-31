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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { initials, timeAgo } from "@/lib/format";
import { teamMembers } from "@/lib/mock";

const roles = ["Owner", "Admin", "Manager", "Viewer"] as const;

export default function TeamSettingsPage() {
  const [members, setMembers] = React.useState(teamMembers);
  const [inviteEmail, setInviteEmail] = React.useState("");
  const [inviteRole, setInviteRole] = React.useState<(typeof roles)[number]>("Manager");

  const changeRole = (id: string, role: (typeof roles)[number]) => {
    setMembers((prev) => prev.map((m) => (m.id === id ? { ...m, role } : m)));
    toast.success("Role updated");
  };

  const removeMember = (id: string, name: string) => {
    setMembers((prev) => prev.filter((m) => m.id !== id));
    toast.success(`Removed ${name} from the workspace`);
  };

  const sendInvite = () => {
    if (!inviteEmail.trim()) return;
    setMembers((prev) => [
      ...prev,
      {
        id: `u-${Date.now()}`,
        name: inviteEmail.split("@")[0],
        email: inviteEmail.trim(),
        role: inviteRole,
        status: "invited",
        twoFactorEnabled: false,
      },
    ]);
    setInviteEmail("");
    toast.success(`Invite sent to ${inviteEmail}`);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle>Team members</CardTitle>
              <CardDescription>
                {members.length} members · manage access to your workspace.
              </CardDescription>
            </div>
            <Dialog>
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
                    <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as (typeof roles)[number])}>
                      <SelectTrigger id="invite-role">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map((role) => (
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
                  <Button onClick={sendInvite} disabled={!inviteEmail.trim()}>
                    <MailCheck /> Send invite
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {members.map((member) => (
              <div key={member.id} className="hover:bg-muted/40 flex items-center gap-4 px-5 py-4 transition-colors">
                <Avatar className="size-10">
                  <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials(member.name.split(" ")[0], member.name.split(" ")[1])}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium">{member.name}</p>
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
                    Active {timeAgo(member.lastActive ?? "")}
                  </span>
                )}
                {member.role !== "Owner" ? (
                  <Select
                    defaultValue={member.role}
                    onValueChange={(v) => changeRole(member.id, v as (typeof roles)[number])}
                  >
                    <SelectTrigger className="h-8 w-28">
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
                {member.role !== "Owner" && (
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
                        <DropdownMenuItem className="cursor-pointer" onClick={() => toast.success(`Invite resent to ${member.email}`)}>
                          <Copy /> Resend invite
                        </DropdownMenuItem>
                      ) : (
                        <DropdownMenuItem className="cursor-pointer" onClick={() => toast.success(`Reminder sent to ${member.email}`)}>
                          <MailCheck /> Send reminder
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => removeMember(member.id, member.name)}
                      >
                        <Trash2 /> Remove member
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}
          </div>
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
    </div>
  );
}
