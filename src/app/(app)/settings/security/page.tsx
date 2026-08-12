"use client";

import * as React from "react";
import {
  ShieldCheck,
  KeyRound,
  Smartphone,
  Check,
  X,
  Lock,
  LogOut,
  Monitor,
  Globe,
  Loader2,
  Copy,
  Eye,
  EyeOff,
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
import { cn } from "@/lib/utils";

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
  qrPng: string;
}

interface SessionRow {
  tokenId: string;
  device: string;
  location: string;
  ip: string;
  issuedAt: string;
  lastSeen: string;
  current: boolean;
}

function sessionIcon(device: string) {
  if (/ios|android/i.test(device)) return Smartphone;
  if (/macos|windows|linux/i.test(device)) return Monitor;
  return Globe;
}

export default function SecuritySettingsPage() {
  const [currentPassword, setCurrentPassword] = React.useState("");
  const [newPassword, setNewPassword] = React.useState("");
  const [confirmPassword, setConfirmPassword] = React.useState("");
  const [showCurrentPassword, setShowCurrentPassword] = React.useState(false);
  const [showNewPassword, setShowNewPassword] = React.useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = React.useState(false);
  const [changing, setChanging] = React.useState(false);

  const [twoFactorEnabled, setTwoFactorEnabled] = React.useState(false);
  const [statusLoading, setStatusLoading] = React.useState(true);

  const [setupOpen, setSetupOpen] = React.useState(false);
  const [setupStep, setSetupStep] = React.useState<"scan" | "code" | "codes">("scan");
  const [setup, setSetup] = React.useState<SetupResponse | null>(null);
  const [setupCode, setSetupCode] = React.useState("");
  const [recoveryCodes, setRecoveryCodes] = React.useState<string[] | null>(null);

  const [disableOpen, setDisableOpen] = React.useState(false);
  const [disableCode, setDisableCode] = React.useState("");

  const [regenerateOpen, setRegenerateOpen] = React.useState(false);
  const [regenerateStep, setRegenerateStep] = React.useState<"confirm" | "codes">("confirm");

  const [sessions, setSessions] = React.useState<SessionRow[]>([]);
  const [sessionsLoading, setSessionsLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);

  const refreshSessions = React.useCallback(async () => {
    try {
      const res = await api.get<{ sessions: SessionRow[] }>("/api/v1/auth/sessions");
      setSessions(res.sessions);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load sessions");
    }
  }, []);

  React.useEffect(() => {
    let active = true;
    api
      .get<{ user: { twoFactorEnabled?: boolean } }>("/api/v1/me")
      .then((res) => {
        if (active) setTwoFactorEnabled(Boolean(res.user.twoFactorEnabled));
      })
      .catch(() => {})
      .finally(() => {
        if (active) setStatusLoading(false);
      });
    api
      .get<{ sessions: SessionRow[] }>("/api/v1/auth/sessions")
      .then((res) => {
        if (active) setSessions(res.sessions);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setSessionsLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

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

  const openSetup = async () => {
    setSetupOpen(true);
    setSetupStep("scan");
    setSetup(null);
    setSetupCode("");
    try {
      const res = await api.post<SetupResponse>("/api/v1/auth/2fa/setup");
      setSetup(res);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start setup");
      setSetupOpen(false);
    }
  };

  const confirmEnable = async () => {
    if (!/^\d{6}$/.test(setupCode)) {
      toast.error("Enter the 6-digit code from your authenticator");
      return;
    }
    setBusy(true);
    try {
      const res = await api.post<{ recoveryCodes: string[] }>("/api/v1/auth/2fa/enable", {
        code: setupCode,
      });
      setRecoveryCodes(res.recoveryCodes);
      setTwoFactorEnabled(true);
      setSetupStep("codes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  };

  const confirmDisable = async () => {
    if (!/^\d{6}$/.test(disableCode)) {
      toast.error("Enter the 6-digit code from your authenticator");
      return;
    }
    setBusy(true);
    try {
      await api.post("/api/v1/auth/2fa/disable", { code: disableCode });
      setTwoFactorEnabled(false);
      setDisableOpen(false);
      setDisableCode("");
      toast.success("Two-factor authentication disabled");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "That code didn't work");
    } finally {
      setBusy(false);
    }
  };

  const openRegenerate = () => {
    setRegenerateOpen(true);
    setRegenerateStep("confirm");
    setRecoveryCodes(null);
  };

  const regenerateCodes = async () => {
    setBusy(true);
    try {
      const res = await api.post<{ recoveryCodes: string[] }>("/api/v1/auth/2fa/recovery-codes");
      setRecoveryCodes(res.recoveryCodes);
      setRegenerateStep("codes");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not regenerate codes");
    } finally {
      setBusy(false);
    }
  };

  const copyCodes = () => {
    if (!recoveryCodes) return;
    navigator.clipboard
      .writeText(recoveryCodes.join("\n"))
      .then(() => toast.success("Recovery codes copied"))
      .catch(() => toast.error("Could not copy codes"));
  };

  const revokeSession = async (tokenId: string) => {
    try {
      await api.delete(`/api/v1/auth/sessions/${tokenId}`);
      toast.success("Session signed out");
      refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke session");
    }
  };

  const revokeAllSessions = async () => {
    try {
      await api.delete("/api/v1/auth/sessions");
      toast.success("Other sessions signed out");
      refreshSessions();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not revoke sessions");
    }
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
            <div className="relative sm:w-80">
              <Input
                id="current-password"
                type={showCurrentPassword ? "text" : "password"}
                placeholder="••••••••••"
                className="pr-9"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword((v) => !v)}
                className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                aria-label={showCurrentPassword ? "Hide password" : "Show password"}
              >
                {showCurrentPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-password">New password</Label>
              <div className="relative">
                <Input
                  id="new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="At least 8 characters"
                  className="pr-9"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  aria-label={showNewPassword ? "Hide password" : "Show password"}
                >
                  {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <div className="relative">
                <Input
                  id="confirm-password"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Repeat new password"
                  className="pr-9"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {[
              { label: "8+ characters", met: newPassword.length >= 8 },
              { label: "Mixed case", met: /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword) },
              { label: "Number", met: /[0-9]/.test(newPassword) },
              { label: "Symbol", met: /[^a-zA-Z0-9]/.test(newPassword) },
            ].map(({ label, met }) => (
              <Badge key={label} variant="secondary" className={`gap-1 ${met ? "text-green-600" : "text-muted-foreground"}`}>
                {met ? <Check className="size-3" /> : <X className="size-3" />} {label}
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
              <span
                className={
                  twoFactorEnabled
                    ? "bg-success/15 text-success"
                    : "bg-secondary text-secondary-foreground"
                }
              >
                <ShieldCheck className="size-5" />
              </span>
              <div>
                <p className="text-sm font-medium">Authenticator app</p>
                <p className="text-muted-foreground text-xs">
                  {twoFactorEnabled
                    ? "Enabled — codes generated by your authenticator."
                    : "Disabled — you'll only need your password."}
                </p>
              </div>
            </div>
            <Switch
              checked={twoFactorEnabled}
              disabled={statusLoading}
              onCheckedChange={(next) => (next ? openSetup() : setDisableOpen(true))}
            />
          </div>
          {twoFactorEnabled && (
            <div className="bg-muted/50 mt-3 rounded-lg border px-4 py-3">
              <div className="text-muted-foreground text-xs leading-relaxed">
                Recovery codes can get you back in if you lose your device.{" "}
                <button
                  className="text-primary font-medium hover:underline"
                  onClick={openRegenerate}
                >
                  Generate new codes
                </button>
              </div>
            </div>
          )}
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
            {sessions.filter((s) => !s.current).length > 0 && (
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
                      onClick={revokeAllSessions}
                    >
                      <LogOut /> Sign out others
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {sessionsLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="text-muted-foreground animate-spin" />
            </div>
          ) : sessions.length === 0 ? (
            <p className="text-muted-foreground px-5 py-6 text-sm">No active sessions.</p>
          ) : (
            <div className="divide-y">
              {sessions.map((session) => {
                const Icon = sessionIcon(session.device);
                return (
                  <div
                    key={session.tokenId}
                    className="hover:bg-muted/40 flex items-center gap-4 px-5 py-4 transition-colors"
                  >
                    <span className="bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-lg">
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium">{session.device}</p>
                        {session.current && <Badge variant="success">This device</Badge>}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {session.location} · Active {timeAgo(session.lastSeen)}
                      </p>
                    </div>
                    {!session.current && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={() => revokeSession(session.tokenId)}
                      >
                        <LogOut /> Sign out
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={setupOpen} onOpenChange={setSetupOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {setupStep === "codes" ? "Recovery codes" : "Set up two-factor authentication"}
            </DialogTitle>
            <DialogDescription>
              {setupStep === "scan" &&
                "Scan the QR code with your authenticator app, or enter the secret manually."}
              {setupStep === "code" &&
                "Enter the 6-digit code from your authenticator app to confirm."}
              {setupStep === "codes" &&
                "Save these recovery codes somewhere safe. Each can be used once to sign in."}
            </DialogDescription>
          </DialogHeader>

          {setupStep === "scan" && (
            <div className="flex flex-col items-center gap-3">
              {setup ? (
                <>
                  <div className="rounded-xl border p-3">
                    {setup.qrPng ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={setup.qrPng}
                        alt="Scan with your authenticator app"
                        className="size-44"
                      />
                    ) : (
                      <div className="text-muted-foreground flex size-44 items-center justify-center text-sm">
                        QR unavailable
                      </div>
                    )}
                  </div>
                  <div className="w-full rounded-lg bg-muted px-4 py-2">
                    <p className="text-muted-foreground text-center font-mono text-sm tracking-widest">
                      {setup.secret}
                    </p>
                  </div>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground text-xs"
                    onClick={() => {
                      navigator.clipboard
                        .writeText(setup.otpauthUrl)
                        .then(() => toast.success("Setup link copied"))
                        .catch(() => toast.error("Could not copy"));
                    }}
                  >
                    Copy setup link instead
                  </button>
                </>
              ) : (
                <Loader2 className="text-muted-foreground animate-spin" />
              )}
            </div>
          )}

          {setupStep === "code" && (
            <div className="flex flex-col gap-3">
              <Label htmlFor="setup-code">Verification code</Label>
              <Input
                id="setup-code"
                inputMode="numeric"
                placeholder="••••••"
                className="tracking-[0.4em]"
                value={setupCode}
                onChange={(e) => setSetupCode(e.target.value)}
              />
            </div>
          )}

          {setupStep === "codes" && recoveryCodes && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2">
                {recoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="rounded-lg bg-muted px-4 py-2 font-mono text-sm tracking-widest"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={copyCodes}>
                <Copy /> Copy all codes
              </Button>
            </div>
          )}

          <DialogFooter>
            {setupStep === "scan" && (
              <Button onClick={() => setSetupStep("code")} disabled={!setup}>
                Continue
              </Button>
            )}
            {setupStep === "code" && (
              <Button onClick={confirmEnable} disabled={busy}>
                {busy && <Loader2 className="animate-spin" />}
                Enable two-factor
              </Button>
            )}
            {setupStep === "codes" && (
              <Button onClick={() => setSetupOpen(false)}>I&apos;ve saved my codes</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={disableOpen} onOpenChange={setDisableOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Disable two-factor authentication?</DialogTitle>
            <DialogDescription>
              Enter a current code from your authenticator app to confirm.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="disable-code">Authentication code</Label>
            <Input
              id="disable-code"
              inputMode="numeric"
              placeholder="••••••"
              className="tracking-[0.4em]"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="destructive"
              onClick={confirmDisable}
              disabled={busy}
              className={cn(busy && "opacity-70")}
            >
              {busy && <Loader2 className="animate-spin" />}
              Disable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={regenerateOpen} onOpenChange={setRegenerateOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {regenerateStep === "codes" ? "New recovery codes" : "Generate new recovery codes?"}
            </DialogTitle>
            <DialogDescription>
              {regenerateStep === "confirm"
                ? "Your old recovery codes will stop working immediately."
                : "Each code below can be used once to sign in. Store them somewhere safe."}
            </DialogDescription>
          </DialogHeader>
          {regenerateStep === "codes" && recoveryCodes && (
            <div className="flex flex-col gap-3">
              <div className="grid grid-cols-1 gap-2">
                {recoveryCodes.map((code) => (
                  <div
                    key={code}
                    className="rounded-lg bg-muted px-4 py-2 font-mono text-sm tracking-widest"
                  >
                    {code}
                  </div>
                ))}
              </div>
              <Button variant="outline" size="sm" onClick={copyCodes}>
                <Copy /> Copy all codes
              </Button>
            </div>
          )}
          <DialogFooter>
            {regenerateStep === "confirm" && (
              <>
                <Button variant="outline" onClick={() => setRegenerateOpen(false)}>Cancel</Button>
                <Button variant="destructive" onClick={regenerateCodes} disabled={busy}>
                  {busy && <Loader2 className="animate-spin" />}
                  Generate new codes
                </Button>
              </>
            )}
            {regenerateStep === "codes" && (
              <Button onClick={() => setRegenerateOpen(false)}>Done</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
