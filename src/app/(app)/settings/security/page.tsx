"use client";

import * as React from "react";
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  Check,
  Lock,
  LogOut,
  Monitor,
  Globe,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { timeAgo } from "@/lib/format";
import { api } from "@/lib/api";

const activeSessions = [
  { id: "s-1", device: "Chrome on macOS", location: "San Francisco, US", current: true, lastActive: new Date().toISOString(), icon: Monitor },
  { id: "s-2", device: "Firefox on Windows", location: "Berlin, DE", current: false, lastActive: "2026-07-29T18:30:00Z", icon: Globe },
  { id: "s-3", device: "Mobile App on iOS", location: "Singapore, SG", current: false, lastActive: "2026-07-25T07:12:00Z", icon: Smartphone },
];

export default function SecuritySettingsPage() {
  const [twoFactor, setTwoFactor] = React.useState(true);
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [changing, setChanging] = React.useState(false);

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error("Enter your current password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }
    setChanging(true);
    try {
      await api.post("/api/v1/auth/password", {
        currentPassword,
        newPassword,
      });
      toast.success("Password updated");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update password");
    } finally {
      setChanging(false);
    }
  };

  const handleTwoFactor = (value: boolean) => {
    setTwoFactor(value);
    toast.info("Two-factor authentication is coming soon");
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="text-primary size-4" /> Password
          </CardTitle>
          <CardDescription>
            Your password is used to sign in on trusted devices.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="current-password">Current password</Label>
            <Input
              id="current-password"
              type="password"
              placeholder="••••••••••"
              className="sm:w-80"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="At least 8 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {["8+ characters", "Mixed case", "Number", "Symbol"].map((rule) => (
              <Badge key={rule} variant="secondary" className="gap-1">
                <Check className="size-3" /> {rule}
              </Badge>
            ))}
          </div>
          <Separator />
          <div className="flex justify-end">
            <Button onClick={handleChangePassword} disabled={changing}>
              {changing ? <Loader2 className="animate-spin" /> : <Lock />}
              {changing ? "Updating…" : "Update password"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Smartphone className="text-primary size-4" /> Two-factor authentication
          </CardTitle>
          <CardDescription>
            Require a verification code in addition to your password.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between rounded-lg border px-4 py-3">
            <div className="flex items-center gap-3">
              <span className={twoFactor ? "bg-success/15 text-success" : "bg-secondary text-secondary-foreground"}>
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Authenticator app</p>
                <p className="text-muted-foreground text-xs">
                  {twoFactor ? "Enabled — codes generated by your authenticator." : "Disabled — you'll only need your password."}
                </p>
              </div>
            </div>
            <Switch checked={twoFactor} onCheckedChange={handleTwoFactor} />
          </div>
          <div className="bg-muted/50 mt-3 rounded-lg border px-4 py-3">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Recovery codes: 5 remaining.{" "}
              <button className="text-primary font-medium hover:underline" onClick={() => toast.info("Two-factor authentication is coming soon")}>
                Generate new codes
              </button>
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Monitor className="text-primary size-4" /> Active sessions
              </CardTitle>
              <CardDescription>
                Devices currently signed into your account.
              </CardDescription>
            </div>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                  <LogOut /> Sign out all others
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-sm">
                <DialogHeader>
                  <DialogTitle>Sign out other sessions?</DialogTitle>
                  <DialogDescription>
                    This will revoke every session except this one. You&apos;ll stay
                    signed in on this device.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    className="text-destructive hover:text-destructive"
                    variant="outline"
                    onClick={() => toast.info("Session management is coming soon")}
                  >
                    <LogOut /> Sign out others
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            {activeSessions.map((session) => (
              <div key={session.id} className="hover:bg-muted/40 flex items-center gap-4 px-5 py-4 transition-colors">
                <span className="bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-lg">
                  <session.icon className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{session.device}</p>
                    {session.current && <Badge variant="success">This device</Badge>}
                  </div>
                  <p className="text-muted-foreground text-xs">
                    {session.location} · Active {timeAgo(session.lastActive)}
                  </p>
                </div>
                {!session.current && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => toast.info("Session management is coming soon")}
                  >
                    <LogOut /> Sign out
                  </Button>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
