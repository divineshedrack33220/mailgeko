"use client";

import * as React from "react";
import Link from "next/link";
import {
  ListFilter,
  Plus,
  MoreHorizontal,
  Trash2,
  Pencil,
  Users,
  Copy,
  Filter,
  X,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
import { Separator } from "@/components/ui/separator";
import { formatNumber, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import type { ContactList, Segment, SegmentCondition } from "@/lib/types";

let conditionSeq = 0;
function conditionId(): string {
  conditionSeq += 1;
  return `c-${conditionSeq}-${Date.now()}`;
}

const fields = [
  { value: "email", label: "Email" },
  { value: "firstName", label: "First name" },
  { value: "lastName", label: "Last name" },
  { value: "company", label: "Company" },
  { value: "country", label: "Country" },
  { value: "status", label: "Status" },
  { value: "lastEngagementAt", label: "Last engaged" },
  { value: "tags", label: "Tags" },
];

const operators: Record<string, string[]> = {
  email: ["is", "is not", "contains", "ends with"],
  firstName: ["is", "is not", "contains"],
  lastName: ["is", "is not", "contains"],
  company: ["is", "is not", "contains"],
  country: ["is", "is not"],
  status: ["is", "is not"],
  lastEngagementAt: ["is after", "is before", "within"],
  tags: ["contains", "does not contain"],
};

export default function ListsPage() {
  const [lists, setLists] = React.useState<ContactList[]>([]);
  const [segments, setSegments] = React.useState<Segment[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [listOpen, setListOpen] = React.useState(false);
  const [listName, setListName] = React.useState("");
  const [segmentOpen, setSegmentOpen] = React.useState(false);
  const [segmentName, setSegmentName] = React.useState("");
  const [matchType, setMatchType] = React.useState<"all" | "any">("all");
  const [conditions, setConditions] = React.useState<SegmentCondition[]>([
    { id: conditionId(), field: "status", operator: "is", value: "active" },
  ]);
  const [editingSegment, setEditingSegment] = React.useState<Segment | null>(null);
  const [deleteListTarget, setDeleteListTarget] = React.useState<ContactList | null>(null);
  const [deleteSegmentTarget, setDeleteSegmentTarget] = React.useState<Segment | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  const load = React.useCallback(async () => {
    try {
      const [listsRes, segmentsRes] = await Promise.all([
        api.get<{ lists: ContactList[] }>("/api/v1/lists"),
        api.get<{ segments: Segment[] }>("/api/v1/segments"),
      ]);
      setLists(listsRes.lists ?? []);
      setSegments(segmentsRes.segments ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load lists");
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

  const createList = async () => {
    if (!listName.trim()) return;
    setSaving(true);
    try {
      const created = await api.post<{ list: ContactList }>("/api/v1/lists", {
        name: listName.trim(),
        description: "New list",
      });
      const createdId = created.list.id;
      setListName("");
      setListOpen(false);
      toast.success("List created");
      setLists((prev) => [created.list, ...prev]);
      await load();
      setLists((prev) =>
        prev.some((l) => l.id === createdId) ? prev : [created.list, ...prev]
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create list");
    } finally {
      setSaving(false);
    }
  };

  const duplicateList = async (list: ContactList) => {
    try {
      const created = await api.post<{ list: ContactList }>("/api/v1/lists", {
        name: `${list.name} (copy)`,
        description: list.description ?? "",
      });
      const createdId = created.list.id;
      toast.success("List duplicated");
      setLists((prev) => [created.list, ...prev]);
      await load();
      setLists((prev) =>
        prev.some((l) => l.id === createdId) ? prev : [created.list, ...prev]
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate list");
    }
  };

  const deleteList = async (list: ContactList) => {
    setDeleting(true);
    setDeleteListTarget(null);
    try {
      await api.delete(`/api/v1/lists/${list.id}`);
      toast.success(`List "${list.name}" deleted`);
      setLists((prev) => prev.filter((l) => l.id !== list.id));
      await load();
      setLists((prev) => prev.filter((l) => l.id !== list.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete list");
    } finally {
      setDeleting(false);
    }
  };

  const openSegmentBuilder = (segment?: Segment) => {
    setEditingSegment(segment ?? null);
    setSegmentName(segment?.name ?? "");
    setMatchType(segment?.matchType ?? "all");
    setConditions(
      segment?.conditions && segment.conditions.length > 0
        ? segment.conditions
        : [{ id: conditionId(), field: "status", operator: "is", value: "active" }]
    );
    setSegmentOpen(true);
  };

  const saveSegment = async () => {
    if (!segmentName.trim() || conditions.length === 0) return;
    if (conditions.some((c) => !c.value.trim())) {
      toast.error("Complete every condition value first");
      return;
    }
    setSaving(true);
    const payload = {
      name: segmentName.trim(),
      description: editingSegment?.description ?? "Custom segment",
      matchType,
      conditions: conditions.map((c) => ({ id: c.id, field: c.field, operator: c.operator, value: c.value })),
    };
    try {
      if (editingSegment) {
        const updated = await api.patch<{ segment: Segment }>(
          `/api/v1/segments/${editingSegment.id}`,
          payload
        );
        toast.success("Segment updated");
        setSegments((prev) => prev.map((sg) => (sg.id === editingSegment.id ? updated.segment : sg)));
        setSegmentOpen(false);
        await load();
        setSegments((prev) =>
          prev.some((sg) => sg.id === editingSegment.id) ? prev : [updated.segment, ...prev]
        );
      } else {
        const created = await api.post<{ segment: Segment }>("/api/v1/segments", payload);
        const createdId = created.segment.id;
        toast.success("Segment created");
        setSegments((prev) => [created.segment, ...prev]);
        setSegmentOpen(false);
        await load();
        setSegments((prev) =>
          prev.some((sg) => sg.id === createdId) ? prev : [created.segment, ...prev]
        );
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save segment");
    } finally {
      setSaving(false);
    }
  };

  const duplicateSegment = async (segment: Segment) => {
    try {
      const created = await api.post<{ segment: Segment }>("/api/v1/segments", {
        name: `${segment.name} (copy)`,
        description: segment.description,
        matchType: segment.matchType,
        conditions: segment.conditions ?? [],
      });
      const createdId = created.segment.id;
      toast.success("Segment duplicated");
      setSegments((prev) => [created.segment, ...prev]);
      await load();
      setSegments((prev) =>
        prev.some((sg) => sg.id === createdId) ? prev : [created.segment, ...prev]
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not duplicate segment");
    }
  };

  const deleteSegment = async (segment: Segment) => {
    setDeleting(true);
    setDeleteSegmentTarget(null);
    try {
      await api.delete(`/api/v1/segments/${segment.id}`);
      toast.success(`Segment "${segment.name}" deleted`);
      setSegments((prev) => prev.filter((sg) => sg.id !== segment.id));
      await load();
      setSegments((prev) => prev.filter((sg) => sg.id !== segment.id));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete segment");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Lists & Segments"
        description="Organize your audience into lists, and slice it with smart segments."
        icon={ListFilter}
        actions={
          <>
            <Button variant="outline" onClick={() => openSegmentBuilder()}>
              <Filter /> New segment
            </Button>
            <Button onClick={() => setListOpen(true)}>
              <Plus /> New list
            </Button>
          </>
        }
      />

      <Tabs defaultValue="lists">
        <TabsList>
          <TabsTrigger value="lists">
            Lists
            <Badge variant="secondary" className="ml-1">{lists.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="segments">
            Segments
            <Badge variant="secondary" className="ml-1">{segments.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="lists" className="mt-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <Loader2 className="animate-spin text-muted-foreground size-6" />
              <p className="text-muted-foreground text-sm">Loading lists…</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lists.map((list) => (
                <Card key={list.id} className="card-hover gap-4 py-5">
                  <CardHeader className="px-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-xl">
                        <Users className="size-5" />
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="List actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem asChild className="cursor-pointer">
                            <Link href={`/lists/${list.id}`}>
                              <Users /> View contacts
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => duplicateList(list)}>
                            <Copy /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={() => setDeleteListTarget(list)}
                          >
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2">
                      <CardTitle className="text-[0.95rem]">{list.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-1">
                        {list.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <div className="flex items-center justify-between border-t px-5 pt-4">
                    <div>
                      <p className="text-xl font-semibold tabular-nums">
                        {formatNumber(list.contactCount)}
                      </p>
                      <p className="text-muted-foreground text-xs">contacts</p>
                    </div>
                    <span className="text-muted-foreground text-xs">
                      Created {timeAgo(list.createdAt)}
                    </span>
                  </div>
                </Card>
              ))}

              <button
                onClick={() => setListOpen(true)}
                className="border-border hover:border-primary/40 hover:bg-muted/40 flex min-h-[190px] cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed transition-colors"
              >
                <span className="bg-secondary text-secondary-foreground flex size-10 items-center justify-center rounded-xl">
                  <Plus className="size-5" />
                </span>
                <span className="text-sm font-medium">Create a new list</span>
              </button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="segments" className="mt-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16">
              <Loader2 className="animate-spin text-muted-foreground size-6" />
              <p className="text-muted-foreground text-sm">Loading segments…</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {segments.map((segment) => (
                <Card key={segment.id} className="card-hover gap-4 py-5">
                  <CardHeader className="px-5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="bg-primary/10 text-primary flex size-10 items-center justify-center rounded-xl">
                        <Filter className="size-5" />
                      </span>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon-sm" aria-label="Segment actions">
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-44">
                          <DropdownMenuItem className="cursor-pointer" onClick={() => openSegmentBuilder(segment)}>
                            <Pencil /> Edit rules
                          </DropdownMenuItem>
                          <DropdownMenuItem className="cursor-pointer" onClick={() => duplicateSegment(segment)}>
                            <Copy /> Duplicate
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={() => setDeleteSegmentTarget(segment)}
                          >
                            <Trash2 /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div className="mt-2">
                      <CardTitle className="text-[0.95rem]">{segment.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-1">
                        {segment.description}
                      </CardDescription>
                    </div>
                  </CardHeader>
                  <div className="border-t px-5 pt-4">
                    <p className="text-muted-foreground mb-3 text-xs font-medium uppercase">
                      Matches {segment.matchType === "all" ? "all" : "any"} rules:
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {(segment.conditions ?? []).map((c) => (
                        <Badge key={c.id} variant="secondary" className="text-xs">
                          {c.field} {c.operator} {c.value}
                        </Badge>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                      <div>
                        <p className="text-xl font-semibold tabular-nums">
                          {segment.contactCount != null ? formatNumber(segment.contactCount) : "—"}
                        </p>
                        <p className="text-muted-foreground text-xs">contacts match</p>
                      </div>
                      <span className="text-muted-foreground text-xs">
                        Updated {timeAgo(segment.updatedAt)}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create a new list</DialogTitle>
            <DialogDescription>
              Lists are static groups you manually add contacts to.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Label htmlFor="list-name">List name</Label>
            <Input
              id="list-name"
              placeholder="e.g. VIP Customers"
              value={listName}
              onChange={(e) => setListName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && createList()}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={createList} disabled={!listName.trim() || saving}>
              {saving && <Loader2 className="animate-spin" />}
              Create list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <SegmentBuilderDialog
        open={segmentOpen}
        onOpenChange={setSegmentOpen}
        name={segmentName}
        onNameChange={setSegmentName}
        matchType={matchType}
        onMatchTypeChange={setMatchType}
        conditions={conditions}
        onConditionsChange={setConditions}
         onSave={saveSegment}
        saving={saving}
        isEditing={!!editingSegment}
      />

      <AlertDialog
        open={!!deleteListTarget}
        onOpenChange={(open) => !open && setDeleteListTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this list?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteListTarget?.name} and its {deleteListTarget?.contactCount ?? 0}{" "}
              contact(s) will be removed. Contacts themselves are not deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteListTarget && deleteList(deleteListTarget)}
            >
              <Trash2 /> Delete list
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteSegmentTarget}
        onOpenChange={(open) => !open && setDeleteSegmentTarget(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this segment?</AlertDialogTitle>
            <AlertDialogDescription>
              The segment {deleteSegmentTarget?.name} will be removed. Your contacts
              are not affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteSegmentTarget && deleteSegment(deleteSegmentTarget)}
            >
              <Trash2 /> Delete segment
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SegmentBuilderDialog({
  open,
  onOpenChange,
  name,
  onNameChange,
  matchType,
  onMatchTypeChange,
  conditions,
  onConditionsChange,
  onSave,
  saving,
  isEditing,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  onNameChange: (v: string) => void;
  matchType: "all" | "any";
  onMatchTypeChange: (v: "all" | "any") => void;
  conditions: SegmentCondition[];
  onConditionsChange: (c: SegmentCondition[]) => void;
  onSave: () => void;
  saving: boolean;
  isEditing: boolean;
}) {
  const update = (id: string, patch: Partial<SegmentCondition>) =>
    onConditionsChange(conditions.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  const addCondition = () =>
    onConditionsChange([
      ...conditions,
      { id: conditionId(), field: "status", operator: "is", value: "" },
    ]);

  const removeCondition = (id: string) =>
    onConditionsChange(conditions.filter((c) => c.id !== id));

  const complete = name.trim() !== "" && conditions.length > 0 && conditions.every((c) => c.value.trim() !== "");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit segment" : "Create a segment"}</DialogTitle>
          <DialogDescription>
            Define rules to slice your audience. Segments update automatically as
            contacts change.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="segment-name">Segment name</Label>
            <Input
              id="segment-name"
              placeholder="e.g. Hot leads in the last 30 days"
              value={name}
              onChange={(e) => onNameChange(e.target.value)}
            />
          </div>

          <Separator />

          <div className="flex items-center gap-3">
            <span className="text-muted-foreground text-sm">Match contacts when they meet</span>
            <Select value={matchType} onValueChange={(v) => onMatchTypeChange(v as "all" | "any")}>
              <SelectTrigger className="w-24">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">all</SelectItem>
                <SelectItem value="any">any</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-muted-foreground text-sm">of these rules:</span>
          </div>

          <div className="flex flex-col gap-3">
            {conditions.map((condition, index) => (
              <div key={condition.id} className="flex items-center gap-2">
                <span className="bg-muted text-muted-foreground flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-medium">
                  {index + 1}
                </span>
                <Select
                  value={condition.field}
                  onValueChange={(v) => update(condition.id, { field: v, operator: operators[v]?.[0] ?? "is" })}
                >
                  <SelectTrigger className="w-44" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fields.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select
                  value={condition.operator}
                  onValueChange={(v) => update(condition.id, { operator: v })}
                >
                  <SelectTrigger className="w-40" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(operators[condition.field] ?? ["is"]).map((op) => (
                      <SelectItem key={op} value={op}>
                        {op}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8 flex-1"
                  placeholder="Value…"
                  value={condition.value}
                  onChange={(e) => update(condition.id, { value: e.target.value })}
                />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeCondition(condition.id)}
                  disabled={conditions.length === 1}
                  aria-label="Remove condition"
                >
                  <X />
                </Button>
              </div>
            ))}
          </div>

          <Button variant="outline" size="sm" className="self-start" onClick={addCondition}>
            <Plus /> Add condition
          </Button>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={onSave} disabled={!complete || saving}>
            {saving && <Loader2 className="animate-spin" />}
            {isEditing ? "Save changes" : "Create segment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
