"use client";

import * as React from "react";
import Link from "next/link";
import {
  FileText,
  Plus,
  Search,
  MoreHorizontal,
  Copy,
  Trash2,
  Star,
  Sparkles,
  Grid2X2,
  List,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { timeAgo, formatNumber } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { canManage } from "@/lib/permissions";
import type { Template, TemplateCategory } from "@/lib/types";
import { EmptyState } from "@/components/shared/empty-state";

const thumbnailStyles: Record<Template["thumbnail"], string> = {
  promo: "from-amber-500/80 to-orange-600/80",
  newsletter: "from-emerald-500/80 to-teal-600/80",
  welcome: "from-sky-500/80 to-indigo-600/80",
  transactional: "from-slate-500/80 to-slate-700/80",
  cart: "from-violet-500/80 to-purple-600/80",
};

const thumbnailIcons: Record<Template["thumbnail"], string> = {
  promo: "%",
  newsletter: "N",
  welcome: "👋",
  transactional: "$",
  cart: "🛒",
};

const categories: Array<"all" | TemplateCategory> = [
  "all",
  "Welcome",
  "Newsletter",
  "Promotional",
  "Transactional",
  "Abandoned Cart",
  "Re-engagement",
  "Announcement",
];

export default function TemplatesPage() {
  const role = useAuthStore((s) => s.role);
  const manage = canManage(role);
  const [templates, setTemplates] = React.useState<Template[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<"all" | TemplateCategory>("all");
  const [onlyFavorites, setOnlyFavorites] = React.useState(false);
  const [view, setView] = React.useState<"grid" | "list">("grid");
  const [deleteTarget, setDeleteTarget] = React.useState<Template | null>(null);
  const [aiOpen, setAiOpen] = React.useState(false);
  const [aiPrompt, setAiPrompt] = React.useState("");
  const [aiGenerating, setAiGenerating] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const res = await api.get<{ templates: Template[] }>("/api/v1/templates");
      setTemplates(res.templates ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load templates");
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

  const filtered = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      (t.tags ?? []).some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = category === "all" || t.category === category;
    const matchesFav = !onlyFavorites || t.isFavorite;
    return matchesSearch && matchesCategory && matchesFav;
  });

  const toggleFavorite = async (id: string) => {
    const template = templates.find((t) => t.id === id);
    if (!template) return;
    const next = { ...template, isFavorite: !template.isFavorite };
    setTemplates((prev) => prev.map((t) => (t.id === id ? next : t)));
    try {
      await api.patch(`/api/v1/templates/${id}`, {
        name: template.name,
        description: template.description,
        category: template.category,
        thumbnail: template.thumbnail,
        mjml: template.mjml,
        html: template.html,
        variables: template.variables,
        tags: template.tags,
        isFavorite: next.isFavorite,
      });
    } catch (err) {
      setTemplates((prev) => prev.map((t) => (t.id === id ? template : t)));
      toast.error(err instanceof Error ? err.message : "Could not update template");
    }
  };

  const duplicateTemplate = async (template: Template) => {
    try {
      await api.post("/api/v1/templates", {
        name: `${template.name} (copy)`,
        description: template.description,
        category: template.category,
        thumbnail: template.thumbnail,
        mjml: template.mjml,
        html: template.html,
        variables: template.variables,
        tags: template.tags,
        isFavorite: false,
      });
      toast.success(`"${template.name}" duplicated`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate template");
    }
  };

  const deleteTemplate = async (template: Template) => {
    try {
      await api.delete(`/api/v1/templates/${template.id}`);
      toast.success(`"${template.name}" deleted`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete template");
    }
  };

  const generateWithAI = async () => {
    if (!aiPrompt.trim()) {
      toast.error("Describe the template you want first");
      return;
    }
    setAiGenerating(true);
    try {
      const draft = await api.post<{
        name: string;
        category: TemplateCategory;
        mjml: string;
        html: string;
        variables: string[];
        subject: string;
      }>("/api/v1/templates/generate", { prompt: aiPrompt.trim(), brandVoice: "" });
      const thumbnail =
        draft.category === "Welcome"
          ? "welcome"
          : draft.category === "Promotional" || draft.category === "Announcement"
            ? "promo"
            : draft.category === "Transactional"
              ? "transactional"
              : draft.category === "Abandoned Cart"
                ? "cart"
                : "newsletter";
      await api.post("/api/v1/templates", {
        name: draft.name,
        description: draft.subject ?? "",
        category: draft.category,
        thumbnail,
        mjml: draft.mjml,
        html: draft.html,
        variables: draft.variables,
        tags: ["ai"],
        isFavorite: false,
      });
      toast.success(`"${draft.name}" generated`);
      setAiOpen(false);
      setAiPrompt("");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not generate template");
    } finally {
      setAiGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Templates"
        description="Reusable, responsive email templates built with MJML."
        icon={FileText}
        actions={
          <>
            {manage && (
              <Button variant="outline" onClick={() => setAiOpen(true)}>
                <Sparkles /> Generate with AI
              </Button>
            )}
            {manage && (
              <Button asChild>
                <Link href="/templates/new">
                  <Plus /> New template
                </Link>
              </Button>
            )}
          </>
        }
      />

      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <Tabs value={category} onValueChange={(v) => setCategory(v as typeof category)}>
          <TabsList className="flex-wrap justify-start h-auto">
            {categories.map((c) => (
              <TabsTrigger key={c} value={c} className="capitalize">
                {c}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              placeholder="Search templates…"
              className="h-9 w-full pl-9 sm:w-56"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button
            variant={onlyFavorites ? "secondary" : "outline"}
            size="icon-sm"
            onClick={() => setOnlyFavorites((v) => !v)}
            aria-label="Favorites only"
            className={cn(onlyFavorites && "text-warning")}
          >
            <Star className={cn(onlyFavorites && "fill-current")} />
          </Button>
          <div className="bg-muted flex items-center rounded-lg p-0.5">
            <Button
              variant={view === "grid" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("grid")}
              className="h-7 w-7"
              aria-label="Grid view"
            >
              <Grid2X2 />
            </Button>
            <Button
              variant={view === "list" ? "secondary" : "ghost"}
              size="icon-sm"
              onClick={() => setView("list")}
              className="h-7 w-7"
              aria-label="List view"
            >
              <List />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16">
          <Loader2 className="animate-spin text-muted-foreground size-6" />
          <p className="text-muted-foreground text-sm">Loading templates…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          title={templates.length === 0 ? "No templates yet" : "No templates found"}
          description={
            search || category !== "all" || onlyFavorites
              ? "Try a different search term or category."
              : "Create your first template or generate one with AI."
          }
          actionLabel={search || category !== "all" || onlyFavorites ? undefined : "Create template"}
          actionHref={search || category !== "all" || onlyFavorites ? undefined : "/templates/new"}
          icon={FileText}
        />
      ) : view === "grid" ? (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((template, index) => (
            <Card
              key={template.id}
              className="card-hover group animate-fade-in-up gap-0 overflow-hidden py-0"
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <Link href={`/templates/${template.id}`} className="block">
                <div
                  className={cn(
                    "relative flex h-40 items-center justify-center bg-gradient-to-br",
                    thumbnailStyles[template.thumbnail]
                  )}
                >
                  <span className="text-4xl drop-shadow-sm">{thumbnailIcons[template.thumbnail]}</span>
                  <Badge className="absolute top-2.5 left-2.5 bg-background/80 text-foreground backdrop-blur">
                    {template.category}
                  </Badge>
                  {manage && (
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        toggleFavorite(template.id);
                      }}
                      className={cn(
                        "absolute top-2 right-2 flex size-7 cursor-pointer items-center justify-center rounded-full bg-background/80 backdrop-blur transition-all",
                        template.isFavorite ? "text-warning" : "text-muted-foreground opacity-0 group-hover:opacity-100"
                      )}
                      aria-label={template.isFavorite ? "Remove from favorites" : "Add to favorites"}
                    >
                      <Star className={cn("size-4", template.isFavorite && "fill-current")} />
                    </button>
                  )}
                  <span className="bg-primary text-primary-foreground absolute right-2.5 bottom-2.5 rounded-md px-2 py-1 text-[0.65rem] font-medium opacity-0 transition-opacity group-hover:opacity-100">
                    Open editor
                  </span>
                </div>
              </Link>
              <div className="flex items-start justify-between gap-2 p-4">
                <div className="min-w-0">
                  <Link
                    href={`/templates/${template.id}`}
                    className="hover:text-primary block truncate text-sm font-medium transition-colors"
                  >
                    {template.name}
                  </Link>
                  <p className="text-muted-foreground mt-0.5 line-clamp-1 text-xs">
                    {template.description}
                  </p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Template actions">
                      <MoreHorizontal />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuLabel>Template</DropdownMenuLabel>
                    <DropdownMenuItem className="cursor-pointer" asChild>
                      <Link href={`/templates/${template.id}`}>
                        <FileText /> Edit
                      </Link>
                    </DropdownMenuItem>
                    {manage && (
                      <DropdownMenuItem
                        className="cursor-pointer"
                        onClick={() => duplicateTemplate(template)}
                      >
                        <Copy /> Duplicate
                      </DropdownMenuItem>
                    )}
                    {manage && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="cursor-pointer"
                          variant="destructive"
                          onClick={() => setDeleteTarget(template)}
                        >
                          <Trash2 /> Delete
                        </DropdownMenuItem>
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="text-muted-foreground flex items-center justify-between border-t px-4 py-2.5 text-xs">
                <span>Used {formatNumber(template.usedCount)} times</span>
                <span>{timeAgo(template.updatedAt)}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="gap-0 overflow-hidden py-0">
          <div className="divide-y">
            {filtered.map((template) => (
              <Link
                key={template.id}
                href={`/templates/${template.id}`}
                className="hover:bg-muted/40 flex items-center gap-4 px-6 py-4 transition-colors"
              >
                <span
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-bold text-white",
                    thumbnailStyles[template.thumbnail]
                  )}
                >
                  {thumbnailIcons[template.thumbnail]}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{template.name}</p>
                    {template.isFavorite && <Star className="text-warning size-3.5 fill-current" />}
                  </div>
                  <p className="text-muted-foreground truncate text-xs">{template.description}</p>
                </div>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {template.category}
                </Badge>
                <span className="text-muted-foreground hidden text-xs md:block">
                  Used {formatNumber(template.usedCount)} times
                </span>
                <span className="text-muted-foreground hidden text-xs md:block">
                  {timeAgo(template.updatedAt)}
                </span>
              </Link>
            ))}
          </div>
        </Card>
      )}

      <Dialog open={aiOpen} onOpenChange={setAiOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate a template with AI</DialogTitle>
            <DialogDescription>
              Describe what the email should say and who it&apos;s for. Geko drafts
              the template, then saves it to your library for editing.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="e.g. A short welcome email for new SaaS trial signups, friendly and direct, with a CTA to set up their first campaign."
            value={aiPrompt}
            onChange={(e) => setAiPrompt(e.target.value)}
            className="min-h-28"
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setAiOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={generateWithAI} disabled={aiGenerating}>
              {aiGenerating ? <Loader2 className="animate-spin" /> : <Sparkles />}
              {aiGenerating ? "Generating…" : "Generate template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this template?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.name} will be permanently removed. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteTemplate(deleteTarget)}
            >
              <Trash2 /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
