"use client";

import * as React from "react";
import {
  Check,
  Zap,
  CreditCard,
  FileText,
  Download,
  ArrowRight,
  ShieldCheck,
  RefreshCcw,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const plans = [
  {
    id: "starter",
    name: "Starter",
    price: 19,
    sends: "10,000 emails/mo",
    features: ["1 user included", "2,000 contacts", "Basic reports", "Email support"],
  },
  {
    id: "growth",
    name: "Growth",
    price: 49,
    sends: "50,000 emails/mo",
    features: [
      "3 users included",
      "10,000 contacts",
      "Advanced reports",
      "Automations",
      "Priority support",
    ],
    highlight: true,
  },
  {
    id: "scale",
    name: "Scale",
    price: 129,
    sends: "250,000 emails/mo",
    features: [
      "10 users included",
      "50,000 contacts",
      "AI Studio suite",
      "Custom domain & IP",
      "24/7 support",
    ],
  },
];

export default function BillingSettingsPage() {
  const [currentPlan, setCurrentPlan] = React.useState("growth");

  const usage = {
    contacts: 1248,
    contactLimit: 10000,
    emails: 28432,
    emailLimit: 50000,
    automations: 4,
    automationLimit: 10,
  };

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Zap className="text-primary size-5" />
                Growth plan
              </CardTitle>
              <CardDescription>Billed monthly · next invoice Aug 1, 2026</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="success">Active</Badge>
              <Button variant="outline" size="sm" onClick={() => toast.info("Plan changes open in the billing portal")}>
                <RefreshCcw /> Manage plan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {[
            { label: "Contacts", used: usage.contacts, limit: usage.contactLimit },
            { label: "Emails sent", used: usage.emails, limit: usage.emailLimit },
            { label: "Active automations", used: usage.automations, limit: usage.automationLimit },
          ].map((row) => {
            const pct = Math.min(100, (row.used / row.limit) * 100);
            const near = pct >= 80;
            return (
              <div key={row.label}>
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{row.label}</span>
                  <span className="tabular-nums">
                    <span className={cn("font-medium", near && "text-warning")}>
                      {row.used.toLocaleString()}
                    </span>
                    <span className="text-muted-foreground"> / {row.limit.toLocaleString()}</span>
                  </span>
                </div>
                <Progress value={pct} className="h-2" indicatorClassName={near ? "bg-warning" : undefined} />
              </div>
            );
          })}
          <div className="bg-muted/50 text-muted-foreground rounded-lg border px-4 py-3 text-sm">
            Pro tip: <span className="font-medium text-foreground">Scale</span> includes
            AI Studio and a dedicated sending IP — a good fit once you pass 30,000 contacts.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Plans</CardTitle>
          <CardDescription>Switch plans anytime. Changes prorate automatically.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.id}
                className={cn(
                  "relative flex flex-col rounded-xl border-2 p-5",
                  plan.highlight
                    ? "border-primary shadow-lg"
                    : "border-border"
                )}
              >
                {plan.highlight && (
                  <span className="bg-primary text-primary-foreground absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full px-3 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase">
                    Current plan
                  </span>
                )}
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{plan.name}</h3>
                  {plan.id === currentPlan && <Badge variant="success">Current</Badge>}
                </div>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-3xl font-semibold tracking-tight">${plan.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>
                <p className="text-muted-foreground mt-1 text-xs">{plan.sends}</p>
                <ul className="mt-4 flex flex-col gap-2">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="text-success mt-0.5 size-4 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.highlight ? "default" : "outline"}
                  size="sm"
                  className="mt-5 w-full"
                  disabled={plan.id === currentPlan}
                  onClick={() => setCurrentPlan(plan.id)}
                >
                  {plan.id === currentPlan ? "Your plan" : `Switch to ${plan.name}`}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="text-primary size-4" /> Payment method
            </CardTitle>
            <CardDescription>The card on file for this workspace.</CardDescription>
            <CardAction>
              <Button variant="ghost" size="sm" onClick={() => toast.info("Update payment method is coming soon")}>
                Update
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent className="flex items-center gap-4">
            <span className="bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-lg">
              <CreditCard className="size-5" />
            </span>
            <div>
              <p className="text-sm font-medium">Visa •••• 4242</p>
              <p className="text-muted-foreground text-xs">Expires 08 / 2028</p>
            </div>
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => toast.info("Add card is coming soon")}>
              <Plus /> Add card
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="text-primary size-4" /> Invoices
            </CardTitle>
            <CardDescription>Download receipts for your records.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {[
                { id: "INV-2026-07", date: "Jul 1, 2026", amount: "$49.00", status: "Paid" },
                { id: "INV-2026-06", date: "Jun 1, 2026", amount: "$49.00", status: "Paid" },
                { id: "INV-2026-05", date: "May 1, 2026", amount: "$49.00", status: "Paid" },
              ].map((invoice) => (
                <div key={invoice.id} className="hover:bg-muted/40 flex items-center gap-4 px-5 py-3 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{invoice.id}</p>
                    <p className="text-muted-foreground text-xs">{invoice.date}</p>
                  </div>
                  <span className="text-sm font-medium tabular-nums">{invoice.amount}</span>
                  <Badge variant={invoice.status === "Paid" ? "success" : "secondary"}>
                    {invoice.status}
                  </Badge>
                  <Button variant="ghost" size="icon-sm" aria-label={`Download ${invoice.id}`} onClick={() => toast.success(`Downloading ${invoice.id}`)}>
                    <Download />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="bg-primary/5 border-primary/15 flex flex-wrap items-center justify-between gap-3 rounded-xl border px-5 py-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="text-primary size-5" />
          <div>
            <p className="text-sm font-medium">Self-hosted data ownership</p>
            <p className="text-muted-foreground text-xs">
              On the Scale plan you can point Mailgeko at your own infrastructure.
            </p>
          </div>
        </div>
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm">
              Learn more <ArrowRight />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Self-hosted data ownership</DialogTitle>
              <DialogDescription>
                Bring your own infrastructure and keep every byte of your data
                inside systems you control.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-3 text-sm">
              <p className="text-muted-foreground leading-relaxed">
                On the Scale plan you can point Mailgeko at your own email-sending
                infrastructure, databases, and object storage. Campaigns still
                send and report through Mailgeko&apos;s UI — the data never leaves
                your estate.
              </p>
              <ul className="flex flex-col gap-2">
                {[
                  "Bring-your-own SMTP provider or SES-compatible gateway",
                  "Data residency: choose where your audience data lives",
                  "Zero data retained on Mailgeko's side",
                  "SOC 2-compliant export and audit trail",
                ].map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="text-success mt-0.5 size-4 shrink-0" />
                    <span className="text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
