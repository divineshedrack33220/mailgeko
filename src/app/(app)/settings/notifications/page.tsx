"use client";

import * as React from "react";
import { Bell, Save, Check, Mail, Send, TrendingUp, ShieldAlert, CreditCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

interface PrefGroup {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  prefs: { id: string; label: string; description: string; enabled: boolean }[];
}

const groups: PrefGroup[] = [
  {
    id: "campaigns",
    title: "Campaigns",
    description: "Activity around your sends.",
    icon: Send,
    prefs: [
      { id: "camp-sent", label: "Campaign sent", description: "When a campaign finishes sending.", enabled: true },
      { id: "camp-scheduled", label: "Campaign scheduled", description: "Confirmation when a campaign is queued.", enabled: false },
      { id: "camp-failed", label: "Campaign failed", description: "Immediately when a send encounters an error.", enabled: true },
    ],
  },
  {
    id: "audience",
    title: "Audience",
    description: "Subscriber growth and health.",
    icon: TrendingUp,
    prefs: [
      { id: "aud-spikes", label: "Unsubscribe spikes", description: "When unsubscribes jump above your baseline.", enabled: true },
      { id: "aud-bounces", label: "High bounce rate", description: "When bounce rate exceeds 3% in a day.", enabled: true },
      { id: "aud-list", label: "List milestone", description: "When a list crosses a round-number threshold.", enabled: false },
    ],
  },
  {
    id: "security",
    title: "Security",
    description: "Sign-ins and account safety.",
    icon: ShieldAlert,
    prefs: [
      { id: "sec-login", label: "New sign-in", description: "When a new device or location signs in.", enabled: true },
      { id: "sec-key", label: "API key created", description: "Whenever a new API key is generated.", enabled: true },
    ],
  },
  {
    id: "billing",
    title: "Billing",
    description: "Charges and plan changes.",
    icon: CreditCard,
    prefs: [
      { id: "bill-invoice", label: "Invoices", description: "Send an invoice copy to your inbox.", enabled: true },
      { id: "bill-limit", label: "Usage warnings", description: "When you approach plan limits.", enabled: true },
    ],
  },
];

export default function NotificationsSettingsPage() {
  const [state, setState] = React.useState(() =>
    Object.fromEntries(
      groups.flatMap((g) => g.prefs.map((p) => [p.id, p.enabled]))
    )
  );
  const [emailDigest, setEmailDigest] = React.useState("weekly");
  const [saved, setSaved] = React.useState(false);

  const toggle = (id: string) => setState((prev) => ({ ...prev, [id]: !prev[id] }));

  const handleSave = () => {
    setSaved(true);
    toast.success("Notification preferences saved");
    setTimeout(() => setSaved(false), 2000);
  };

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
                      checked={state[pref.id]}
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
            <Button onClick={handleSave}>
              {saved ? <Check /> : <Save />}
              {saved ? "Saved" : "Save preferences"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
