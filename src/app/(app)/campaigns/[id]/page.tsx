"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Send,
  ChevronLeft,
  MoreHorizontal,
  Copy,
  Trash2,
  MailOpen,
  MousePointerClick,
  TrendingUp,
  Repeat,
  Pause,
  CheckCircle2,
  XCircle,
  Loader2,
  Link2,
  MonitorSmartphone,
  Globe,
  Clock3,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/shared/stat-card";
import { CampaignStatusBadge, RecipientStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { formatDateTime, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { canManage, canSend } from "@/lib/permissions";
import type { Campaign, CampaignRecipient, CampaignStats, RecipientStatus } from "@/lib/types";

const EMPTY_STATS: CampaignStats = {
  recipients: 0,
  sent: 0,
  delivered: 0,
  opened: 0,
  clicked: 0,
  bounced: 0,
  complained: 0,
  unsubscribed: 0,
  uniqueOpens: 0,
  uniqueClicks: 0,
};

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const manage = canManage(role);
  const send = canSend(role);
  const [campaign, setCampaign] = React.useState<Campaign | null>(null);
  const [liveStats, setLiveStats] = React.useState<CampaignStats | null>(null);
  const [recipients, setRecipients] = React.useState<CampaignRecipient[] | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [testOpen, setTestOpen] = React.useState(false);
  const [testEmails, setTestEmails] = React.useState("");
  const [previewOpen, setPreviewOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ campaign: Campaign }>(`/api/v1/campaigns/${params.id}`);
      setCampaign(res.campaign);
      api
        .get<{ stats?: CampaignStats }>(`/api/v1/analytics/campaigns/${params.id}`)
        .then((a) => setLiveStats(a.stats ?? null))
        .catch(() => {});
      api
        .get<{ recipients: CampaignRecipient[] }>(`/api/v1/campaigns/${params.id}/recipients`)
        .then((r) => setRecipients(r.recipients ?? []))
        .catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load campaign");
      router.replace("/campaigns");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  React.useEffect(() => {
    const run = async () => {
      await load();
    };
    run();
  }, [load]);

  const sendNow = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/campaigns/${campaign.id}/send`);
      toast.success("Campaign queued for sending");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send campaign");
    } finally {
      setBusy(false);
    }
  };

  const cancelCampaign = async () => {
    if (!campaign) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/campaigns/${campaign.id}/cancel`);
      toast.success("Campaign canceled");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not cancel campaign");
    } finally {
      setBusy(false);
    }
  };

  const duplicateCampaign = async () => {
    if (!campaign) return;
    try {
      await api.post("/api/v1/campaigns", {
        name: `${campaign.name} (copy)`,
        subject: campaign.subject,
        templateId: campaign.templateId,
        previewText: campaign.previewText,
        plainText: campaign.plainText,
        htmlContent: campaign.htmlContent,
        status: "draft",
        type: campaign.type,
        listIds: campaign.listIds,
        segmentIds: campaign.segmentIds,
        sender: campaign.sender,
        settings: campaign.settings,
      });
      toast.success("Campaign duplicated");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate campaign");
    }
  };

  const deleteCampaign = async () => {
    if (!campaign) return;
    try {
      await api.delete(`/api/v1/campaigns/${campaign.id}`);
      toast.success("Campaign deleted");
      router.replace("/campaigns");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete campaign");
    }
  };

  const isValidEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

  const sendTest = async () => {
    const emails = testEmails
      .split(",")
      .map((e) => e.trim())
      .filter(isValidEmail);
    if (emails.length === 0) return;
    setBusy(true);
    try {
      await api.post(`/api/v1/campaigns/${campaign?.id}/send-test`, { emails });
      setTestOpen(false);
      setTestEmails("");
      toast.success("Test email sent");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send test");
    } finally {
      setBusy(false);
    }
  };

  const updateSetting = async (key: "trackOpens" | "trackClicks" | "allowUnsubscribe", value: boolean) => {
    setCampaign((prev) => {
      if (!prev) return prev;
      const next = {
        ...prev,
        settings: { ...(prev.settings ?? { trackOpens: true, trackClicks: true, allowUnsubscribe: true }), [key]: value },
      };
      const payload = {
        name: prev.name,
        subject: prev.subject,
        templateId: prev.templateId,
        previewText: prev.previewText,
        plainText: prev.plainText,
        htmlContent: prev.htmlContent,
        status: prev.status,
        type: prev.type,
        listIds: prev.listIds,
        segmentIds: prev.segmentIds,
        sender: prev.sender,
        settings: next.settings,
      };
      api.patch(`/api/v1/campaigns/${prev.id}`, payload).then(
        () => toast.success("Settings updated"),
        (err) => {
          setCampaign((cur) => (cur?.id === prev.id ? { ...prev } : cur));
          toast.error(err instanceof Error ? err.message : "Could not update settings");
        }
      );
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Loader2 className="animate-spin text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">Loading campaign…</p>
      </div>
    );
  }

  if (!campaign) return null;

  const stats = liveStats ?? campaign.stats ?? EMPTY_STATS;
  const delivered = stats.delivered;
  const rateBase = delivered > 0 ? delivered : stats.sent;
  const openRate = rateBase ? (stats.uniqueOpens / rateBase) * 100 : 0;
  const clickRate = rateBase ? (stats.uniqueClicks / rateBase) * 100 : 0;
  const bounceRate = stats.sent ? (stats.bounced / stats.sent) * 100 : 0;
  const sendProgress = stats.sent
    ? Math.min(100, (stats.sent / Math.max(stats.recipients, 1)) * 100)
    : 0;

  const isSending = campaign.status === "sending";
  const isSent = campaign.status === "sent" || campaign.status === "completed";
  const canSendNow = (campaign.status === "draft" || campaign.status === "scheduled" || campaign.status === "paused" || campaign.status === "failed") && send;
  const hasAnalytics =
    stats.delivered > 0 ||
    stats.opened > 0 ||
    stats.clicked > 0 ||
    stats.uniqueOpens > 0 ||
    stats.uniqueClicks > 0;

  const effectiveStatus = (r: CampaignRecipient): RecipientStatus => {
    if (r.bouncedAt) return "bounced";
    if (r.complainedAt) return "complained";
    if (r.unsubscribedAt) return "unsubscribed";
    if (r.clickedAt) return "clicked";
    if (r.openedAt) return "opened";
    if (r.deliveredAt) return "delivered";
    return r.status;
  };

  const recipientTotals = (recipients ?? []).reduce(
    (acc, r) => {
      const s = effectiveStatus(r);
      acc[s] = (acc[s] ?? 0) + 1;
      return acc;
    },
    {} as Partial<Record<RecipientStatus, number>>
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/campaigns"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" /> Back to campaigns
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <span className="bg-primary/10 text-primary flex size-12 shrink-0 items-center justify-center rounded-xl">
              <Send className="size-6" />
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-semibold tracking-tight">{campaign.name}</h2>
                <CampaignStatusBadge status={campaign.status} />
              </div>
              <p className="text-muted-foreground mt-1 text-sm">{campaign.subject}</p>
              <p className="text-muted-foreground mt-0.5 text-xs">
                Updated {timeAgo(campaign.updatedAt)} · Created {formatDateTime(campaign.createdAt)}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canSendNow && (
              <Button size="sm" onClick={sendNow} disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />}
                Send now
              </Button>
            )}
            {manage && (
              <Button variant="outline" size="sm" onClick={duplicateCampaign}>
                <Copy /> Duplicate
              </Button>
            )}
            {send && isSending && (
              <Button variant="outline" size="sm" onClick={cancelCampaign} disabled={busy}>
                <Pause /> Cancel
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                {manage && (
                  <DropdownMenuItem className="cursor-pointer" onClick={() => setTestOpen(true)}>
                    <Repeat /> Send test
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/reports")}>
                  <TrendingUp /> View reports
                </DropdownMenuItem>
                {manage && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      variant="destructive"
                      onClick={() => setDeleteOpen(true)}
                    >
                      <Trash2 /> Delete campaign
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {isSending && (
        <Card className="gap-2 py-4">
          <div className="flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
              <span className="bg-warning/15 text-warning size-2 animate-pulse rounded-full" />
              <span className="text-sm font-medium">Sending in progress</span>
            </div>
            <span className="text-muted-foreground text-xs tabular-nums">
              {formatNumber(stats.sent)} / {formatNumber(stats.recipients)}
            </span>
          </div>
          <div className="px-6">
            <Progress value={sendProgress} />
          </div>
        </Card>
      )}

      <Tabs defaultValue={isSent || isSending ? "analytics" : "content"}>
        <TabsList>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="content">Content</TabsTrigger>
          <TabsTrigger value="recipients">Recipients</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-5 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Delivered"
              value={formatNumber(stats.delivered)}
              icon={CheckCircle2}
              hint={`of ${formatNumber(stats.sent)} sent`}
            />
            <StatCard
              label="Open rate"
              value={formatPercent(openRate)}
              icon={MailOpen}
              hint={`${formatNumber(stats.uniqueOpens)} unique opens`}
            />
            <StatCard
              label="Click rate"
              value={formatPercent(clickRate)}
              icon={MousePointerClick}
              hint={`${formatNumber(stats.uniqueClicks)} unique clicks`}
            />
            <StatCard
              label="Bounces"
              value={formatPercent(bounceRate)}
              icon={XCircle}
              hint={`${formatNumber(stats.bounced)} bounced`}
            />
          </div>

          {!hasAnalytics && (
            <EmptyState
              title="No analytics yet"
              description="Open, click, device, and location data will appear here after your campaign is sent."
              icon={Clock3}
            />
          )}
          {hasAnalytics && (
            <>
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Engagement</CardTitle>
                      <CardDescription>Totals for this campaign</CardDescription>
                    </div>
                    <CardAction>
                      <Badge variant="success">Live</Badge>
                    </CardAction>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-4">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="flex items-center gap-3">
                      <span className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-lg">
                        <MailOpen className="size-4" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(stats.opened)}</p>
                        <p className="text-muted-foreground text-xs">total opens</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-lg">
                        <MousePointerClick className="size-4" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(stats.clicked)}</p>
                        <p className="text-muted-foreground text-xs">total clicks</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-lg">
                        <MonitorSmartphone className="size-4" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(stats.uniqueOpens)}</p>
                        <p className="text-muted-foreground text-xs">unique opens</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="bg-secondary text-secondary-foreground flex size-9 items-center justify-center rounded-lg">
                        <Link2 className="size-4" />
                      </span>
                      <div>
                        <p className="text-lg font-semibold tabular-nums">{formatNumber(stats.uniqueClicks)}</p>
                        <p className="text-muted-foreground text-xs">unique clicks</p>
                      </div>
                    </div>
                  </div>
                  <Separator />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="flex items-center gap-3">
                      <Globe className="text-muted-foreground size-4" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Delivered</span>
                          <span className="tabular-nums">{formatNumber(stats.delivered)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <XCircle className="text-muted-foreground size-4" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Bounced</span>
                          <span className="tabular-nums">{formatNumber(stats.bounced)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <MailOpen className="text-muted-foreground size-4" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Complained</span>
                          <span className="tabular-nums">{formatNumber(stats.complained)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <XCircle className="text-muted-foreground size-4" />
                      <div className="flex-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Unsubscribed</span>
                          <span className="tabular-nums">{formatNumber(stats.unsubscribed)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="content" className="mt-5">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{campaign.subject}</p>
                  <p className="text-muted-foreground text-xs">
                    From {campaign.sender?.fromName ?? "Mailgeko"} &lt;{campaign.sender?.fromEmail ?? "mailgeko@clawmark.online"}&gt;
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}>
                    <TrendingUp /> Preview
                  </Button>
                  {manage && (
                    <Button size="sm" onClick={() => setTestOpen(true)}>
                      <Send /> Send test
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col gap-4 p-6">
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Subject line</Label>
                <Input readOnly value={campaign.subject} />
              </div>
              <div className="flex flex-col gap-2">
                <Label className="text-xs">Preview text</Label>
                <Input readOnly value={campaign.previewText ?? "—"} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">From name</Label>
                  <Input readOnly value={campaign.sender?.fromName ?? "Mailgeko"} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">From email</Label>
                  <Input readOnly value={campaign.sender?.fromEmail ?? "mailgeko@clawmark.online"} />
                </div>
              </div>
              <Separator />
              {campaign.htmlContent ? (
                <iframe
                  title="Email preview"
                  srcDoc={campaign.htmlContent}
                  sandbox=""
                  className="bg-white h-96 w-full rounded-xl border"
                />
              ) : (
                <div className="bg-muted/40 flex h-64 items-center justify-center rounded-xl border">
                  <div className="text-center">
                    <MailOpen className="text-muted-foreground mx-auto size-8" />
                    <p className="text-muted-foreground mt-2 text-sm">
                      No HTML content yet
                    </p>
                    <p className="text-muted-foreground/70 text-xs">
                      Build your email in the templates editor, then attach it here.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="recipients" className="mt-5 flex flex-col gap-6">
          {recipients === null ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-2 py-12">
                <Loader2 className="animate-spin" />
                <span className="text-muted-foreground text-sm">Loading recipients…</span>
              </CardContent>
            </Card>
          ) : recipients.length === 0 ? (
            <EmptyState
              title="No recipients yet"
              description="Recipients will appear here after this campaign is sent."
              icon={Send}
            />
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "queued" as const, label: "Queued", variant: "warning" as const },
                  { key: "sent" as const, label: "Sent", variant: "info" as const },
                  { key: "delivered" as const, label: "Delivered", variant: "success" as const },
                  { key: "opened" as const, label: "Opened", variant: "success" as const },
                  { key: "clicked" as const, label: "Clicked", variant: "success" as const },
                  { key: "bounced" as const, label: "Bounced", variant: "destructive" as const },
                  { key: "complained" as const, label: "Complained", variant: "destructive" as const },
                  { key: "unsubscribed" as const, label: "Unsubscribed", variant: "secondary" as const },
                  { key: "failed" as const, label: "Failed", variant: "destructive" as const },
                  { key: "skipped" as const, label: "Skipped", variant: "outline" as const },
                ]
                  .filter((row) => (recipientTotals[row.key] ?? 0) > 0)
                  .map((row) => (
                    <Badge key={row.key} variant={row.variant} className="gap-1.5">
                      {row.label}
                      <span className="tabular-nums">{recipientTotals[row.key]}</span>
                    </Badge>
                  ))}
              </div>

              <Card className="gap-0 overflow-hidden py-0">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Recipients</CardTitle>
                      <CardDescription>
                        Per-recipient delivery status for this campaign
                      </CardDescription>
                    </div>
                    <CardAction>
                      <span className="text-muted-foreground text-xs tabular-nums">
                        {recipients.length} total
                      </span>
                    </CardAction>
                  </div>
                </CardHeader>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contact</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Error</TableHead>
                      <TableHead>Sent</TableHead>
                      <TableHead>Opened</TableHead>
                      <TableHead>Clicked</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recipients.map((r) => (
                      <TableRow key={`${r.contactId}-${r.messageId ?? ""}`}>
                        <TableCell>
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">
                              {[r.firstName, r.lastName].filter(Boolean).join(" ") || "—"}
                            </span>
                            <span className="text-muted-foreground text-xs">{r.email}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <RecipientStatusBadge status={effectiveStatus(r)} />
                        </TableCell>
                        <TableCell>
                          {r.error ? (
                            <span className="text-destructive text-xs">{r.error}</span>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {r.sentAt ? formatDateTime(r.sentAt) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {r.openedAt ? formatDateTime(r.openedAt) : "—"}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-xs whitespace-nowrap">
                          {r.clickedAt ? formatDateTime(r.clickedAt) : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <Card className="gap-4 py-5">
            <div className="px-6">
              <h3 className="text-sm font-semibold">Tracking</h3>
            </div>
            <div className="divide-y px-6">
              {[
                { key: "trackOpens" as const, label: "Track opens", desc: "Count recipients who open this email", defaultOn: campaign.settings?.trackOpens ?? true },
                { key: "trackClicks" as const, label: "Track clicks", desc: "Record clicks on all links", defaultOn: campaign.settings?.trackClicks ?? true },
                { key: "allowUnsubscribe" as const, label: "Allow unsubscribe", desc: "Include one-click unsubscribe footer", defaultOn: campaign.settings?.allowUnsubscribe ?? true },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-muted-foreground text-xs">{row.desc}</p>
                  </div>
                  <Switch
                    checked={row.defaultOn}
                    onCheckedChange={(v) => updateSetting(row.key, v)}
                  />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="divide-y">
              {[
                { action: "Campaign created", detail: "by your workspace", time: campaign.createdAt },
                ...(isSending
                  ? [{ action: "Started sending", detail: "Queued for delivery", time: campaign.updatedAt }]
                  : []),
                ...(isSent
                  ? [{ action: "Finished sending", detail: "All emails delivered", time: campaign.updatedAt }]
                  : []),
              ].map((entry, index) => (
                <div key={index} className="flex items-start gap-4 px-6 py-4">
                  <span className="bg-secondary text-secondary-foreground mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full">
                    <Send className="size-3.5" />
                  </span>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{entry.action}</p>
                    <p className="text-muted-foreground text-xs">{entry.detail}</p>
                  </div>
                  <span className="text-muted-foreground text-xs whitespace-nowrap">
                    {timeAgo(entry.time)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={testOpen} onOpenChange={setTestOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send a test email</DialogTitle>
            <DialogDescription>
              Deliver this campaign to yourself or colleagues before sending.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="test-emails">Recipients</Label>
            <Input
              id="test-emails"
              value={testEmails}
              onChange={(e) => setTestEmails(e.target.value)}
              placeholder="you@company.com, colleague@company.com"
            />
            <p className="text-muted-foreground text-xs">
              Separate multiple addresses with commas.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={sendTest} disabled={busy || !testEmails.split(",").some((e) => isValidEmail(e.trim()))}>
              {busy && <Loader2 className="animate-spin" />}
              Send test
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
          <DialogHeader className="px-6 py-4">
            <DialogTitle>{campaign.subject}</DialogTitle>
            <DialogDescription>
              From {campaign.sender?.fromName ?? "Mailgeko"} &lt;
              {campaign.sender?.fromEmail ?? "mailgeko@clawmark.online"}&gt;
            </DialogDescription>
          </DialogHeader>
          {campaign.htmlContent ? (
            <iframe
              title="Email preview"
              srcDoc={campaign.htmlContent}
              sandbox=""
              className="bg-white w-full flex-1 border-t"
              style={{ height: "62vh" }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 border-t px-6 py-16">
              <MailOpen className="text-muted-foreground size-8" />
              <p className="text-muted-foreground text-sm">
                No HTML content yet — add content to preview.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              {campaign?.name} and its history will be permanently removed.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={deleteCampaign}
            >
              <Trash2 /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
