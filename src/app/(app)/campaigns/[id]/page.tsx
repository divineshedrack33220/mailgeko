"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  Send,
  ChevronLeft,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  MailOpen,
  MousePointerClick,
  TrendingUp,
  ExternalLink,
  Repeat,
  Pause,
  CheckCircle2,
  XCircle,
  Globe,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/shared/stat-card";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { CampaignStatusBadge } from "@/components/shared/status-badges";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { formatDateTime, formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { campaigns, countries, devices, topClickedLinks } from "@/lib/mock";

export default function CampaignDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const campaign = campaigns.find((c) => c.id === params.id) ?? campaigns[0];

  const delivered = campaign.stats.delivered;
  const openRate = delivered ? (campaign.stats.uniqueOpens / delivered) * 100 : 0;
  const clickRate = delivered ? (campaign.stats.uniqueClicks / delivered) * 100 : 0;
  const bounceRate = campaign.stats.sent ? (campaign.stats.bounced / campaign.stats.sent) * 100 : 0;
  const sendProgress = campaign.stats.sent
    ? (campaign.stats.sent / Math.max(campaign.stats.recipients, 1)) * 100
    : 0;

  const chartData = [
    { date: "12:00", opens: 8, clicks: 3 },
    { date: "13:00", opens: 24, clicks: 9 },
    { date: "14:00", opens: 51, clicks: 21 },
    { date: "15:00", opens: 83, clicks: 34 },
    { date: "16:00", opens: 67, clicks: 27 },
    { date: "17:00", opens: 94, clicks: 41 },
    { date: "18:00", opens: 72, clicks: 29 },
    { date: "19:00", opens: 60, clicks: 24 },
    { date: "20:00", opens: 31, clicks: 12 },
  ];

  const isSending = campaign.status === "sending";
  const isSent = campaign.status === "sent" || campaign.status === "completed";

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
            <Button variant="outline" size="sm" onClick={() => toast.success("Campaign duplicated")}>
              <Copy /> Duplicate
            </Button>
            {isSending && (
              <Button variant="outline" size="sm" onClick={() => toast.success("Campaign paused")}>
                <Pause /> Pause
              </Button>
            )}
            <Button size="sm" asChild>
              <Link href="/campaigns/new">
                <Pencil /> Edit
              </Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                <DropdownMenuItem className="cursor-pointer" onClick={() => toast.success("Test email sent to team@acme.co")}>
                  <Repeat /> Send test
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/reports")}>
                  <TrendingUp /> View reports
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  variant="destructive"
                  onClick={() => {
                    toast.success("Campaign deleted");
                    router.push("/campaigns");
                  }}
                >
                  <Trash2 /> Delete campaign
                </DropdownMenuItem>
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
              {formatNumber(campaign.stats.sent)} / {formatNumber(campaign.stats.recipients)}
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
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-5 flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Delivered"
              value={formatNumber(campaign.stats.delivered)}
              icon={CheckCircle2}
              hint={`of ${formatNumber(campaign.stats.sent)} sent`}
            />
            <StatCard
              label="Open rate"
              value={formatPercent(openRate)}
              change={6.2}
              icon={MailOpen}
              hint={`${formatNumber(campaign.stats.uniqueOpens)} unique opens`}
            />
            <StatCard
              label="Click rate"
              value={formatPercent(clickRate)}
              change={3.1}
              icon={MousePointerClick}
              hint={`${formatNumber(campaign.stats.uniqueClicks)} unique clicks`}
            />
            <StatCard
              label="Bounces"
              value={formatPercent(bounceRate)}
              change={0}
              icon={XCircle}
              hint={`${formatNumber(campaign.stats.bounced)} bounced`}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Opens & clicks over time</CardTitle>
                    <CardDescription>Hourly engagement after sending</CardDescription>
                  </div>
                  <CardAction>
                    <Badge variant="secondary">Last 12 hours</Badge>
                  </CardAction>
                </div>
              </CardHeader>
              <CardContent>
                <AreaChart
                  data={chartData}
                  height={260}
                  xKey="date"
                  series={[
                    { key: "opens", name: "Opens", color: "var(--chart-1)" },
                    { key: "clicks", name: "Clicks", color: "var(--chart-2)" },
                  ]}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top clicked links</CardTitle>
                <CardDescription>Most popular destinations</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                {topClickedLinks.map((link, index) => (
                  <div key={link.url} className="flex items-center gap-3">
                    <span className="text-muted-foreground w-4 text-xs font-medium tabular-nums">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium">{link.url}</p>
                      <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full">
                        <div
                          className="bg-primary h-full rounded-full"
                          style={{ width: `${(link.clicks / topClickedLinks[0].clicks) * 100}%` }}
                        />
                      </div>
                    </div>
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {formatNumber(link.clicks)}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Opens by device</CardTitle>
                <CardDescription>Where your email was opened</CardDescription>
              </CardHeader>
              <CardContent>
                <DonutChart
                  data={devices.map((d) => ({ name: d.name, value: d.count }))}
                  centerValue={formatNumber(devices.reduce((s, d) => s + d.count, 0))}
                  centerLabel="opens"
                  height={190}
                />
              </CardContent>
            </Card>

            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Globe className="text-muted-foreground size-4" />
                  <CardTitle>Opens by country</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
                  {countries.slice(0, 8).map((country) => {
                    const max = countries[0].opens;
                    return (
                      <div key={country.code} className="flex items-center gap-3">
                        <span className="w-6 text-center text-sm">{country.code}</span>
                        <div className="flex-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">{country.country}</span>
                            <span className="tabular-nums">{formatNumber(country.opens)}</span>
                          </div>
                          <div className="bg-muted mt-1 h-1 overflow-hidden rounded-full">
                            <div
                              className="bg-chart-3 h-full rounded-full"
                              style={{ width: `${(country.opens / max) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="content" className="mt-5">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold">{campaign.subject}</p>
                  <p className="text-muted-foreground text-xs">
                    From {campaign.sender.fromName} &lt;{campaign.sender.fromEmail}&gt;
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm">
                    <ExternalLink /> Preview
                  </Button>
                  <Button size="sm">
                    <Send /> Send test
                  </Button>
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
                  <Input readOnly value={campaign.sender.fromName} />
                </div>
                <div className="flex flex-col gap-2">
                  <Label className="text-xs">From email</Label>
                  <Input readOnly value={campaign.sender.fromEmail} />
                </div>
              </div>
              <Separator />
              <div className="bg-muted/40 flex h-64 items-center justify-center rounded-xl border">
                <div className="text-center">
                  <MailOpen className="text-muted-foreground mx-auto size-8" />
                  <p className="text-muted-foreground mt-2 text-sm">
                    Email preview rendered here
                  </p>
                  <p className="text-muted-foreground/70 text-xs">
                    (MJML → HTML rendering pipeline)
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="mt-5">
          <Card className="gap-4 py-5">
            <div className="px-6">
              <h3 className="text-sm font-semibold">Tracking</h3>
            </div>
            <div className="divide-y px-6">
              {[
                { label: "Track opens", desc: "Count recipients who open this email", defaultOn: campaign.settings.trackOpens },
                { label: "Track clicks", desc: "Record clicks on all links", defaultOn: campaign.settings.trackClicks },
                { label: "Allow unsubscribe", desc: "Include one-click unsubscribe footer", defaultOn: campaign.settings.allowUnsubscribe },
              ].map((row) => (
                <div key={row.label} className="flex items-center justify-between py-3">
                  <div>
                    <p className="text-sm font-medium">{row.label}</p>
                    <p className="text-muted-foreground text-xs">{row.desc}</p>
                  </div>
                  <Switch defaultChecked={row.defaultOn} />
                </div>
              ))}
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-5">
          <Card className="gap-0 overflow-hidden py-0">
            <div className="divide-y">
              {[
                { action: "Campaign created", detail: "by Grace Lee", time: campaign.createdAt },
                { action: "Template attached", detail: campaign.templateId ?? "—", time: campaign.createdAt },
                { action: "Content updated", detail: "Subject line finalized", time: campaign.updatedAt },
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
    </div>
  );
}
