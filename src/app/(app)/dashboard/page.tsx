"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Send,
  MousePointerClick,
  MailOpen,
  ArrowUpRight,
  Plus,
  Sparkles,
  TrendingUp,
  Clock,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart } from "@/components/charts/area-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CampaignStatusBadge } from "@/components/shared/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTime, formatNumber, formatPercent } from "@/lib/format";
import {
  audienceGrowth,
  campaignPerformance,
  campaigns,
  devices,
} from "@/lib/mock";
import { useUiStore } from "@/stores/ui-store";

export default function DashboardPage() {
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  const [loading] = React.useState(false);
  const [range, setRange] = React.useState("7d");
  const [metric, setMetric] = React.useState<"opens" | "clicks">("opens");

  const totalOpens = campaignPerformance.reduce((sum, p) => sum + p.opens, 0);
  const totalClicks = campaignPerformance.reduce((sum, p) => sum + p.clicks, 0);
  const totalSends = campaignPerformance.reduce((sum, p) => sum + p.sends, 0);
  const openRate = totalSends > 0 ? (totalOpens / totalSends) * 100 : 0;

  const recentCampaigns = campaigns
    .filter((c) => c.type !== "test")
    .slice(0, 4);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Good morning, Grace 🦎</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Here&apos;s what&apos;s happening across your audience today.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
          <Button asChild>
            <Link href="/campaigns/new">
              <Plus /> New campaign
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Subscribers"
          value={formatNumber(1248)}
          change={7.5}
          icon={Users}
          hint="+87 new this month"
          loading={loading}
        />
        <StatCard
          label="Emails sent"
          value={formatNumber(totalSends)}
          change={12.3}
          icon={Send}
          hint="Across 14 campaigns"
          loading={loading}
        />
        <StatCard
          label="Open rate"
          value={formatPercent(openRate)}
          change={3.2}
          icon={MailOpen}
          hint="vs. industry avg"
          loading={loading}
        />
        <StatCard
          label="Click rate"
          value={formatPercent((totalClicks / Math.max(totalSends, 1)) * 100)}
          change={-1.1}
          icon={MousePointerClick}
          hint="vs last month"
          loading={loading}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Email performance</CardTitle>
                <CardDescription>Opens and clicks over time</CardDescription>
              </div>
              <Tabs value={metric} onValueChange={(v) => setMetric(v as "opens" | "clicks")}>
                <TabsList className="h-8">
                  <TabsTrigger value="opens">Opens</TabsTrigger>
                  <TabsTrigger value="clicks">Clicks</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <AreaChart
                data={campaignPerformance}
                height={280}
                series={
                  metric === "opens"
                    ? [{ key: "opens", name: "Opens", color: "var(--chart-1)" }]
                    : [{ key: "clicks", name: "Clicks", color: "var(--chart-2)" }]
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Device breakdown</CardTitle>
                <CardDescription>Where emails get opened</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={devices.map((d) => ({ name: d.name, value: d.count }))}
              centerValue={formatNumber(devices.reduce((s, d) => s + d.count, 0))}
              centerLabel="opens"
              height={220}
            />
            <div className="mt-2 space-y-2">
              {devices.slice(0, 4).map((device, i) => (
                <div key={device.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <span
                      className="size-2 rounded-full"
                      style={{ backgroundColor: `var(--chart-${i + 1})` }}
                    />
                    {device.name}
                  </span>
                  <span className="font-medium tabular-nums">{formatNumber(device.count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent campaigns</CardTitle>
                <CardDescription>Your latest sends and their performance</CardDescription>
              </div>
              <CardAction>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/campaigns">
                    View all <ArrowUpRight />
                  </Link>
                </Button>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {recentCampaigns.map((campaign) => {
                const openRate = campaign.stats.delivered
                  ? (campaign.stats.uniqueOpens / campaign.stats.delivered) * 100
                  : 0;
                const clickRate = campaign.stats.delivered
                  ? (campaign.stats.uniqueClicks / campaign.stats.delivered) * 100
                  : 0;
                return (
                  <Link
                    key={campaign.id}
                    href={`/campaigns/${campaign.id}`}
                    className="hover:bg-muted/40 flex items-center gap-4 px-6 py-4 transition-colors"
                  >
                    <span className="bg-secondary text-secondary-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                      <Send className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{campaign.name}</p>
                      <p className="text-muted-foreground text-xs">
                        {campaign.subject}
                      </p>
                    </div>
                    <div className="hidden w-24 text-right sm:block">
                      <p className="text-sm font-medium tabular-nums">
                        {formatPercent(openRate)}
                      </p>
                      <p className="text-muted-foreground text-xs">open rate</p>
                    </div>
                    <div className="hidden w-24 text-right sm:block">
                      <p className="text-sm font-medium tabular-nums">
                        {formatPercent(clickRate)}
                      </p>
                      <p className="text-muted-foreground text-xs">click rate</p>
                    </div>
                    <CampaignStatusBadge status={campaign.status} />
                  </Link>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col gap-4">
          <Card className="bg-sidebar border-sidebar-border">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="bg-primary/15 text-primary flex size-8 items-center justify-center rounded-lg">
                  <Sparkles className="size-4" />
                </span>
                <div>
                  <CardTitle className="text-[0.95rem]">Geko&apos;s take</CardTitle>
                  <CardDescription>AI insight of the day</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm leading-relaxed">
                Your open rate is{" "}
                <span className="font-semibold">6.2% above</span> your 90-day
                average. Tuesday mornings convert best — schedule your next
                campaign for{" "}
                <span className="font-semibold">Aug 4 at 10:00 AM</span>.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4 w-full"
                onClick={() => setAiOpen(true)}
              >
                <Sparkles /> Ask Geko
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Audience growth</CardTitle>
              <CardDescription>Subscribers over the last 7 months</CardDescription>
            </CardHeader>
            <CardContent>
              <AreaChart
                data={audienceGrowth}
                xKey="date"
                height={180}
                series={[
                  { key: "subscribers", name: "Subscribers", color: "var(--chart-3)" },
                ]}
                xTickFormatter={(v) => v.slice(5)}
              />
              <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                <TrendingUp className="text-success size-4" />
                <p className="text-xs text-muted-foreground">
                  <span className="text-success font-semibold">+201%</span> growth
                  since January
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming & scheduled</CardTitle>
          <CardDescription>Automations and campaigns in the pipeline</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="divide-y">
            <div className="flex items-center gap-4 px-6 py-4">
              <span className="bg-info/10 text-info flex size-9 items-center justify-center rounded-lg">
                <Clock className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Product Launch — New AI Studio</p>
                <p className="text-muted-foreground text-xs">
                  Scheduled for {formatDateTime("2026-08-05T09:00:00Z")}
                </p>
              </div>
              <Badge variant="info">Aug 5</Badge>
            </div>
            <div className="flex items-center gap-4 px-6 py-4">
              <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-lg">
                <Sparkles className="size-4" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">Automation: Welcome Series</p>
                <p className="text-muted-foreground text-xs">
                  {formatNumber(96)} contacts in flow this week
                </p>
              </div>
              <Badge variant="success">Running</Badge>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
