"use client";

import * as React from "react";
import Link from "next/link";
import {
  Send,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Pencil,
  Trash2,
  Pause,
  Play,
  ArrowUpDown,
  Mail,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { CampaignStatusBadge } from "@/components/shared/status-badges";
import { cn } from "@/lib/utils";
import { formatNumber, formatPercent, timeAgo } from "@/lib/format";
import { campaigns as mockCampaigns, lists } from "@/lib/mock";
import type { Campaign, CampaignStatus } from "@/lib/types";

export default function CampaignsPage() {
  const [tab, setTab] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [listFilter, setListFilter] = React.useState("all");
  const [campaigns, setCampaigns] = React.useState(mockCampaigns);
  const [deleteTarget, setDeleteTarget] = React.useState<Campaign | null>(null);

  const filtered = campaigns.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.subject.toLowerCase().includes(search.toLowerCase());
    const matchesTab =
      tab === "all" ||
      (tab === "scheduled" && (c.status === "scheduled" || c.status === "sending")) ||
      (tab === "automated" && c.type === "automated") ||
      (tab === "drafts" && c.status === "draft");
    const matchesList =
      listFilter === "all" ||
      (c.listIds ?? []).includes(listFilter);
    return matchesSearch && matchesTab && matchesList;
  });

  const counts = React.useMemo(
    () => ({
      all: campaigns.length,
      drafts: campaigns.filter((c) => c.status === "draft").length,
      scheduled: campaigns.filter((c) => c.status === "scheduled" || c.status === "sending").length,
      automated: campaigns.filter((c) => c.type === "automated").length,
    }),
    [campaigns]
  );

  const handleDelete = () => {
    if (!deleteTarget) return;
    setCampaigns((prev) => prev.filter((c) => c.id !== deleteTarget.id));
    toast.success(`"${deleteTarget.name}" deleted`);
    setDeleteTarget(null);
  };

  const togglePause = (campaign: Campaign) => {
    const isPaused = campaign.status === "paused";
    setCampaigns((prev) =>
      prev.map((c) =>
        c.id === campaign.id
          ? { ...c, status: (isPaused ? "sending" : "paused") as CampaignStatus }
          : c
      )
    );
    toast.success(isPaused ? "Campaign resumed" : "Campaign paused");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campaigns"
        description="Create, schedule, and track email campaigns across your audience."
        icon={Send}
        actions={
          <>
            <Button variant="outline" asChild>
              <Link href="/automations">
                <Pause /> Automations
              </Link>
            </Button>
            <Button asChild>
              <Link href="/campaigns/new">
                <Plus /> New campaign
              </Link>
            </Button>
          </>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList>
              <TabsTrigger value="all">
                All campaigns
                <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
              </TabsTrigger>
              <TabsTrigger value="scheduled">
                Scheduled
                <Badge variant="secondary" className="ml-1">{counts.scheduled}</Badge>
              </TabsTrigger>
              <TabsTrigger value="automated">Automated</TabsTrigger>
              <TabsTrigger value="drafts">
                Drafts
                <Badge variant="secondary" className="ml-1">{counts.drafts}</Badge>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search campaigns…"
                className="h-9 w-56 pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={listFilter} onValueChange={setListFilter}>
              <SelectTrigger className="w-36" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All lists</SelectItem>
                {lists.map((l) => (
                  <SelectItem key={l.id} value={l.id}>
                    {l.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <span className="bg-secondary text-secondary-foreground mb-3 flex size-12 items-center justify-center rounded-2xl">
              <Mail className="size-6" />
            </span>
            <h3 className="font-semibold">No campaigns found</h3>
            <p className="text-muted-foreground mt-1 text-sm">
              {search ? "Try a different search term." : "Create your first campaign to get started."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="pl-6">
                    <button className="hover:text-foreground flex cursor-pointer items-center gap-1 transition-colors">
                      Campaign <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Recipients</TableHead>
                <TableHead className="text-right">Open rate</TableHead>
                <TableHead className="text-right">Click rate</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((campaign) => {
                const openRate = campaign.stats.delivered
                  ? (campaign.stats.uniqueOpens / campaign.stats.delivered) * 100
                  : 0;
                const clickRate = campaign.stats.delivered
                  ? (campaign.stats.uniqueClicks / campaign.stats.delivered) * 100
                  : 0;
                const recipients = campaign.type === "automated" ? campaign.stats.sent : campaign.stats.recipients;
                return (
                  <TableRow key={campaign.id} className="group">
                    <TableCell className="pl-6">
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "flex size-9 shrink-0 items-center justify-center rounded-lg",
                            campaign.type === "automated"
                              ? "bg-primary/10 text-primary"
                              : "bg-secondary text-secondary-foreground"
                          )}
                        >
                          {campaign.type === "automated" ? <Mail className="size-4" /> : <Send className="size-4" />}
                        </span>
                        <div className="min-w-0">
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="hover:text-primary block max-w-[300px] truncate text-sm font-medium transition-colors"
                          >
                            {campaign.name}
                          </Link>
                          <p className="text-muted-foreground max-w-[300px] truncate text-xs">
                            {campaign.subject}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <CampaignStatusBadge status={campaign.status} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatNumber(recipients)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.stats.delivered ? formatPercent(openRate) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {campaign.stats.delivered ? formatPercent(clickRate) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {timeAgo(campaign.updatedAt)}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex items-center justify-end gap-1">
                        {campaign.status === "sending" || campaign.status === "paused" ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => togglePause(campaign)}
                            aria-label={campaign.status === "paused" ? "Resume" : "Pause"}
                          >
                            {campaign.status === "paused" ? <Play /> : <Pause />}
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                              aria-label="Campaign actions"
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>Campaign</DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer" asChild>
                              <Link href={`/campaigns/${campaign.id}`}>
                                <Pencil /> Edit campaign
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="cursor-pointer"
                              onClick={() => toast.success(`"${campaign.name}" duplicated`)}
                            >
                              <Copy /> Duplicate
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="cursor-pointer"
                              variant="destructive"
                              onClick={() => setDeleteTarget(campaign)}
                            >
                              <Trash2 /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            </Table>
          </div>
        )}
      </Card>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              <span className="font-medium text-foreground">&quot;{deleteTarget?.name}&quot;</span> will be
              permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
              Delete campaign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
