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
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { cn } from "@/lib/utils";
import { timeAgo, formatNumber } from "@/lib/format";
import { templates as mockTemplates } from "@/lib/mock";
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
  const [templates, setTemplates] = React.useState(mockTemplates);
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState<"all" | TemplateCategory>("all");
  const [onlyFavorites, setOnlyFavorites] = React.useState(false);
  const [view, setView] = React.useState<"grid" | "list">("grid");

  const filtered = templates.filter((t) => {
    const matchesSearch =
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.category.toLowerCase().includes(search.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()));
    const matchesCategory = category === "all" || t.category === category;
    const matchesFav = !onlyFavorites || t.isFavorite;
    return matchesSearch && matchesCategory && matchesFav;
  });

  const toggleFavorite = (id: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, isFavorite: !t.isFavorite } : t))
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Templates"
        description="Reusable, responsive email templates built with MJML."
        icon={FileText}
        actions={
          <>
            <Button variant="outline" onClick={() => toast.info("Geko can draft a template from a prompt")}>
              <Sparkles /> Generate with AI
            </Button>
            <Button asChild>
              <Link href="/templates/new">
                <Plus /> New template
              </Link>
            </Button>
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

      {filtered.length === 0 ? (
        <EmptyState
          title="No templates found"
          description={
            search
              ? "Try a different search term or category."
              : "Create your first template or generate one with AI."
          }
          actionLabel={search ? undefined : "Create template"}
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
                    <DropdownMenuItem
                      className="cursor-pointer"
                      onClick={() => toast.success(`"${template.name}" duplicated`)}
                    >
                      <Copy /> Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="cursor-pointer"
                      variant="destructive"
                      onClick={() => {
                        setTemplates((prev) => prev.filter((t) => t.id !== template.id));
                        toast.success(`"${template.name}" deleted`);
                      }}
                    >
                      <Trash2 /> Delete
                    </DropdownMenuItem>
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
    </div>
  );
}
