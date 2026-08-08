"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Zap,
  Mail,
  GitBranch,
  Clock,
  Tag,
  UserMinus,
  Webhook,
  Save,
  Plus,
  Trash2,
  Play,
  Pause,
  MousePointer2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Settings2,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Automation, AutomationStatus, AutomationStep, AutomationStepType } from "@/lib/types";

const stepMeta: Record<
  AutomationStepType,
  { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }
> = {
  "send-email": {
    label: "Send email",
    icon: Mail,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  condition: {
    label: "Condition",
    icon: GitBranch,
    color: "text-amber-500",
    bg: "bg-warning/10",
  },
  delay: {
    label: "Wait / delay",
    icon: Clock,
    color: "text-sky-500",
    bg: "bg-info/10",
  },
  "add-tag": {
    label: "Add tag",
    icon: Tag,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  "remove-tag": {
    label: "Remove tag",
    icon: Tag,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
  unsubscribe: {
    label: "Unsubscribe",
    icon: UserMinus,
    color: "text-rose-500",
    bg: "bg-destructive/10",
  },
  webhook: {
    label: "Webhook",
    icon: Webhook,
    color: "text-slate-500",
    bg: "bg-slate-500/10",
  },
};

const palette: AutomationStepType[] = [
  "send-email",
  "condition",
  "delay",
  "add-tag",
  "remove-tag",
  "unsubscribe",
  "webhook",
];

let nodeCounter = 0;
function nextNodeId(): string {
  nodeCounter += 1;
  return `node-${Date.now()}-${nodeCounter}`;
}

interface CanvasNode {
  id: string;
  type: "trigger" | AutomationStepType;
  label: string;
  detail?: string;
  x: number;
  y: number;
}

export default function AutomationBuilderPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const [automation, setAutomation] = React.useState<Automation | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [name, setName] = React.useState("");
  const [status, setStatus] = React.useState<AutomationStatus>("draft");
  const [selected, setSelected] = React.useState<string | null>("trigger");
  const [zoom, setZoom] = React.useState(1);
  const [saved, setSaved] = React.useState(false);
  const [drag, setDrag] = React.useState<{ id: string; fromPalette: boolean } | null>(null);
  const [dropIndex, setDropIndex] = React.useState<number | null>(null);
  const [flashNodeId, setFlashNodeId] = React.useState<string | null>(null);

  const [nodes, setNodes] = React.useState<CanvasNode[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ automation: Automation }>(`/api/v1/automations/${params.id}`);
        if (cancelled) return;
        setAutomation(res.automation);
        setName(res.automation.name);
        setStatus(res.automation.status);
        setNodes([
          {
            id: "trigger",
            type: "trigger",
            label: res.automation.trigger?.label ?? "New subscriber",
            detail: res.automation.trigger?.type ?? "welcome",
            x: 0,
            y: 0,
          },
          ...(res.automation.steps ?? []).map((step, index) => ({
            id: step.id,
            type: step.type as CanvasNode["type"],
            label: step.label,
            x: 0,
            y: (index + 1) * 130,
          })),
        ]);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load automation");
          router.replace("/automations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const flashNode = (id: string) => {
    setFlashNodeId(id);
    window.setTimeout(() => setFlashNodeId((prev) => (prev === id ? null : prev)), 2000);
  };

  const addNode = (type: AutomationStepType) => {
    const id = nextNodeId();
    const meta = stepMeta[type];
    setNodes((prev) => {
      const maxY = Math.max(...prev.map((n) => n.y));
      return [
        ...prev,
        { id, type, label: `New: ${meta.label.toLowerCase()}`, x: 0, y: maxY + 130 },
      ];
    });
    setSelected(id);
    flashNode(id);
    toast.success(`Added ${meta.label.toLowerCase()} step`);
  };

  const insertNode = (type: AutomationStepType, index: number) => {
    const id = nextNodeId();
    const meta = stepMeta[type];
    setNodes((prev) => {
      const next = [...prev];
      next.splice(index, 0, {
        id,
        type,
        label: `New: ${meta.label.toLowerCase()}`,
        x: 0,
        y: index * 130,
      });
      return next;
    });
    setSelected(id);
    flashNode(id);
    toast.success(`Added ${meta.label.toLowerCase()} step`);
  };

  const reorderNode = (fromId: string, beforeIndex: number) => {
    setNodes((prev) => {
      const from = prev.findIndex((n) => n.id === fromId);
      if (from === -1) return prev;
      const next = [...prev];
      const [node] = next.splice(from, 1);
      const insertAt = from < beforeIndex ? beforeIndex - 1 : beforeIndex;
      next.splice(insertAt, 0, node);
      return next;
    });
  };

  const handleDrop = (targetIndex: number) => {
    if (!drag) return;
    if (drag.fromPalette) {
      const type = drag.id as AutomationStepType;
      if (stepMeta[type]) insertNode(type, targetIndex);
    } else {
      reorderNode(drag.id, targetIndex);
    }
    setDrag(null);
    setDropIndex(null);
  };

  const handleAppendDrop = () => {
    if (!drag) return;
    if (drag.fromPalette) {
      const type = drag.id as AutomationStepType;
      if (stepMeta[type]) insertNode(type, nodes.length);
    } else {
      reorderNode(drag.id, nodes.length);
    }
    setDrag(null);
    setDropIndex(null);
  };

  const removeNode = (id: string) => {
    setNodes((prev) => prev.filter((n) => n.id !== id));
    setSelected("trigger");
  };

  const updateNodeLabel = (id: string, label: string) => {
    setNodes((prev) => prev.map((n) => (n.id === id ? { ...n, label } : n)));
  };

  const buildPayload = (nextStatus: AutomationStatus) => ({
    name: name.trim(),
    description: automation?.description ?? "",
    trigger: {
      type: automation?.trigger?.type ?? "welcome",
      label: automation?.trigger?.label ?? "New subscriber",
      conditions: automation?.trigger?.conditions ?? [],
      delay: automation?.trigger?.delay ?? 0,
    },
    steps: nodes
      .filter((n) => n.type !== "trigger")
      .map((n): AutomationStep => ({ id: n.id, type: n.type as AutomationStepType, label: n.label, config: {} })),
    status: nextStatus,
  });

  const handleSave = async () => {
    if (!automation) return;
    setSaving(true);
    try {
      await api.patch(`/api/v1/automations/${automation.id}`, buildPayload(status));
      setSaved(true);
      toast.success("Automation saved");
      window.setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save automation");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async () => {
    if (!automation) return;
    const next: AutomationStatus = status === "active" ? "paused" : "active";
    setSaving(true);
    try {
      await api.patch(`/api/v1/automations/${automation.id}`, buildPayload(next));
      setStatus(next);
      toast.success(
        next === "active"
          ? "Saved as active — execution is in preview, so it won't run yet"
          : "Saved as paused"
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update automation");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Loader2 className="animate-spin text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">Loading automation…</p>
      </div>
    );
  }

  if (!automation) return null;

  const selectedNode = nodes.find((n) => n.id === selected);

  return (
    <div className="flex h-[calc(100dvh-10rem)] min-h-[540px] flex-col">
      <div className="flex items-center gap-3 border-b px-4 py-3">
        <Button variant="ghost" size="icon-sm" asChild>
          <Link href="/automations" aria-label="Back to automations">
            <ChevronLeft />
          </Link>
        </Button>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="h-8 w-72 border-transparent bg-transparent font-medium shadow-none hover:border-border focus:border-input"
        />
        <Badge variant={status === "active" ? "success" : status === "paused" ? "warning" : "secondary"} className="hidden sm:inline-flex">
          {status === "active" ? "Active" : status === "paused" ? "Paused" : "Draft"}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          {status !== "active" ? (
            <Button variant="outline" size="sm" onClick={toggleStatus} disabled={saving}>
              <Play /> Activate
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={toggleStatus} disabled={saving}>
              <Pause /> Pause
            </Button>
          )}
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? <Loader2 className="animate-spin" /> : saved ? <Check /> : <Save />}
            {saved ? "Saved" : "Save"}
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1">
        <StepPalette
          onAdd={addNode}
          onDragStart={(type, e) => {
            setDrag({ id: type, fromPalette: true });
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", type);
          }}
          onDragEnd={() => {
            setDrag(null);
            setDropIndex(null);
          }}
        />

        <div className="relative flex-1 min-w-0 overflow-hidden bg-[radial-gradient(var(--border)_1px,transparent_1px)] [background-size:22px_22px]">
          <div className="absolute inset-0 overflow-auto">
            <div
              className="flex min-h-full flex-col items-center pt-8 [transition:gap_0.2s]"
              style={{ gap: 64 * zoom }}
            >
              {nodes.map((node, index) => {
                const next = nodes[index + 1];
                return (
                  <React.Fragment key={node.id}>
                    <div
                      className="flex w-full flex-col items-center"
                      onDragOver={(e) => {
                        if (!drag) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        setDropIndex(index);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                          setDropIndex((prev) => (prev === index ? null : prev));
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleDrop(index);
                      }}
                    >
                      {drag && dropIndex === index && <DropIndicator />}
                      <WorkflowNode
                        node={node}
                        selected={selected === node.id}
                        onSelect={() => setSelected(node.id)}
                        dragging={drag?.id === node.id}
                        flashing={flashNodeId === node.id}
                        onDragStart={(e) => {
                          setDrag({ id: node.id, fromPalette: false });
                          e.dataTransfer.effectAllowed = "move";
                          e.dataTransfer.setData("text/plain", node.id);
                        }}
                        onDragEnd={() => {
                          setDrag(null);
                          setDropIndex(null);
                        }}
                      />
                      {next && (
                        <Connector
                          key={`${node.id}-${index}`}
                          height={64 * zoom}
                          delay={index * 60}
                          label={node.type === "trigger" ? "When triggered" : "Then"}
                        />
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
              <AddNodeRow onAdd={addNode} onDrop={handleAppendDrop} />
            </div>
          </div>

          <div className="bg-card/90 absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur">
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.max(0.6, z - 0.1))} aria-label="Zoom out">
              <ZoomOut />
            </Button>
            <span className="w-10 text-center text-xs font-medium tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom((z) => Math.min(1.4, z + 0.1))} aria-label="Zoom in">
              <ZoomIn />
            </Button>
            <Separator orientation="vertical" className="mx-1 h-4" />
            <Button variant="ghost" size="icon-sm" onClick={() => setZoom(1)} aria-label="Reset view">
              <Maximize />
            </Button>
          </div>
        </div>

        <NodeInspector
          node={selectedNode}
          automation={automation}
          onLabelChange={updateNodeLabel}
          onRemove={selectedNode ? () => removeNode(selectedNode.id) : undefined}
        />
      </div>
    </div>
  );
}

function StepPalette({
  onAdd,
  onDragStart,
  onDragEnd,
}: {
  onAdd: (type: AutomationStepType) => void;
  onDragStart: (type: AutomationStepType, e: React.DragEvent) => void;
  onDragEnd: () => void;
}) {
  return (
    <aside className="bg-card hidden w-56 shrink-0 flex-col border-r lg:flex">
      <div className="border-b px-4 py-3">
        <p className="text-xs font-semibold">Add a step</p>
        <p className="text-muted-foreground mt-0.5 text-xs">
          Click to append, or drag onto the canvas
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="flex flex-col gap-1.5 p-3">
          {palette.map((type) => {
            const meta = stepMeta[type];
            return (
              <button
                key={type}
                draggable
                onClick={() => onAdd(type)}
                onDragStart={(e) => onDragStart(type, e)}
                onDragEnd={onDragEnd}
                className="hover:bg-accent group flex cursor-grab items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors active:cursor-grabbing"
              >
                <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", meta.bg, meta.color)}>
                  <meta.icon className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{meta.label}</span>
                  <span className="text-muted-foreground block text-[0.65rem]">
                    {type === "send-email"
                      ? "Send a campaign or email"
                      : type === "condition"
                        ? "Branch on a rule"
                        : type === "delay"
                          ? "Wait a duration"
                          : type === "unsubscribe"
                            ? "Opt contact out"
                            : type === "webhook"
                              ? "Call an endpoint"
                              : "Update a profile tag"}
                  </span>
                </span>
                <Plus className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
              </button>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}

function WorkflowNode({
  node,
  selected,
  onSelect,
  dragging,
  flashing,
  onDragStart,
  onDragEnd,
}: {
  node: CanvasNode;
  selected: boolean;
  onSelect: () => void;
  dragging?: boolean;
  flashing?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const nodeClass = cn(
    "bg-card relative w-72 cursor-grab rounded-xl border-2 p-4 text-left shadow-sm transition-all active:cursor-grabbing",
    selected
      ? "border-primary ring-primary/20 ring-4"
      : "border-border hover:border-primary/40",
    dragging && "opacity-40 scale-[0.98]",
    flashing && "animate-row-flash"
  );

  if (node.type === "trigger") {
    return (
      <button
        onClick={onSelect}
        draggable
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        className={nodeClass}
      >
        <div className="absolute -top-2.5 left-4">
          <span className="bg-warning text-warning-foreground flex items-center gap-1 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase">
            <Zap className="size-2.5" /> Trigger
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-warning/15 text-warning flex size-10 shrink-0 items-center justify-center rounded-xl">
            <Zap className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{node.label}</p>
            <p className="text-muted-foreground truncate text-xs">
              Every contact that enters this workflow
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
          <MousePointer2 className="size-3.5" />
          Click to configure
        </div>
      </button>
    );
  }

  const meta = stepMeta[node.type];
  return (
    <button
      onClick={onSelect}
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={nodeClass}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl", meta.bg, meta.color)}>
            <meta.icon className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-muted-foreground text-[0.65rem] font-semibold tracking-wide uppercase">
              {meta.label}
            </p>
            <p className="mt-0.5 line-clamp-2 text-sm font-medium">{node.label}</p>
          </div>
        </div>
      </div>
    </button>
  );
}

function DropIndicator() {
  return (
    <div className="animate-grow-y flex flex-col items-center py-1">
      <div className="bg-primary/60 h-5 w-0.5 rounded-full" />
      <Plus className="text-primary size-3" />
    </div>
  );
}

function Connector({ label, height, delay = 0 }: { label: string; height: number; delay?: number }) {
  return (
    <div className="relative flex flex-col items-center" style={{ height }}>
      <div
        className="bg-primary/40 h-full w-px animate-grow-y"
        style={{ transformOrigin: "top", animationDelay: `${delay}ms` }}
      />
      <span className="bg-card text-muted-foreground absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border px-2 py-0.5 text-[0.6rem] font-medium">
        <Play className="size-2.5" />
        {label}
      </span>
    </div>
  );
}

function AddNodeRow({
  onAdd,
  onDrop,
}: {
  onAdd: (type: AutomationStepType) => void;
  onDrop: () => void;
}) {
  return (
    <div
      className="relative flex flex-col items-center"
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
      }}
      onDrop={(e) => {
        e.preventDefault();
        onDrop();
      }}
    >
      <div className="bg-primary/40 h-8 w-px" />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className="border-border hover:border-primary/50 hover:bg-muted/40 flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed px-4 py-2.5 text-sm font-medium text-muted-foreground transition-colors">
            <Plus className="size-4" /> Add step
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Choose a step</DropdownMenuLabel>
          {palette.map((type) => {
            const meta = stepMeta[type];
            return (
              <DropdownMenuItem key={type} className="cursor-pointer gap-2" onClick={() => onAdd(type)}>
                <span className={cn("flex size-7 items-center justify-center rounded-md", meta.bg, meta.color)}>
                  <meta.icon className="size-3.5" />
                </span>
                {meta.label}
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function NodeInspector({
  node,
  automation,
  onLabelChange,
  onRemove,
}: {
  node?: CanvasNode;
  automation: Automation;
  onLabelChange: (id: string, label: string) => void;
  onRemove?: () => void;
}) {
  const isTrigger = node?.type === "trigger";

  return (
    <aside className="bg-card hidden w-80 shrink-0 flex-col border-l md:flex">
      <div className="flex items-center justify-between border-b px-4 py-3">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Settings2 className="text-primary size-4" /> Node settings
        </span>
        {onRemove && !isTrigger && (
          <Button variant="ghost" size="icon-sm" onClick={onRemove} className="text-destructive hover:text-destructive" aria-label="Delete node">
            <Trash2 />
          </Button>
        )}
      </div>

      {!node ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center">
          <p className="text-muted-foreground text-sm">
            Select a node on the canvas to edit its settings.
          </p>
        </div>
      ) : (
        <ScrollArea className="flex-1">
          <div className="flex flex-col gap-5 p-4">
            <div className="flex flex-col gap-2">
              <Label>Name</Label>
              <Input
                value={node.label}
                onChange={(e) => onLabelChange(node.id, e.target.value)}
              />
            </div>

            {isTrigger ? (
              <TriggerConfig automation={automation} />
            ) : node.type === "send-email" ? (
              <EmailStepConfig />
            ) : node.type === "delay" ? (
              <DelayConfig />
            ) : node.type === "condition" ? (
              <ConditionConfig />
            ) : node.type === "add-tag" || node.type === "remove-tag" ? (
              <TagConfig action={node.type === "add-tag" ? "Add" : "Remove"} />
            ) : node.type === "webhook" ? (
              <WebhookConfig />
            ) : (
              <UnsubscribeConfig />
            )}
          </div>
        </ScrollArea>
      )}
    </aside>
  );
}

function TriggerConfig({ automation }: { automation: Automation }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Event</Label>
        <Select defaultValue={automation.trigger?.type ?? "welcome"}>
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="welcome">New subscriber</SelectItem>
            <SelectItem value="purchase">Purchase made</SelectItem>
            <SelectItem value="abandoned_cart">Cart abandoned</SelectItem>
            <SelectItem value="birthday">Birthday</SelectItem>
            <SelectItem value="custom">Custom event</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>Wait before starting</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" defaultValue={automation.trigger?.delay ?? 0} min={0} />
          <Select defaultValue="hours">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Separator />
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Run on re-entry</p>
          <p className="text-muted-foreground text-xs">Restart if a contact triggers again</p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Global opt-out respected</p>
          <p className="text-muted-foreground text-xs">Skip unsubscribed contacts</p>
        </div>
        <Switch defaultChecked />
      </div>
      <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          <span className="font-medium">Execution preview.</span> Automations are a
          design tool today — the flows you build here are saved, but they won&apos;t
          send or act on their own yet. Running automations is next on the roadmap.
        </p>
      </div>
    </div>
  );
}

function EmailStepConfig() {
  const [campaigns, setCampaigns] = React.useState<{ id: string; name: string }[]>([]);
  const [lists, setLists] = React.useState<{ id: string; name: string }[]>([]);
  const [campaign, setCampaign] = React.useState("");
  const [list, setList] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [campaignsRes, listsRes] = await Promise.all([
          api.get<{ campaigns: { id: string; name: string }[] }>("/api/v1/campaigns"),
          api.get<{ lists: { id: string; name: string }[] }>("/api/v1/lists"),
        ]);
        if (!mounted) return;
        const c = campaignsRes.campaigns ?? [];
        const l = listsRes.lists ?? [];
        setCampaigns(c);
        setLists(l);
        setCampaign(c[0]?.id ?? "");
        setList(l[0]?.id ?? "");
      } catch (err) {
        if (!mounted) return;
        toast.error(err instanceof Error ? err.message : "Could not load campaigns");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Campaign or template</Label>
        {loading ? (
          <div className="text-muted-foreground text-xs">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="text-muted-foreground text-xs">
            No campaigns yet — create one in Campaigns first.
          </div>
        ) : (
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="flex flex-col gap-2">
        <Label>Send to</Label>
        {loading ? (
          <div className="text-muted-foreground text-xs">Loading lists…</div>
        ) : lists.length === 0 ? (
          <div className="text-muted-foreground text-xs">
            No lists yet — create one in Contacts first.
          </div>
        ) : (
          <Select value={list} onValueChange={setList}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {lists.map((l) => (
                <SelectItem key={l.id} value={l.id}>{l.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          The email will render each contact&apos;s variables ({"{{first_name}}"},{" "}
          {"{{company}}"}…) automatically.
        </p>
      </div>
    </div>
  );
}

function DelayConfig() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Duration</Label>
        <div className="grid grid-cols-2 gap-2">
          <Input type="number" defaultValue={1} min={1} />
          <Select defaultValue="days">
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
              <SelectItem value="weeks">Weeks</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Only on business days</p>
          <p className="text-muted-foreground text-xs">Skip weekends for this step</p>
        </div>
        <Switch />
      </div>
    </div>
  );
}

function ConditionConfig() {
  const [campaigns, setCampaigns] = React.useState<{ id: string; name: string }[]>([]);
  const [campaign, setCampaign] = React.useState("");
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get<{ campaigns: { id: string; name: string }[] }>(
          "/api/v1/campaigns"
        );
        if (!mounted) return;
        const c = res.campaigns ?? [];
        setCampaigns(c);
        setCampaign(c[0]?.id ?? "");
      } catch (err) {
        if (!mounted) return;
        toast.error(err instanceof Error ? err.message : "Could not load campaigns");
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>If the contact</Label>
        <Select defaultValue="opened">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="opened">Has opened an email</SelectItem>
            <SelectItem value="clicked">Has clicked a link</SelectItem>
            <SelectItem value="tag">Matches a tag</SelectItem>
            <SelectItem value="segment">Is in a segment</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-2">
        <Label>With campaign</Label>
        {loading ? (
          <div className="text-muted-foreground text-xs">Loading campaigns…</div>
        ) : campaigns.length === 0 ? (
          <div className="text-muted-foreground text-xs">
            No campaigns yet — create one in Campaigns first.
          </div>
        ) : (
          <Select value={campaign} onValueChange={setCampaign}>
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {campaigns.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div className="bg-warning/10 border-warning/25 rounded-lg border px-3 py-2.5">
        <p className="text-warning text-xs font-medium">Two branches follow this step</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Contacts matching the rule go down the &quot;Yes&quot; path, everyone else takes
          the &quot;No&quot; path.
        </p>
      </div>
    </div>
  );
}

function TagConfig({ action }: { action: "Add" | "Remove" }) {
  const [value, setValue] = React.useState("");
  const [pickerOpen, setPickerOpen] = React.useState(false);
  const [tags, setTags] = React.useState<{ tag: string; count: number }[]>([]);
  const [loading, setLoading] = React.useState(false);

  const openPicker = async () => {
    setPickerOpen(true);
    setLoading(true);
    try {
      const res = await api.get<{ tags: { tag: string; count: number }[] }>("/api/v1/tags");
      setTags(res.tags ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load tags");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>{action} tag</Label>
        <div className="flex gap-2">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. re-engaged"
            className="flex-1"
          />
          <Button variant="outline" size="icon-sm" aria-label="Choose tag" onClick={openPicker}>
            <Tag />
          </Button>
        </div>
      </div>
      <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Tags are instant — the change applies before the next step runs.
        </p>
      </div>

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a tag</DialogTitle>
            <DialogDescription>
              Pick an existing tag to {action.toLowerCase()} on contacts.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6">
                <Loader2 className="animate-spin text-muted-foreground size-4" />
                <p className="text-muted-foreground text-sm">Loading tags…</p>
              </div>
            ) : tags.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                No tags yet — type a new one in the field above.
              </p>
            ) : (
              tags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => {
                    setValue(t.tag);
                    setPickerOpen(false);
                  }}
                  className="flex cursor-pointer items-center justify-between rounded-lg border-2 px-3 py-2 text-left transition-all hover:border-primary/40"
                >
                  <span className="flex items-center gap-2">
                    <Tag className="text-muted-foreground size-3.5" />
                    <span className="text-sm font-medium">{t.tag}</span>
                  </span>
                  <Badge variant="secondary" className="text-xs">
                    {t.count} contacts
                  </Badge>
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function WebhookConfig() {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <Label>Endpoint URL</Label>
        <Input placeholder="https://your-app.com/hooks/email-opened" className="font-mono text-xs" />
      </div>
      <div className="flex flex-col gap-2">
        <Label>Method</Label>
        <Select defaultValue="post">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="post">POST</SelectItem>
            <SelectItem value="get">GET</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Retry on failure</p>
          <p className="text-muted-foreground text-xs">3 attempts with backoff</p>
        </div>
        <Switch defaultChecked />
      </div>
    </div>
  );
}

function UnsubscribeConfig() {
  return (
    <div className="flex flex-col gap-4">
      <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
        <p className="text-muted-foreground text-xs leading-relaxed">
          Marks the contact as unsubscribed. They stop receiving all
          marketing emails immediately.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <Label>List to unsubscribe from</Label>
        <Select defaultValue="all">
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All lists</SelectItem>
            <SelectItem value="list-001">All Subscribers</SelectItem>
            <SelectItem value="list-002">Product Updates</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
