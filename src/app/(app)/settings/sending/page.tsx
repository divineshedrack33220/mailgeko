"use client";

import * as React from "react";
import { Loader2, Send, Trash2, MailCheck, Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
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
import { toast } from "sonner";
import { api } from "@/lib/api";

interface SmtpSettings {
  configured: boolean;
  available: boolean;
  host: string;
  port: number;
  username: string;
  hasPassword: boolean;
  fromName: string;
  fromEmail: string;
  replyTo: string;
  enabled: boolean;
}

const EMPTY: SmtpSettings = {
  configured: false,
  available: true,
  host: "",
  port: 587,
  username: "",
  hasPassword: false,
  fromName: "",
  fromEmail: "",
  replyTo: "",
  enabled: false,
};

export default function SendingSettingsPage() {
  const [settings, setSettings] = React.useState<SmtpSettings>(EMPTY);
  const [password, setPassword] = React.useState("");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [testing, setTesting] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [confirmRemove, setConfirmRemove] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<SmtpSettings>("/api/v1/workspace/smtp")
      .then((res) => {
        if (!cancelled) setSettings({ ...EMPTY, ...res });
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load SMTP settings");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const update = <K extends keyof SmtpSettings>(key: K, value: SmtpSettings[K]) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await api.put<SmtpSettings>("/api/v1/workspace/smtp", {
        host: settings.host,
        port: settings.port,
        username: settings.username,
        password,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        replyTo: settings.replyTo,
        enabled: settings.enabled,
      });
      setSettings({ ...EMPTY, ...res, hasPassword: res.hasPassword });
      setPassword("");
      toast.success("SMTP settings saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save SMTP settings");
    } finally {
      setSaving(false);
    }
  };

  const sendTest = async () => {
    setTesting(true);
    try {
      await api.post<{ ok: boolean }>("/api/v1/workspace/smtp/test", {
        host: settings.host,
        port: settings.port,
        username: settings.username,
        password,
        fromName: settings.fromName,
        fromEmail: settings.fromEmail,
        replyTo: settings.replyTo,
      });
      toast.success("Test email sent — check your inbox");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "SMTP test failed");
    } finally {
      setTesting(false);
    }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await api.delete("/api/v1/workspace/smtp");
      setSettings(EMPTY);
      setConfirmRemove(false);
      toast.success("SMTP configuration removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove SMTP settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="text-primary size-4" /> Sending via your own email
          </CardTitle>
          <CardDescription>
            Plug in your own SMTP mailbox and campaigns, automations and 1-to-1
            emails send from your address instead of Mailgeko&apos;s.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : !settings.available ? (
            <div className="bg-warning/10 border-warning/25 flex items-start gap-3 rounded-lg border px-4 py-3">
              <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
              <p className="text-warning text-sm">
                <span className="font-semibold">Not available yet:</span> this
                deployment hasn&apos;t enabled bring-your-own SMTP. Ask your
                administrator to set the <code className="font-mono text-xs">MAILGEKO_SECRET_KEY</code>{" "}
                environment variable.
              </p>
            </div>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                void save();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-host">SMTP host</Label>
                  <Input
                    id="smtp-host"
                    placeholder="smtp.gmail.com"
                    value={settings.host}
                    onChange={(e) => update("host", e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-port">Port</Label>
                  <select
                    id="smtp-port"
                    value={settings.port}
                    onChange={(e) => update("port", Number(e.target.value))}
                    className="border-input bg-background text-sm focus-visible:ring-ring flex h-9 w-full rounded-md border px-3 py-1 shadow-sm focus-visible:ring-1 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value={465}>465 — implicit TLS</option>
                    <option value={587}>587 — STARTTLS (recommended)</option>
                    <option value={25}>25 — plain</option>
                  </select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-username">Username</Label>
                  <Input
                    id="smtp-username"
                    placeholder="you@gmail.com"
                    value={settings.username}
                    onChange={(e) => update("username", e.target.value)}
                    required
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-password">Password / app password</Label>
                  <div className="relative">
                    <Input
                      id="smtp-password"
                      type={showPassword ? "text" : "password"}
                      placeholder={
                        settings.hasPassword ? "•••••••••• (unchanged)" : "App password"
                      }
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2 cursor-pointer"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-from-name">From name</Label>
                  <Input
                    id="smtp-from-name"
                    placeholder="Acme Marketing"
                    value={settings.fromName}
                    onChange={(e) => update("fromName", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-from-email">From email</Label>
                  <Input
                    id="smtp-from-email"
                    placeholder="marketing@you.com"
                    value={settings.fromEmail}
                    onChange={(e) => update("fromEmail", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="smtp-reply-to">Reply-to (optional)</Label>
                  <Input
                    id="smtp-reply-to"
                    placeholder="replies@you.com"
                    value={settings.replyTo}
                    onChange={(e) => update("replyTo", e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-medium">Send campaigns through this mailbox</p>
                  <p className="text-muted-foreground text-xs">
                    Disable to fall back to Mailgeko&apos;s sender.
                  </p>
                </div>
                <Switch
                  checked={settings.enabled}
                  onCheckedChange={(checked) => update("enabled", checked)}
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button type="submit" disabled={saving || !settings.host || !settings.username}>
                  {saving ? <Loader2 className="animate-spin" /> : <Send />} Save settings
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={testing || !settings.host || !settings.username}
                  onClick={() => void sendTest()}
                >
                  {testing ? <Loader2 className="animate-spin" /> : <MailCheck />} Send test email
                </Button>
                {settings.configured && (
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-destructive hover:text-destructive"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 /> Remove configuration
                  </Button>
                )}
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Before you use your personal mailbox</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 text-sm">
          <p className="text-muted-foreground leading-relaxed">
            Personal mailboxes (like Gmail) are built for transactional mail, not
            bulk campaigns. Providers rate-limit and often route mass sends to
            spam. Use an app password where required (e.g. Gmail) and consider a
            dedicated mailbox or transactional provider with a verified domain
            for serious sending.
          </p>
          <p className="text-muted-foreground leading-relaxed">
            Bounces and complaints from your own SMTP aren&apos;t reported back to
            Mailgeko, so contact statuses won&apos;t auto-update for those sends.
            Opens and clicks are still tracked as usual.
          </p>
        </CardContent>
      </Card>

      <AlertDialog open={confirmRemove} onOpenChange={(open) => !open && setConfirmRemove(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove SMTP configuration?</AlertDialogTitle>
            <AlertDialogDescription>
              Campaigns will switch back to Mailgeko&apos;s default sender. The
              stored password will be deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={saving}
              onClick={() => void remove()}
            >
              {saving && <Loader2 className="animate-spin" />} Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
