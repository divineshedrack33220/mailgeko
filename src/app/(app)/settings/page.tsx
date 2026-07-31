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

export default function ProfileSettingsPage() {
  const [saved, setSaved] = React.useState(false);

  const handleSave = () => {
    setSaved(true);
    toast.success("Profile updated");
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-4">
            <Avatar className="size-16">
              <AvatarFallback className="bg-primary/15 text-primary text-lg">GL</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <CardTitle>Grace Lee</CardTitle>
              <CardDescription>Owner at Acme Corp</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => toast.info("Photo upload is coming soon")}>
                <Upload /> Upload
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove photo"
                onClick={() => toast.success("Photo removed")}
              >
                <Camera />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="first-name">First name</Label>
              <Input id="first-name" defaultValue="Grace" />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="last-name">Last name</Label>
              <Input id="last-name" defaultValue="Lee" />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="email">Email address</Label>
            <div className="relative">
              <Mail className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input id="email" defaultValue="grace@mailgeko.dev" className="pl-9" />
            </div>
            <p className="text-muted-foreground text-xs">
              Used for logins and notifications. Your login email can be
              changed in Security.
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
              defaultValue="I run marketing at Acme Corp. Coffee first, campaigns second."
              className="min-h-20"
            />
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleSave}>
              {saved ? <Check /> : <Save />}
              {saved ? "Saved" : "Save changes"}
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
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => toast.success("Logo removed")}>
                Remove
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="workspace-name">Workspace name</Label>
              <Input id="workspace-name" defaultValue="Acme Corp" />
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
            <Button onClick={handleSave}>
              {saved ? <Check /> : <Save />}
              {saved ? "Saved" : "Save changes"}
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
            <Button onClick={handleSave}>
              {saved ? <Check /> : <Save />}
              {saved ? "Saved" : "Save changes"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
