"use client";

import * as React from "react";
import {
  Camera,
  Mail,
  MapPin,
  Globe,
  Building2,
  Check,
  Upload,
  Save,
  Store,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function ProfileSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get<{ workspace: { id: string; name: string } }>("/api/v1/workspace");
        setWorkspaceName(res.workspace?.name ?? "");
      } catch {
        // Keep the input editable; the save action will surface errors.
      }
    };
    run();
  }, []);

  React.useEffect(() => {
    const run = async () => {
      if (user) {
        setName(user.name);
        setEmail(user.email);
      }
    };
    run();
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("Name cannot be empty");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<{ user: { id: string; name: string; email: string; role: string } }>(
        "/api/v1/me",
        { name: name.trim() }
      );
      setUser(res.user);
      setSaved(true);
      toast.success("Profile updated");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile");
    } finally {
      setSaving(false);
    }
  };

  const saveWorkspace = async () => {
    if (!workspaceName.trim()) {
      toast.error("Workspace name cannot be empty");
      return;
    }
    setWorkspaceSaving(true);
    try {
      await api.patch("/api/v1/workspace", { name: workspaceName.trim() });
      toast.success("Workspace updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update workspace");
    } finally {
      setWorkspaceSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/15 text-primary text-lg">
                {initials(name.split(" ")[0], name.split(" ")[1])}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle>{name || "Your profile"}</CardTitle>
              <CardDescription>{user?.role ? `${user.role} · ${user.email}` : email}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info("Photo upload is coming soon")}>
                <Upload /> Upload
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove photo"
                onClick={() => toast.info("Photo upload is coming soon")}
              >
                <Camera />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="sm:w-96" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input id="email" value={email} disabled className="pl-9 sm:w-96" />
            </div>
            <p className="text-muted-foreground text-xs">
              Used for logins and notifications. Your login email can be changed in Security.
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Select defaultValue="utc1">
              <SelectTrigger id="timezone" className="w-full sm:w-72">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc1">UTC+1 · Central European Time</SelectItem>
                <SelectItem value="utc0">UTC · London</SelectItem>
                <SelectItem value="utc-5">UTC-5 · Eastern Time</SelectItem>
                <SelectItem value="utc-8">UTC-8 · Pacific Time</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bio">Bio</Label>
            <Textarea
              id="bio"
              placeholder="A short bio shown to your team…"
              className="min-h-20 sm:w-[30rem]"
            />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}
              {saving ? "Saving…" : saved ? "Saved" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="text-primary size-4" /> Workspace details
          </CardTitle>
          <CardDescription>This information appears on your emails and invoices.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <span className="bg-secondary text-secondary-foreground flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
              AC
            </span>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info("Logo upload is coming soon")}>
                <Upload /> Upload logo
              </Button>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => toast.info("Logo upload is coming soon")}>
                Remove
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input
                id="workspace-name"
                value={workspaceName}
                onChange={(e) => setWorkspaceName(e.target.value)}
                placeholder="Your workspace name"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-slug">Workspace URL</Label>
              <div className="relative">
                <Globe className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                <Input id="workspace-slug" defaultValue="acme.mailgeko.dev" className="pl-9 font-mono text-sm" />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="address">Address</Label>
            <div className="relative">
              <MapPin className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input id="address" defaultValue="100 Market St, Suite 300, San Francisco, CA" className="pl-9" />
            </div>
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={saveWorkspace} disabled={workspaceSaving}>
              {workspaceSaving ? <Loader2 className="animate-spin" /> : <Save />}
              {workspaceSaving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="text-primary size-4" /> Sending defaults
          </CardTitle>
          <CardDescription>Applied to every new campaign you create.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="from-name">Default &quot;From&quot; name</Label>
            <Input id="from-name" defaultValue="Grace Lee" className="sm:w-72" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="from-email">Default &quot;From&quot; email</Label>
            <Input id="from-email" defaultValue="hello@mailgeko.dev" className="sm:w-72" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reply-email">Default reply-to</Label>
            <Input id="reply-email" defaultValue="support@mailgeko.dev" className="sm:w-72" />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Always track opens</p>
              <p className="text-muted-foreground text-xs">
                Adds an invisible pixel to measure engagement.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div>
              <p className="text-sm font-medium">Always track clicks</p>
              <p className="text-muted-foreground text-xs">
                Wraps links to record click-throughs.
              </p>
            </div>
            <Switch defaultChecked />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" onClick={() => toast.info("Sending defaults are coming soon")}>
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
