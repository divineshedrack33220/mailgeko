"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  UserPlus,
  ShoppingCart,
  Cake,
  Code2,
  ArrowRight,
  Zap,
  Sparkles,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { automationTemplates, stepsForTemplate } from "@/lib/automation-templates";
import { useAuthStore } from "@/stores/auth-store";
import { canManage } from "@/lib/permissions";
import type { AutomationStep } from "@/lib/types";

const triggerOptions: {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  accent?: string;
}[] = [
  {
    id: "welcome",
    title: "New subscriber",
    description: "When someone joins a list or subscribes to your forms.",
    icon: UserPlus,
    color: "text-primary",
    bg: "bg-primary/10",
    accent: "Popular",
  },
  {
    id: "purchase",
    title: "Purchase made",
    description: "Designed to start when a contact completes a checkout or order.",
    icon: ShoppingCart,
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
  },
  {
    id: "abandoned_cart",
    title: "Cart abandoned",
    description: "Designed to start when a contact leaves items in their cart.",
    icon: ShoppingCart,
    color: "text-amber-500",
    bg: "bg-warning/10",
  },
  {
    id: "birthday",
    title: "Birthday",
    description: "Designed to start on a contact's birthday.",
    icon: Cake,
    color: "text-rose-500",
    bg: "bg-rose-500/10",
  },
  {
    id: "custom",
    title: "Custom event",
    description: "Designed to start from a webhook, API call, or segment change.",
    icon: Code2,
    color: "text-violet-500",
    bg: "bg-violet-500/10",
  },
];

export default function NewAutomationPage() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);

  React.useEffect(() => {
    if (role && !canManage(role)) router.replace("/dashboard");
  }, [role, router]);

  if (role && !canManage(role)) return null;

  const [name, setName] = React.useState("");
  const [selected, setSelected] = React.useState<string | null>(null);
  const [creating, setCreating] = React.useState(false);

  const create = async (triggerId: string, triggerLabel: string, steps: AutomationStep[]) => {
    setCreating(true);
    try {
      const res = await api.post<{ automation: { id: string } }>("/api/v1/automations", {
        name: name.trim() || triggerLabel,
        description: "",
        trigger: {
          type: triggerId,
          label: triggerLabel,
          conditions: [],
          delay: 0,
        },
        steps,
        status: "draft",
      });
      router.push(`/automations/${res.automation.id}`);
    } catch (err) {
      setCreating(false);
      toast.error(err instanceof Error ? err.message : "Could not create automation");
    }
  };

  const startFromTemplate = (id: string) => {
    const template = automationTemplates.find((t) => t.id === id);
    if (!template) return;
    create(template.id, template.title, stepsForTemplate(id));
  };

  const createBlank = () => {
    const trigger =
      triggerOptions.find((t) => t.id === selected) ?? triggerOptions.find((t) => t.id === "welcome");
    create(trigger!.id, trigger!.title, []);
  };

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8 lg:px-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground mb-6 -ml-2">
        <Link href="/automations">
          <ChevronLeft /> Back to automations
        </Link>
      </Button>

      <div className="mb-8">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
          <Zap className="size-3.5" /> Step 1 of 2 — Choose a trigger
        </div>
        <h1 className="text-2xl font-bold tracking-tight">Create a new automation</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Execution preview. Automations are a design tool today — the flows you
          build here are saved, but they won&apos;t send or act on their own yet.
          Running automations is next on the roadmap.
        </p>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="automation-name" className="text-sm font-medium">
          Name your automation
        </Label>
        <Input
          id="automation-name"
          placeholder="e.g. Post-purchase upsell"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mb-4 h-11"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {triggerOptions.map((trigger) => (
          <button
            key={trigger.id}
            onClick={() => setSelected(trigger.id)}
            className={cn(
              "bg-card group relative cursor-pointer rounded-xl border-2 p-4 text-left transition-all",
              selected === trigger.id
                ? "border-primary ring-primary/20 ring-4"
                : "border-border hover:border-primary/40"
            )}
          >
            {trigger.accent && (
              <span className="bg-primary/10 text-primary absolute top-3 right-3 rounded-full px-2 py-0.5 text-[0.6rem] font-semibold tracking-wide uppercase">
                {trigger.accent}
              </span>
            )}
            <div className="flex items-center gap-3">
              <span
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-xl",
                  trigger.bg,
                  trigger.color
                )}
              >
                <trigger.icon className="size-5" />
              </span>
              <div>
                <p className="text-sm font-semibold">{trigger.title}</p>
                <p className="text-muted-foreground text-xs">{trigger.description}</p>
              </div>
            </div>
          </button>
        ))}

        <button
          onClick={createBlank}
          className={cn(
            "group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-center transition-all",
            selected === "blank"
              ? "border-primary bg-primary/5"
              : "border-border text-muted-foreground hover:border-primary/40 hover:text-foreground"
          )}
        >
          <Sparkles className="size-6" />
          <span className="text-sm font-semibold">Blank workflow</span>
          <span className="text-xs">Start from scratch</span>
        </button>
      </div>

      <div className="mt-10">
        <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="text-primary size-4" /> Start from a template
        </h2>
        <p className="text-muted-foreground mb-4 text-xs">
          A starting point for your own design — each one creates a draft.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {automationTemplates.map((template) => (
            <button
              key={template.id}
              onClick={() => startFromTemplate(template.id)}
              className="bg-card hover:border-primary/40 hover:bg-accent group flex cursor-pointer items-center gap-3 rounded-xl border p-4 text-left transition-all"
            >
              <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-lg">
                <template.icon className="size-4.5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{template.title}</p>
                <p className="text-muted-foreground truncate text-xs">{template.description}</p>
              </div>
              <ArrowRight className="text-muted-foreground group-hover:text-foreground size-4 shrink-0 transition-transform group-hover:translate-x-0.5" />
            </button>
          ))}
        </div>
      </div>

      <div className="sticky bottom-4 mt-10 flex justify-end">
        <Button size="lg" onClick={createBlank} disabled={!name && !selected} className="shadow-lg">
          {creating ? <Loader2 className="animate-spin" /> : null}
          Continue to builder <ArrowRight />
        </Button>
      </div>
    </div>
  );
}
