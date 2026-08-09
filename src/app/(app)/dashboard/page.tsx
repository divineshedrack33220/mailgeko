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
import { CampaignStatusBadge } from "@/components/shared/status-badges";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { formatDateTime, formatNumber, formatPercent, greetingForTime } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { canManage, isAdminRole } from "@/lib/permissions";
import type { Campaign, CampaignStats } from "@/lib/types";

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

interface AnalyticsTotals {
  recipients: number;
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  unsubscribed: number;
  uniqueOpens: number;
  uniqueClicks: number;
}

interface OverviewResponse {
  subscribers?: number;
  totals: AnalyticsTotals;
  rates: {
    deliverability: number;
    openRate: number;
    clickRate: number;
    bounceRate: number;
    unsubscribeRate: number;
  };
  analyticsAvailable: boolean;
  series: { date: string; value: number; secondary: number }[];
}

export default function DashboardPage() {
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  const user = useAuthStore((s) => s.user);
  const role = useAuthStore((s) => s.role);
  const manage = canManage(role);
  const [range, setRange] = React.useState("7d");
  const [metric, setMetric] = React.useState<"opens" | "clicks">("opens");
  const [loading, setLoading] = React.useState(true);
  const [overview, setOverview] = React.useState<OverviewResponse | null>(null);
  const [devices, setDevices] = React.useState<{ name: string; count: number }[]>([]);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);

  const loadOverview = React.useCallback(async () => {
    try {
      const [overviewRes, devicesRes] = await Promise.all([
        api.get<OverviewResponse>(`/api/v1/analytics/overview?range=${range}`),
        api.get<{ devices: { name: string; count: number }[] }>(`/api/v1/analytics/devices?range=${range}`),
      ]);
      setOverview(overviewRes);
      setDevices(devicesRes.devices ?? []);
    } catch (err) {
      console.error("Failed to load dashboard analytics", err);
    }
  }, [range]);

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        await loadOverview();
        const campRes = await api.get<{ campaigns: Campaign[] }>("/api/v1/campaigns");
        setCampaigns(campRes.campaigns ?? []);
      } catch (err) {
        console.error("Failed to load dashboard data", err);
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [loadOverview]);

  const firstName = user?.name?.split(" ")[0] ?? "there";

  const seriesData = (overview?.series ?? []).map((p) => ({
    date: p.date,
    opens: p.value,
    clicks: p.secondary,
  }));

  const totalOpens = overview?.totals?.uniqueOpens ?? 0;
  const totalSends = overview?.totals?.sent ?? 0;
  const openRate = overview?.rates?.openRate ?? 0;
  const clickRate = overview?.rates?.clickRate ?? 0;

  const recentCampaigns = campaigns
    .filter((c) => c.type !== "test")
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4);

  const scheduledCampaigns = campaigns.filter((c) => c.status === "scheduled");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{greetingForTime()}, {firstName}</h2>
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
          {manage && (
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus /> New campaign
              </Link>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Subscribers"
          value={formatNumber(overview?.subscribers ?? 0)}
          icon={Users}
          hint="Total contacts in your account"
          loading={loading}
        />
        <StatCard
          label="Emails sent"
          value={formatNumber(totalSends)}
          icon={Send}
          hint={`Across ${campaigns.length} campaigns`}
          loading={loading}
        />
        <StatCard
          label="Open rate"
          value={formatPercent(openRate)}
          icon={MailOpen}
          hint="Unique opens ÷ delivered"
          loading={loading}
        />
        <StatCard
          label="Click rate"
          value={formatPercent(clickRate)}
          icon={MousePointerClick}
          hint="Unique clicks ÷ unique opens"
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
            ) : seriesData.length === 0 ? (
              <div className="flex h-64 items-center justify-center">
                <p className="text-muted-foreground text-sm">No opens or clicks recorded yet.</p>
              </div>
            ) : (
              <AreaChart
                data={seriesData}
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
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : devices.length === 0 ? (
              <div className="flex h-52 items-center justify-center">
                <p className="text-muted-foreground text-sm">No device data yet.</p>
              </div>
            ) : (
              <>
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
              </>
            )}
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
            {loading ? (
              <div className="p-6">
                <Skeleton className="h-24 w-full" />
              </div>
            ) : recentCampaigns.length === 0 ? (
              <EmptyState
                title="No campaigns yet"
                description="Create your first campaign to start engaging your audience."
                actionLabel={manage ? "New campaign" : undefined}
                actionHref={manage ? "/campaigns/new" : undefined}
                icon={Send}
                className="border-0"
              />
            ) : (
              <div className="divide-y">
                {recentCampaigns.map((campaign) => {
                  const stats = campaign.stats ?? EMPTY_STATS;
                  const openRate = stats.delivered
                    ? (stats.uniqueOpens / stats.delivered) * 100
                    : 0;
                  const clickRate = stats.delivered
                    ? (stats.uniqueClicks / stats.delivered) * 100
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
            )}
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
              {loading ? (
                <Skeleton className="h-24 w-full" />
              ) : (
                <>
                  <p className="text-sm leading-relaxed">
                    Your open rate is{" "}
                    <span className="font-semibold">{formatPercent(openRate)}</span> with{" "}
                    <span className="font-semibold">{formatNumber(totalOpens)}</span> unique opens
                    in the last {range.replace("d", " days")}. Send a follow-up to
                    anyone who opened but didn&apos;t click to recover attention.
                  </p>
                  {isAdminRole(role) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full"
                      onClick={() => setAiOpen(true)}
                    >
                      <Sparkles /> Ask Geko
                    </Button>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Open volume</CardTitle>
              <CardDescription>Opens over the selected period</CardDescription>
            </CardHeader>
            <CardContent>
              {seriesData.length === 0 ? (
                <div className="flex h-44 items-center justify-center">
                  <p className="text-muted-foreground text-sm">No data yet.</p>
                </div>
              ) : (
                <>
                  <AreaChart
                    data={seriesData}
                    xKey="date"
                    height={180}
                    series={[
                      { key: "opens", name: "Opens", color: "var(--chart-3)" },
                    ]}
                    xTickFormatter={(v) => v.slice(5)}
                  />
                  <div className="mt-3 flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2.5">
                    <TrendingUp className="text-success size-4" />
                    <p className="text-xs text-muted-foreground">
                      <span className="text-success font-semibold">
                        {formatNumber(totalOpens)}
                      </span>{" "}
                      unique opens this period
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Upcoming & scheduled</CardTitle>
          <CardDescription>Campaigns that are scheduled to send</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6">
              <Skeleton className="h-16 w-full" />
            </div>
          ) : scheduledCampaigns.length === 0 ? (
            <div className="px-6 py-8 text-center">
              <p className="text-muted-foreground text-sm">Nothing scheduled right now.</p>
            </div>
          ) : (
            <div className="divide-y">
              {scheduledCampaigns.map((campaign) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="hover:bg-muted/40 flex items-center gap-4 px-6 py-4 transition-colors"
                >
                  <span className="bg-info/10 text-info flex size-9 items-center justify-center rounded-lg">
                    <Clock className="size-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{campaign.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {campaign.scheduleAt
                        ? `Scheduled for ${formatDateTime(campaign.scheduleAt)}`
                        : "Ready to send"}
                    </p>
                  </div>
                  <CampaignStatusBadge status={campaign.status} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
