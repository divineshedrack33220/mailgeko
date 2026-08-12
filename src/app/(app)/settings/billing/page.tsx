"use client";

import * as React from "react";
import {
  Check,
  Zap,
  CreditCard,
  FileText,
  ArrowRight,
  ShieldCheck,
  RefreshCcw,
  Loader2,
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
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { BillingLimits, BillingPlan } from "@/lib/types";

export default function BillingSettingsPage() {
  const [plans, setPlans] = React.useState<BillingPlan[]>([]);
  const [limits, setLimits] = React.useState<BillingLimits | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [working, setWorking] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const [plansRes, limitsRes] = await Promise.all([
        api.get<{ plans: BillingPlan[] }>("/api/v1/billing/plans"),
        api.get<{ limits: BillingLimits }>("/api/v1/billing"),
      ]);
      setPlans(plansRes.plans ?? []);
      setLimits(limitsRes.limits);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load billing info");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    let cancelled = false;
    const run = async () => {
      try {
        const [limitsRes, plansRes] = await Promise.all([
          api.get<{ limits: BillingLimits }>("/api/v1/billing/current"),
          api.get<{ plans: BillingPlan[] }>("/api/v1/billing/plans"),
        ]);
        if (!cancelled) {
          setLimits(limitsRes.limits);
          setPlans(plansRes.plans);
        }
      } catch (err) {
        console.error("Failed to load billing data", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();
    return () => { cancelled = true; };
  }, []);

  const currentPlan = limits?.plan;

  const openPortal = async () => {
    setWorking("portal");
    try {
      const res = await api.post<{ url: string }>("/api/v1/billing/portal", {});
      if (res.url && (res.url.startsWith("https://billing.stripe.com") || res.url.startsWith("https://checkout.stripe.com"))) {
        window.location.assign(res.url);
      } else {
        toast.error("Invalid billing URL");
        setWorking(null);
      }
    } catch (err) {
      setWorking(null);
      toast.error(err instanceof Error ? err.message : "Could not open billing portal");
    }
  };

  const switchPlan = async (planId: string) => {
    if (!window.confirm(`Switch to this plan? You will be redirected to Stripe checkout.`)) return;
    setWorking(planId);
    try {
      const res = await api.post<{ url: string }>("/api/v1/billing/checkout", { plan: planId });
      if (res.url && (res.url.startsWith("https://checkout.stripe.com") || res.url.startsWith("https://billing.stripe.com"))) {
        window.location.assign(res.url);
      } else {
        toast.error("Invalid checkout URL");
        setWorking(null);
      }
    } catch (err) {
      setWorking(null);
      toast.error(err instanceof Error ? err.message : "Could not start checkout");
    }
  };

  const usageRows = [
    {
      label: "Contacts",
      used: limits?.contacts ?? 0,
      limit: limits?.maxContacts ?? 0,
    },
    {
      label: "Emails sent",
      used: limits?.emailsThisMonth ?? 0,
      limit: limits?.maxEmailsPerMonth ?? 0,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              {loading ? (
                <Skeleton className="h-6 w-40" />
              ) : (
                <CardTitle className="flex items-center gap-2">
                  <Zap className="text-primary size-5" />
                  {limits?.planName ?? "Starter"} plan
                </CardTitle>
              )}
              <CardDescription>Billed monthly · manage via the billing portal</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!loading && limits?.plan && <Badge variant="success">Active</Badge>}
              <Button variant="outline" size="sm" onClick={openPortal} disabled={working !== null}>
                {working === "portal" ? <Loader2 className="animate-spin" /> : <RefreshCcw />} Manage plan
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {loading ? (
            <div className="flex flex-col gap-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          ) : (
            <>
              {usageRows.map((row) => {
                const pct = row.limit > 0 ? Math.min(100, (row.used / row.limit) * 100) : 0;
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
                    <Progress value={pct} className="h-2" indicatorClassName={near ? "bg-warning" : undefined} aria-label={`${row.label}: ${row.used.toLocaleString()} of ${row.limit.toLocaleString()}`} />
                  </div>
                );
              })}
            </>
          )}
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
          {loading ? (
            <div className="grid gap-4 md:grid-cols-3">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-3">
              {plans.map((plan) => {
                const isCurrent = plan.id === currentPlan;
                return (
                  <div
                    key={plan.id}
                    className={cn(
                      "relative flex flex-col rounded-xl border-2 p-5",
                      isCurrent ? "border-primary shadow-lg" : "border-border"
                    )}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold">{plan.name}</h3>
                      {isCurrent && <Badge variant="success">Current</Badge>}
                    </div>
                    <div className="mt-3 flex items-baseline gap-1">
                      <span className="text-3xl font-semibold tracking-tight">${plan.priceMonthly}</span>
                      <span className="text-muted-foreground text-sm">/mo</span>
                    </div>
                    <p className="text-muted-foreground mt-1 text-xs">
                      {plan.emailsPerMonth.toLocaleString()} emails/mo ·{" "}
                      {plan.maxContacts.toLocaleString()} contacts
                    </p>
                    <ul className="mt-4 flex flex-col gap-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-sm">
                          <Check className="text-success mt-0.5 size-4 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Button
                      variant={isCurrent ? "default" : "outline"}
                      size="sm"
                      className="mt-5 w-full"
                      disabled={isCurrent || working !== null}
                      onClick={() => switchPlan(plan.id)}
                    >
                      {working === plan.id ? <Loader2 className="animate-spin" /> : null}
                      {isCurrent ? "Your plan" : `Switch to ${plan.name}`}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
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
              <Button variant="ghost" size="sm" onClick={() => toast.info("Update payment method is available in the billing portal")}>
                Update
              </Button>
            </CardAction>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Manage your payment method and invoices through the billing portal.
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={openPortal} disabled={working !== null}>
              <CreditCard /> Open billing portal
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
          <CardContent>
            <p className="text-muted-foreground text-sm">
              Invoices and receipts are generated in the billing portal once you
              complete your first payment.
            </p>
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
