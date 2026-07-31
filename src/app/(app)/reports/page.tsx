"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  MailOpen,
  MousePointerClick,
  Send,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  Flame,
  MonitorSmartphone,
  ExternalLink,
} from "lucide-react";
import { StatCard } from "@/components/shared/stat-card";
import { toast } from "sonner";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart } from "@/components/charts/bar-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { getChartColor } from "@/components/charts/chart-tooltip";
import { formatNumber, formatPercent } from "@/lib/format";
import { campaigns, topClickedLinks, devices, countries } from "@/lib/mock";

const deliveryData = [
  { name: "Delivered", value: 10084 },
  { name: "Opened", value: 4458 },
  { name: "Clicked", value: 1830 },
  { name: "Bounced", value: 214 },
  { name: "Spam", value: 36 },
];

const sendTimeData = [
  [1, 2, 3, 4, 5, 6, 7],
  [2, 3, 4, 5, 6, 7, 8],
  [4, 6, 8, 9, 10, 12, 14],
  [8, 12, 16, 20, 24, 28, 32],
  [14, 20, 28, 36, 44, 52, 60],
  [22, 32, 44, 58, 72, 86, 100],
  [30, 44, 60, 78, 94, 72, 58],
  [38, 56, 76, 96, 80, 60, 46],
  [44, 64, 88, 70, 54, 40, 30],
  [36, 52, 70, 56, 42, 32, 24],
  [24, 34, 46, 38, 28, 22, 16],
  [12, 18, 24, 20, 16, 12, 9],
];

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const bestCampaigns = campaigns
  .filter((c) => c.stats.delivered > 0 && c.type !== "test")
  .map((c) => ({
    id: c.id,
    name: c.name,
    openRate: (c.stats.uniqueOpens / c.stats.delivered) * 100,
    clickRate: (c.stats.uniqueClicks / c.stats.delivered) * 100,
  }))
  .sort((a, b) => b.openRate - a.openRate)
  .slice(0, 6);

const peakCell = sendTimeData.reduce(
  (best, row, hour) =>
    row.reduce((b, value, day) => (value > b.value ? { hour, day, value } : b), best),
  { hour: 0, day: 0, value: -1 }
);

