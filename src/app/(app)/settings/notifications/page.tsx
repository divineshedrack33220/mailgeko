"use client";

import * as React from "react";
import { Bell, Save, Check, Mail, Send, TrendingUp, ShieldAlert, CreditCard, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/lib/api";

const prefKeys = [
  "camp-sent",
  "camp-scheduled",
  "camp-failed",
  "aud-spikes",
  "aud-bounces",
  "aud-list",
  "sec-login",
  "sec-key",
  "bill-invoice",
  "bill-limit",
] as const;
type PrefKey = (typeof prefKeys)[number];

const defaultPrefs: Record<PrefKey, boolean> = {
  "camp-sent": true,
  "camp-scheduled": false,
  "camp-failed": true,
  "aud-spikes": true,
  "aud-bounces": true,
  "aud-list": false,
  "sec-login": true,
  "sec-key": true,
  "bill-invoice": true,
  "bill-limit": true,
};

interface PrefGroup {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  prefs: { id: PrefKey; label: string; description: string }[];
}

const groups: PrefGroup[] = [
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Activity around your sends.",
    icon: Send,
    prefs: [
      { id: "camp-sent", label: "Campaign sent", description: "When a campaign finishes sending." },
      { id: "camp-scheduled", label: "Campaign scheduled", description: "Confirmation when a campaign is queued." },
      { id: "camp-failed", label: "Campaign failed", description: "Immediately when a send encounters an error." },
    ],
  },
  {
    id: "audience",
    title: "Audience",
    description: "Subscriber growth and health.",
    icon: TrendingUp,
    prefs: [
      { id: "aud-spikes", label: "Unsubscribe spikes", description: "When unsubscribes jump above your baseline." },
      { id: "aud-bounces", label: "High bounce rate", description: "When bounce rate exceeds 3% in a day." },
      { id: "aud-list", label: "List milestone", description: "When a list crosses a round-number threshold." },
    ],
  },
  {
    id: "security",
    title: "Security",
    description: "Sign-ins and account safety.",
    icon: ShieldAlert,
    prefs: [
      { id: "sec-login", label: "New sign-in", description: "When a new device or location signs in." },
      { id: "sec-key", label: "API key created", description: "Whenever a new API key is generated." },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    description: "Charges and plan changes.",
    icon: CreditCard,
    prefs: [
      { id: "bill-invoice", label: "Invoices", description: "Send an invoice copy to your inbox." },
      { id: "bill-limit", label: "Usage warnings", description: "When you approach plan limits." },
    ],
  },
];

export default function NotificationsSettingsPage() {
  const [prefs, setPrefs] = React.useState<Record<PrefKey, boolean>>(defaultPrefs);
  const [emailDigest, setEmailDigest] = React.useState("weekly");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      try {
        const res = await api.get<{ prefs: Record<string, boolean>; digest: string }>("/api/v1/notifications/prefs");
        setPrefs((prev) => {
          const next = { ...prev };
          for (const key of prefKeys) {
            if (typeof res.prefs?.[key] === "boolean") next[key] = res.prefs[key];
          }
          return next;
        });
        if (res.digest) setEmailDigest(res.digest);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load notification preferences");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = (id: PrefKey) => setPrefs((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.put("/api/v1/notifications/prefs", { prefs, digest: emailDigest });
      setSaved(true);
      toast.success("Notification preferences saved");
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save notification preferences");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="text-primary size-4" /> Notification preferences
            </CardTitle>
            <CardDescription>
              Choose what activity triggers an email or in-app notification.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="text-primary size-4" /> Notification preferences
          </CardTitle>
          <CardDescription>
            Choose what activity triggers an email or in-app notification.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          {groups.map((group, gi) => (
            <div key={group.id}>
              {gi > 0 && <Separator className="mb-6" />}
              <div className="mb-3 flex items-center gap-3">
                <span className="bg-secondary text-secondary-foreground flex size-8 items-center justify-center rounded-lg">
                  <group.icon className="size-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold">{group.title}</h3>
                  <p className="text-muted-foreground text-xs">{group.description}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {group.prefs.map((pref) => (
                  <div
                    key={pref.id}
                    className="hover:bg-muted/40 flex items-center justify-between gap-4 rounded-lg border px-4 py-3 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <Mail className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div>
                        <p className="text-sm font-medium">{pref.label}</p>
                        <p className="text-muted-foreground text-xs">{pref.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={prefs[pref.id]}
                      onCheckedChange={() => toggle(pref.id)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email digest</CardTitle>
          <CardDescription>
            A summary of your workspace activity in your inbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="grid flex-1 gap-3 sm:grid-cols-3">
            {[
              { value: "daily", label: "Daily" },
              { value: "weekly", label: "Weekly", hint: "Recommended" },
              { value: "never", label: "Never" },
            ].map((option) => (
              <button
                key={option.value}
                onClick={() => setEmailDigest(option.value)}
                className={
                  emailDigest === option.value
                    ? "border-primary bg-primary/10 text-primary rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
                    : "border-border text-muted-foreground hover:border-primary/40 rounded-lg border px-4 py-3 text-sm font-medium transition-colors"
                }
              >
                {option.label}
                {option.hint && (
                  <span className="text-primary block text-[0.65rem] font-normal">{option.hint}</span>
                )}
              </button>
            ))}
          </div>
          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}
              {saving ? "Saving…" : saved ? "Saved" : "Save preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
