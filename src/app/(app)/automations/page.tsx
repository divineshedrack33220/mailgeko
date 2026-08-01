"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Workflow,
  Plus,
  MoreHorizontal,
  Trash2,
  Copy,
  Pause,
  Play,
  Pencil,
  Zap,
  Mail,
  GitBranch,
  Clock,
  Tag,
  Webhook,
  UserMinus,
  ArrowRight,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AutomationStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatNumber, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import { automationTemplates, stepsForTemplate } from "@/lib/automation-templates";
import type { Automation, AutomationStatus, AutomationStepType } from "@/lib/types";

const stepIcons: Record<AutomationStepType, React.ComponentType<{ className?: string }>> = {
  "send-email": Mail,
  condition: GitBranch,
  delay: Clock,
  "add-tag": Tag,
  "remove-tag": Tag,
  unsubscribe: UserMinus,
  webhook: Webhook,
};

export default function AutomationsPage() {
  const router = useRouter();
  const [automations, setAutomations] = React.useState<Automation[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [tab, setTab] = React.useState("all");
  const [templateOpen, setTemplateOpen] = React.useState(false);
  const [creating, setCreating] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ automations: Automation[] }>("/api/v1/automations");
      setAutomations(res.automations ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load automations");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const run = async () => {
      await load();
    };
    run();
  }, [load]);

  const filtered = automations.filter(
    (a) => tab === "all" || a.status === (tab as AutomationStatus)
  );

  const counts = {
    all: automations.length,
    active: automations.filter((a) => a.status === "active").length,
    paused: automations.filter((a) => a.status === "paused").length,
    draft: automations.filter((a) => a.status === "draft").length,
  };

  const payloadFor = (a: Automation, status: AutomationStatus) => ({
    name: a.name,
    description: a.description,
    trigger: {
      type: a.trigger?.type ?? "custom",
      label: a.trigger?.label ?? "",
      conditions: a.trigger?.conditions ?? [],
      delay: a.trigger?.delay,
    },
    steps: a.steps ?? [],
    status,
  });

  const toggleStatus = async (automation: Automation) => {
    const next: AutomationStatus = automation.status === "active" ? "paused" : "active";
    try {
      await api.patch(`/api/v1/automations/${automation.id}`, payloadFor(automation, next));
      toast.success(next === "active" ? "Automation activated" : "Automation paused");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update automation");
    }
  };

  const duplicateAutomation = async (automation: Automation) => {
    try {
      await api.post(`/api/v1/automations/${automation.id}/duplicate`, {});
      toast.success(`"${automation.name}" duplicated`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate automation");
    }
  };

  const deleteAutomation = async (automation: Automation) => {
    try {
      await api.delete(`/api/v1/automations/${automation.id}`);
      toast.success(`"${automation.name}" deleted`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete automation");
    }
  };

  const createFromTemplate = async (templateId: string) => {
    const template = automationTemplates.find((t) => t.id === templateId);
    if (!template) return;
    setCreating(templateId);
    try {
      const res = await api.post<{ automation: { id: string } }>("/api/v1/automations", {
        name: template.title,
        description: "",
        trigger: {
          type: templateId,
          label: template.title,
          conditions: [],
          delay: 0,
        },
        steps: stepsForTemplate(templateId),
        status: "draft",
      });
      setTemplateOpen(false);
      toast.success(`"${template.title}" created — customise it in the builder`);
      await load();
      router.push(`/automations/${res.automation.id}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create automation");
    } finally {
      setCreating(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Automations"
        description="Visual workflows that send the right message at the right moment."
        icon={Workflow}
        actions={
          <>
            <Button variant="outline" onClick={() => setTemplateOpen(true)}>
              <Zap /> Templates
            </Button>
            <Button asChild>
              <Link href="/automations/new">
                <Plus /> New automation
              </Link>
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-1">{counts.all}</Badge>
          </TabsTrigger>
          <TabsTrigger value="active">
            Active
            <Badge variant="secondary" className="ml-1">{counts.active}</Badge>
          </TabsTrigger>
          <TabsTrigger value="paused">
            Paused
            <Badge variant="secondary" className="ml-1">{counts.paused}</Badge>
          </TabsTrigger>
          <TabsTrigger value="draft">
            Drafts
            <Badge variant="secondary" className="ml-1">{counts.draft}</Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <Loader2 className="animate-spin text-muted-foreground size-6" />
          <p className="text-muted-foreground text-sm">Loading automations…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={automations.length === 0 ? "No automations yet" : "No automations found"}
          description="Build a workflow that runs on its own — like a welcome series or abandoned-cart recovery."
          actionLabel={automations.length === 0 ? "New automation" : undefined}
          actionHref={automations.length === 0 ? "/automations/new" : undefined}
          icon={Workflow}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((automation) => (
            <Card key={automation.id} className="card-hover group gap-4 py-5">
              <div className="flex items-start justify-between px-5">
                <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                  <Workflow className="size-5" />
                </span>
                <div className="flex items-center gap-1">
                  {automation.status === "active" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleStatus(automation)}
                      aria-label="Pause automation"
                    >
                      <Pause />
                    </Button>
                  )}
                  {automation.status !== "active" && (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleStatus(automation)}
                      aria-label="Activate automation"
                    >
                      <Play />
                    </Button>
                  )}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label="Automation actions">
                        <MoreHorizontal />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      <DropdownMenuLabel>Automation</DropdownMenuLabel>
                      <DropdownMenuItem className="cursor-pointer" asChild>
                        <Link href={`/automations/${automation.id}`}>
                          <Pencil /> Edit workflow
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => duplicateAutomation(automation)}
                      >
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="cursor-pointer"
                        variant="destructive"
                        onClick={() => deleteAutomation(automation)}
                      >
                        <Trash2 /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div className="px-5">
                <Link
                  href={`/automations/${automation.id}`}
                  className="hover:text-primary text-[0.95rem] font-semibold transition-colors"
                >
                  {automation.name}
                </Link>
                <p className="text-muted-foreground mt-1 line-clamp-1 text-sm">
                  {automation.description}
                </p>
              </div>

              <div className="border-y bg-muted/20 px-5 py-3">
                <div className="flex items-center gap-2 text-sm">
                  <Zap className="text-primary size-4 shrink-0" />
                  <span className="truncate text-xs font-medium">
                    Trigger: {automation.trigger?.label ?? ""}
                  </span>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5 overflow-hidden">
                  <span className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                    <Zap className="size-3.5" />
                  </span>
                  {(automation.steps ?? []).slice(0, 5).map((step) => {
                    const Icon = stepIcons[step.type];
                    return (
                      <React.Fragment key={step.id}>
                        <ArrowRight className="text-muted-foreground/50 size-3 shrink-0" />
                        <span className="bg-secondary text-secondary-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                          <Icon className="size-3.5" />
                        </span>
                      </React.Fragment>
                    );
                  })}
                  {(automation.steps ?? []).length > 5 && (
                    <>
                      <ArrowRight className="text-muted-foreground/50 size-3 shrink-0" />
                      <span className="text-muted-foreground text-[0.65rem] font-medium">
                        +{(automation.steps ?? []).length - 5}
                      </span>
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between px-5">
                <div>
                  <p className="text-lg font-semibold tabular-nums">
                    {automation.activeCount != null ? formatNumber(automation.activeCount) : "—"}
                  </p>
                  <p className="text-muted-foreground text-xs">in flow this week</p>
                </div>
                <div className="text-right">
                  <AutomationStatusBadge status={automation.status} />
                  <p className="text-muted-foreground mt-1 text-[0.7rem]">
                    Updated {timeAgo(automation.updatedAt)}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={templateOpen} onOpenChange={setTemplateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Start from a template</DialogTitle>
            <DialogDescription>
              Battle-tested flows, preconfigured in seconds. Pick one to create a draft.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {automationTemplates.map((template) => (
              <button
                key={template.id}
                onClick={() => createFromTemplate(template.id)}
                disabled={creating !== null}
                className="bg-card hover:border-primary/40 hover:bg-accent group flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                  {creating === template.id ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <template.icon className="size-4.5" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold">{template.title}</p>
                  <p className="text-muted-foreground truncate text-xs">{template.description}</p>
                </div>
                <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
