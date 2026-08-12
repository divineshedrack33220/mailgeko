"use client";

import * as React from "react";
import {
  Mail,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { initials } from "@/lib/format";
import { roleLabel } from "@/lib/permissions";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";

export default function ProfileSettingsPage() {
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const setUser = useAuthStore((s) => s.setUser);
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [logoUrl, setLogoUrl] = React.useState("");
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [fromName, setFromName] = React.useState("");
  const [fromEmail, setFromEmail] = React.useState("");
  const [replyTo, setReplyTo] = React.useState("");
  const [workspaceSaving, setWorkspaceSaving] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [sendingSaving, setSendingSaving] = React.useState(false);
  const [uploadingAvatar, setUploadingAvatar] = React.useState(false);
  const [uploadingLogo, setUploadingLogo] = React.useState(false);
  const avatarInputRef = React.useRef<HTMLInputElement>(null);
  const logoInputRef = React.useRef<HTMLInputElement>(null);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    const run = async () => {
      try {
        const res = await api.get<{
          workspace: { id: string; name: string; fromName?: string; fromEmail?: string; replyTo?: string; logoUrl?: string };
        }>("/api/v1/workspace");
        setWorkspaceName(res.workspace?.name ?? "");
        setFromName(res.workspace?.fromName ?? "");
        setFromEmail(res.workspace?.fromEmail ?? "");
        setReplyTo(res.workspace?.replyTo ?? "");
        setLogoUrl(res.workspace?.logoUrl ?? "");
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
        setAvatarUrl(user.avatarUrl ?? "");
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

  const saveSending = async () => {
    setSendingSaving(true);
    try {
      const payload: Record<string, string> = {
        fromName: fromName.trim(),
        fromEmail: fromEmail.trim(),
        replyTo: replyTo.trim(),
      };
      if (workspaceName.trim()) payload.name = workspaceName.trim();
      await api.patch("/api/v1/workspace", payload);
      toast.success("Sending defaults saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save sending defaults");
    } finally {
      setSendingSaving(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const res = await api.upload<{ avatarUrl: string }>("/api/v1/me/avatar", file);
      setAvatarUrl(res.avatarUrl);
      if (user) setUser({ ...user, avatarUrl: res.avatarUrl });
      toast.success("Profile photo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload photo");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingLogo(true);
    try {
      const res = await api.upload<{ logoUrl: string }>("/api/v1/workspace/logo", file);
      setLogoUrl(res.logoUrl);
      toast.success("Workspace logo updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not upload logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-16">
              {avatarUrl ? (
                <AvatarImage src={avatarUrl} alt={name} />
              ) : (
                <AvatarFallback className="bg-primary/15 text-primary text-lg">
                  {initials(name.split(" ")[0], name.split(" ")[1])}
                </AvatarFallback>
              )}
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle>{name || "Your profile"}</CardTitle>
              <CardDescription>
                {role ? `${roleLabel(role)} · ${user?.email ?? email}` : email}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleAvatarUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
              >
                {uploadingAvatar ? <Loader2 className="animate-spin" /> : <Upload />} Upload
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
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt="Workspace logo"
                className="bg-secondary flex size-12 shrink-0 items-center justify-center rounded-xl object-contain"
              />
            ) : (
              <span className="bg-secondary text-secondary-foreground flex size-12 shrink-0 items-center justify-center rounded-xl text-sm font-bold">
                AC
              </span>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={logoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleLogoUpload}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => logoInputRef.current?.click()}
                disabled={uploadingLogo}
              >
                {uploadingLogo ? <Loader2 className="animate-spin" /> : <Upload />} Upload logo
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Your workspace name"
            />
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
            <Input id="from-name" value={fromName} onChange={(e) => setFromName(e.target.value)} className="sm:w-72" placeholder="e.g. Grace Lee" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="from-email">Default &quot;From&quot; email</Label>
            <Input id="from-email" value={fromEmail} onChange={(e) => setFromEmail(e.target.value)} className="sm:w-72" placeholder="hello@yourdomain.com" />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="reply-email">Default reply-to</Label>
            <Input id="reply-email" value={replyTo} onChange={(e) => setReplyTo(e.target.value)} className="sm:w-72" placeholder="support@yourdomain.com" />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button variant="outline" onClick={saveSending} disabled={sendingSaving}>
              {sendingSaving && <Loader2 className="animate-spin" />}
              Save changes
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