export default function ReportsPage() {
  const [range, setRange] = React.useState("30d");

  const rangeLabel =
    range === "7d" ? "7 days" : range === "90d" ? "90 days" : range === "12m" ? "12 months" : "30 days";

  const totalSends = campaigns
    .filter((c) => c.type !== "test")
    .reduce((sum, c) => sum + c.stats.sent, 0);
  const totalDelivered = campaigns
    .filter((c) => c.type !== "test")
    .reduce((sum, c) => sum + c.stats.delivered, 0);
  const totalOpens = campaigns
    .filter((c) => c.type !== "test")
    .reduce((sum, c) => sum + c.stats.uniqueOpens, 0);
  const totalClicks = campaigns
    .filter((c) => c.type !== "test")
    .reduce((sum, c) => sum + c.stats.uniqueClicks, 0);
  const totalBounced = campaigns
    .filter((c) => c.type !== "test")
    .reduce((sum, c) => sum + c.stats.bounced, 0);

  const openRate = totalDelivered ? (totalOpens / totalDelivered) * 100 : 0;
  const clickRate = totalOpens ? (totalClicks / totalOpens) * 100 : 0;
  const deliverability = totalSends ? ((totalSends - totalBounced) / totalSends) * 100 : 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Reports</h2>
          <p className="text-muted-foreground mt-1 text-sm">
            Deliverability, engagement and audience insights.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={setRange}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="12m">Last 12 months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon-sm" aria-label="Export report" onClick={() => toast.success("Report exported")}>
            <ExternalLink />
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Deliverability"
          value={formatPercent(deliverability)}
          change={0.8}
          icon={ShieldCheck}
          hint="2.1% bounce rate"
        />
        <StatCard
          label="Avg. open rate"
          value={formatPercent(openRate)}
          change={3.2}
          icon={MailOpen}
          hint="vs. industry average"
        />
        <StatCard
          label="Click-through rate"
          value={formatPercent(clickRate)}
          change={-0.9}
          icon={MousePointerClick}
          hint="Clicks per unique open"
        />
        <StatCard
          label="Emails delivered"
          value={formatNumber(totalDelivered)}
          change={14.6}
          icon={Send}
          hint="Across all live campaigns"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Funnel overview</CardTitle>
                <CardDescription>Sent → delivered → opened → clicked</CardDescription>
              </div>
              <CardAction>
                <Badge variant="outline" className="gap-1">
                  <TrendingUp className="text-success size-3" /> {rangeLabel}
                </Badge>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={deliveryData}
              xKey="name"
              height={280}
              series={[
                { key: "value", name: "Contacts", color: "var(--chart-1)" },
              ]}
            />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
              {deliveryData.map((step, i) => {
                const pct = (step.value / deliveryData[0].value) * 100;
                return (
                  <div key={step.name} className="rounded-lg border bg-muted/40 px-3 py-2.5">
                    <p className="text-muted-foreground text-[0.65rem] font-medium uppercase">
                      {step.name}
                    </p>
                    <p className="mt-1 text-sm font-semibold tabular-nums">{formatNumber(step.value)}</p>
                    <div className="mt-1.5 flex items-center gap-1 text-[0.65rem] text-muted-foreground">
                      <span
                        className="size-1.5 rounded-full"
                        style={{ backgroundColor: getChartColor(i) }}
                      />
                      {formatPercent(pct, 0)}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top clicked links</CardTitle>
            <CardDescription>Most engaged destinations this period</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {topClickedLinks.map((link, i) => {
              const max = topClickedLinks[0].clicks;
              return (
                <div key={link.url} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: getChartColor(i) }}
                      />
                      <span className="text-muted-foreground truncate">{link.url.replace("https://", "")}</span>
                    </span>
                    <span className="font-medium tabular-nums">{formatNumber(link.clicks)}</span>
                  </div>
                  <Progress value={(link.clicks / max) * 100} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Top campaigns by open rate</CardTitle>
            <CardDescription>Best performing sends</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {bestCampaigns.map((campaign, i) => (
                <Link
                  key={campaign.id}
                  href={`/campaigns/${campaign.id}`}
                  className="hover:bg-muted/40 flex items-center gap-4 px-5 py-3 transition-colors"
                >
                  <span className="text-muted-foreground w-4 text-xs font-semibold tabular-nums">
                    {i + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{campaign.name}</p>
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Progress value={campaign.openRate} className="h-1 flex-1" />
                      <span className="text-xs font-medium tabular-nums">
                        {formatPercent(campaign.openRate)}
                      </span>
                    </div>
                  </div>
                  <ArrowUpRight className="text-muted-foreground size-4 shrink-0" />
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Devices & platforms</CardTitle>
                <CardDescription>Where your emails are opened</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DonutChart
              data={devices.map((d) => ({ name: d.name, value: d.count }))}
              centerValue={formatNumber(devices.reduce((s, d) => s + d.count, 0))}
              centerLabel="opens"
              height={200}
            />
            <div className="mt-3 space-y-2">
              {devices.slice(0, 4).map((device, i) => (
                <div key={device.name} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full" style={{ backgroundColor: getChartColor(i) }} />
                    <MonitorSmartphone className="size-3.5" />
                    {device.name}
                  </span>
                  <span className="font-medium tabular-nums">{formatNumber(device.count)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Countries</CardTitle>
            <CardDescription>Open volume by location</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {countries.slice(0, 5).map((country) => {
                const max = countries[0].opens;
                return (
                  <div key={country.code} className="flex items-center gap-3 px-5 py-3">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/40 text-xs font-semibold">
                      {country.code}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{country.country}</p>
                      <Progress value={(country.opens / max) * 100} className="mt-1.5 h-1" />
                    </div>
                    <span className="text-sm font-medium tabular-nums">
                      {formatNumber(country.opens)}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Best time to send</CardTitle>
                <CardDescription>
                  Open rate heatmap by hour and weekday (7am – 6pm)
                </CardDescription>
              </div>
              <CardAction>
                <span className="text-success flex items-center gap-1 text-xs font-medium">
                  <Flame className="size-3.5" /> Peak: {weekdays[peakCell.day]} {formatSendTime(peakCell.hour)}
                </span>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <div className="min-w-[540px]">
                <div className="grid grid-cols-[3rem_repeat(7,1fr)] gap-1.5">
                  <div />
                  {weekdays.map((day) => (
                    <div key={day} className="text-muted-foreground pb-1 text-center text-[0.65rem] font-medium">
                      {day}
                    </div>
                  ))}
                  {sendTimeData.map((row, hour) => (
                    <React.Fragment key={hour}>
                      <div className="text-muted-foreground flex items-center text-[0.65rem] font-medium">
                        {formatSendTime(hour)}
                      </div>
                      {row.map((value, day) => {
                        const opacity = 0.08 + (value / 100) * 0.92;
                        const peak = value >= 90;
                        return (
                          <div
                            key={`${hour}-${day}`}
                            className="relative flex h-8 items-center justify-center rounded-md"
                            style={{
                              backgroundColor: peak
                                ? "var(--primary)"
                                : `rgba(16, 185, 129, ${opacity})`,
                              boxShadow: peak ? "0 0 0 1px var(--primary)" : undefined,
                            }}
                          >
                            {peak && <span className="absolute -top-1 right-1 size-1.5 animate-pulse rounded-full bg-background" />}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compared to industry</CardTitle>
            <CardDescription>Your rates vs. peers (email marketing)</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {[
              { label: "Open rate", value: openRate, benchmark: 38.4, better: true },
              { label: "Click rate", value: clickRate, benchmark: 2.7, better: true },
              { label: "Bounce rate", value: 2.1, benchmark: 4.6, better: true },
              { label: "Unsubscribe rate", value: 0.4, benchmark: 0.8, better: true },
            ].map((row) => {
              const diff = row.value - row.benchmark;
              return (
                <div key={row.label}>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{row.label}</span>
                    <div className="flex items-center gap-2">
                      {diff > 0 ? (
                        <span className="text-success flex items-center text-xs font-medium">
                          <TrendingUp className="size-3" /> +{Math.abs(diff).toFixed(1)} pts
                        </span>
                      ) : (
                        <span className="text-destructive flex items-center text-xs font-medium">
                          <TrendingDown className="size-3" /> -{Math.abs(diff).toFixed(1)} pts
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <Progress value={Math.min(100, (row.value / row.benchmark) * 100)} className="h-1.5 flex-1" />
                    <span className="text-muted-foreground w-16 text-right text-xs tabular-nums">
                      {formatPercent(row.value)}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 text-[0.65rem]">
                    Benchmark: {formatPercent(row.benchmark)}
                  </p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function formatSendTime(hour: number): string {
  const h = 7 + hour;
  return h > 12 ? `${h - 12} PM` : `${h} AM`;
}
