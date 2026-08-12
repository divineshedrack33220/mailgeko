"use client";

import * as React from "react";
import Link from "next/link";
import {
  Users,
  Plus,
  Search,
  Upload,
  Download,
  MoreHorizontal,
  Trash2,
  Tag,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Mail,
  FileSpreadsheet,
  X,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatNumber, initials, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { canManage } from "@/lib/permissions";
import type { Contact, ContactStatus } from "@/lib/types";

const statusOptions: Array<{ value: "all" | ContactStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "spam", label: "Spam" },
];

export default function ContactsPage() {
  const role = useAuthStore((s) => s.role);
  const manage = canManage(role);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | ContactStatus>("all");
  const [tag, setTag] = React.useState("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importing, setImporting] = React.useState(false);
  const [sortDesc, setSortDesc] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ contacts: Contact[] }>("/api/v1/contacts?limit=5000");
      setContacts(res.contacts ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load contacts");
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

  const pageSize = 8;
  const allTags = React.useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags ?? []))).sort(),
    [contacts]
  );

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.firstName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.lastName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || c.status === status;
    const matchesTag = tag === "all" || (c.tags ?? []).includes(tag);
    return matchesSearch && matchesStatus && matchesTag;
  });

  const sorted = React.useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const nameA = `${a.firstName ?? ""} ${a.lastName ?? ""}`.toLowerCase();
        const nameB = `${b.firstName ?? ""} ${b.lastName ?? ""}`.toLowerCase();
        return sortDesc ? nameB.localeCompare(nameA) : nameA.localeCompare(nameB);
      }),
    [filtered, sortDesc]
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageContacts = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  const filterKey = `${search}|${status}|${tag}`;
  const [lastFilterKey, setLastFilterKey] = React.useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setPage(1);
  }

  const toggleAll = () => {
    const pageIds = pageContacts.map((c) => c.id);
    const allSelected = pageIds.every((id) => selected.includes(id));
    setSelected((prev) =>
      allSelected ? prev.filter((id) => !pageIds.includes(id)) : Array.from(new Set([...prev, ...pageIds]))
    );
  };

  const escapeCsvField = (val: string) => {
    if (/[",\n\r]/.test(val)) return `"${val.replace(/"/g, '""')}"`;
    return val;
  };

  const exportCsv = () => {
    const rows = filtered;
    const header = "email,first_name,last_name,company,position,country,city,status,tags";
    const body = rows
      .map((c) =>
        [c.email, c.firstName ?? "", c.lastName ?? "", c.company ?? "", c.position ?? "", c.country ?? "", c.city ?? "", c.status, (c.tags ?? []).join(";")]
          .map(escapeCsvField)
          .join(",")
      )
      .join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mailgeko-contacts.csv";
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${formatNumber(rows.length)} contacts exported`);
  };

  const deleteContact = async (id: string) => {
    const contact = contacts.find((c) => c.id === id);
    setDeleting(true);
    setDeleteTarget(null);
    setContacts((prev) => prev.filter((c) => c.id !== id));
    try {
      await api.delete(`/api/v1/contacts/${id}`);
      toast.success(`${contact?.email ?? "Contact"} deleted`);
    } catch (err) {
      load();
      toast.error(err instanceof Error ? err.message : "Could not delete contact");
    } finally {
      setDeleting(false);
    }
  };

  const [tagContact, setTagContact] = React.useState<Contact | null>(null);
  const [draftTags, setDraftTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");
  const [tagSaving, setTagSaving] = React.useState(false);
  const [bulkTagOpen, setBulkTagOpen] = React.useState(false);
  const [bulkTagInput, setBulkTagInput] = React.useState("");
  const [bulkTagSaving, setBulkTagSaving] = React.useState(false);
  const [bulkListOpen, setBulkListOpen] = React.useState(false);
  const [lists, setLists] = React.useState<{ id: string; name: string }[]>([]);
  const [bulkListId, setBulkListId] = React.useState("");
  const [bulkListSaving, setBulkListSaving] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Contact | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const openBulkTag = () => {
    setBulkTagInput("");
    setBulkTagOpen(true);
  };

  const bulkAddTag = async () => {
    const tags = bulkTagInput
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (tags.length === 0) return;
    setBulkTagSaving(true);
    try {
      const res = await api.post<{ updated: number }>("/api/v1/contacts/bulk/tags", {
        contactIds: selected,
        tags,
      });
      setBulkTagOpen(false);
      setSelected([]);
      toast.success(`Tagged ${res.updated} contacts`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not tag contacts");
    } finally {
      setBulkTagSaving(false);
    }
  };

  const openBulkList = async () => {
    setBulkListId("");
    setBulkListOpen(true);
    try {
      const res = await api.get<{ lists: { id: string; name: string }[] }>("/api/v1/lists");
      setLists(res.lists ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load lists");
    }
  };

  const bulkAddToList = async () => {
    if (!bulkListId) return;
    setBulkListSaving(true);
    try {
      const res = await api.post<{ added: number }>(`/api/v1/lists/${bulkListId}/contacts`, {
        contactIds: selected,
      });
      setBulkListOpen(false);
      setSelected([]);
      toast.success(`Added ${res.added} contacts to the list`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add contacts to list");
    } finally {
      setBulkListSaving(false);
    }
  };

  const openManageTags = (contact: Contact) => {
    setTagContact(contact);
    setDraftTags([...(contact.tags ?? [])]);
    setTagInput("");
  };

  const addDraftTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (!draftTags.includes(value)) setDraftTags([...draftTags, value]);
    setTagInput("");
  };

  const saveTags = async () => {
    if (!tagContact) return;
    setTagSaving(true);
    try {
      const res = await api.patch<{ contact: Contact }>(`/api/v1/contacts/${tagContact.id}`, {
        email: tagContact.email,
        tags: draftTags,
      });
      setContacts((prev) => prev.map((c) => (c.id === tagContact.id ? res.contact : c)));
      setTagContact(null);
      toast.success("Tags updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update tags");
    } finally {
      setTagSaving(false);
    }
  };

  const bulkDelete = async () => {
    const ids = [...selected];
    setSelected([]);
    await Promise.allSettled(ids.map((id) => api.delete(`/api/v1/contacts/${id}`)));
    toast.success(`${ids.length} contacts deleted`);
    load();
  };

  const startImport = async (file: File) => {
    setImporting(true);
    try {
      await api.upload("/api/v1/contacts/import", file, "file");
      setImportOpen(false);
      toast.success("Import queued — your contacts will appear shortly");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not import contacts");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Contacts"
        description="Manage your audience — import, organize, and segment with ease."
        icon={Users}
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download /> Export
            </Button>
            {manage && (
              <>
                <Button variant="outline" onClick={() => setImportOpen(true)}>
                  <Upload /> Import
                </Button>
                <Button asChild>
                  <Link href="/contacts/new">
                    <Plus /> Add contact
                  </Link>
                </Button>
              </>
            )}
          </>
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="relative">
              <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
              <Input
                placeholder="Search name or email…"
                className="h-9 w-full pl-9 sm:w-64"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search contacts"
              />
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as "all" | ContactStatus)}>
              <SelectTrigger className="w-40" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={tag} onValueChange={setTag}>
              <SelectTrigger className="w-40" size="sm">
                <SelectValue placeholder="All tags" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All tags</SelectItem>
                {allTags.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="text-muted-foreground text-sm">
            <span className="font-medium text-foreground">{formatNumber(filtered.length)}</span> contacts
          </span>
        </div>

        {selected.length > 0 && (
          <div className="bg-primary/5 border-primary/15 flex items-center gap-3 border-b px-6 py-3">
            <Checkbox
              checked
              onCheckedChange={() => setSelected([])}
              aria-label="Clear selection"
            />
            <span className="text-sm font-medium">
              {selected.length} selected
            </span>
            <div className="ml-auto flex items-center gap-2">
              {manage && (
                <>
                  <Button variant="outline" size="sm" onClick={openBulkTag}>
                    <Tag /> Tag
                  </Button>
                  <Button variant="outline" size="sm" onClick={openBulkList}>
                    <Mail /> Add to list
                  </Button>
                </>
              )}
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download /> Export
              </Button>
              {manage && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive hover:text-destructive"
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  <Trash2 /> Delete
                </Button>
              )}
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 className="animate-spin text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">Loading contacts…</p>
          </div>
        ) : pageContacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title={contacts.length === 0 ? "No contacts yet" : "No contacts match your filters"}
            description={
              contacts.length === 0
                ? manage
                  ? "Add your first contact or import an audience to get started."
                  : "Your workspace has no contacts yet."
                : "Try adjusting your search, status, or tag filters."
            }
            actionLabel={contacts.length === 0 && manage ? "Add contact" : undefined}
            actionHref={contacts.length === 0 && manage ? "/contacts/new" : undefined}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-10 pl-6">
                  <Checkbox
                    checked={pageContacts.length > 0 && pageContacts.every((c) => selected.includes(c.id))}
                    onCheckedChange={toggleAll}
                    aria-label="Select all on page"
                  />
                </TableHead>
                <TableHead>
                  <button
                    onClick={() => setSortDesc((v) => !v)}
                    className="hover:text-foreground flex cursor-pointer items-center gap-1 transition-colors"
                  >
                    Contact <ArrowUpDown className="size-3" />
                  </button>
                </TableHead>
                <TableHead className="hidden xl:table-cell">Company</TableHead>
                <TableHead className="hidden md:table-cell">Location</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Engaged</TableHead>
                <TableHead className="pr-6 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageContacts.map((contact, rowIndex) => {
                const checked = selected.includes(contact.id);
                return (
                  <TableRow
                    key={contact.id}
                    data-state={checked ? "selected" : undefined}
                    className="group animate-fade-in-up"
                    style={{ animationDelay: `${rowIndex * 30}ms` }}
                  >
                    <TableCell className="pl-6">
                      <Checkbox
                        checked={checked}
                        onCheckedChange={(v) =>
                          setSelected((prev) =>
                            v ? [...prev, contact.id] : prev.filter((id) => id !== contact.id)
                          )
                        }
                        aria-label={`Select ${contact.email}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/contacts/${contact.id}`} className="flex items-center gap-3">
                        <Avatar className="size-8">
                          <AvatarFallback
                            className={cn(
                              "text-xs font-semibold",
                              contact.status === "active"
                                ? "bg-primary/10 text-primary"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {initials(contact.firstName, contact.lastName)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                          <p className="hover:text-primary text-sm font-medium transition-colors">
                            {contact.firstName ?? ""} {contact.lastName ?? ""}
                          </p>
                          <p className="text-muted-foreground truncate text-xs">{contact.email}</p>
                        </div>
                      </Link>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <p className="text-sm">{contact.company ?? "—"}</p>
                      <p className="text-muted-foreground text-xs">{contact.position ?? ""}</p>
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                      {contact.country ?? "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex max-w-[200px] flex-wrap gap-1">
                        {(contact.tags ?? []).slice(0, 2).map((t) => (
                          <Badge key={t} variant="secondary" className="text-xs">
                            {t}
                          </Badge>
                        ))}
                        {(contact.tags ?? []).length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{(contact.tags ?? []).length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ContactStatusBadge status={contact.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-right text-xs whitespace-nowrap">
                      {contact.lastEngagementAt ? timeAgo(contact.lastEngagementAt) : "—"}
                    </TableCell>
                    <TableCell className="pr-6">
                      <div className="flex justify-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="opacity-0 group-hover:opacity-100 focus:opacity-100"
                              aria-label="Contact actions"
                            >
                              <MoreHorizontal />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-44">
                            <DropdownMenuLabel>Contact</DropdownMenuLabel>
                            <DropdownMenuItem className="cursor-pointer" asChild>
                              <Link href={`/contacts/${contact.id}`}>
                                <Users /> View profile
                              </Link>
                            </DropdownMenuItem>
                            {manage && (
                              <>
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  onClick={() => openManageTags(contact)}
                                >
                                  <Tag /> Manage tags
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="cursor-pointer"
                                  variant="destructive"
                                  onClick={() => setDeleteTarget(contact)}
                                >
                                  <Trash2 /> Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}

        {!loading && pageContacts.length > 0 && (
          <div className="flex items-center justify-between border-t px-6 py-3">
            <p className="text-muted-foreground text-xs">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}
              </span>{" "}
              of <span className="font-medium text-foreground">{formatNumber(filtered.length)}</span>
            </p>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .map((p, index, arr) => (
                  <React.Fragment key={p}>
                    {index > 0 && arr[index - 1] !== p - 1 && <span className="text-muted-foreground px-1">…</span>}
                    <Button
                      variant={p === page ? "default" : "outline"}
                      size="icon-sm"
                      onClick={() => setPage(p)}
                      className={p === page ? "pointer-events-none" : ""}
                    >
                      {p}
                    </Button>
                  </React.Fragment>
                ))}
              <Button variant="outline" size="icon-sm" disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        importing={importing}
        onImport={startImport}
      />

      <Dialog open={tagContact !== null} onOpenChange={(open) => !open && setTagContact(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage tags</DialogTitle>
            <DialogDescription>
              Tags for {tagContact?.email ?? "this contact"} — used to organize and segment.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              {draftTags.length === 0 && (
                <p className="text-muted-foreground text-sm">No tags yet — add one below.</p>
              )}
              {draftTags.map((tag) => (
                <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => setDraftTags(draftTags.filter((t) => t !== tag))}
                    className="hover:text-foreground text-muted-foreground rounded-full outline-none"
                    aria-label={`Remove tag ${tag}`}
                  >
                    <X className="size-3" />
                  </button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addDraftTag();
                  }
                }}
                placeholder="Type a tag and press Enter"
              />
              <Button type="button" variant="outline" onClick={addDraftTag}>
                Add
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setTagContact(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveTags} disabled={tagSaving}>
              {tagSaving && <Loader2 className="animate-spin" />}
              Save tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkTagOpen} onOpenChange={setBulkTagOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tag {selected.length} contacts</DialogTitle>
            <DialogDescription>
              Add tags to every selected contact. Existing tags are kept.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            <Input
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  bulkAddTag();
                }
              }}
              placeholder="VIP, newsletter, trial…"
            />
            <p className="text-muted-foreground text-xs">Separate multiple tags with commas.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkTagOpen(false)} disabled={bulkTagSaving}>
              Cancel
            </Button>
            <Button onClick={bulkAddTag} disabled={bulkTagSaving || !bulkTagInput.trim()}>
              {bulkTagSaving && <Loader2 className="animate-spin" />}
              Apply tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={bulkListOpen} onOpenChange={setBulkListOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add {selected.length} contacts to a list</DialogTitle>
            <DialogDescription>Pick the list you want these contacts added to.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {lists.length === 0 ? (
              <p className="text-muted-foreground py-2 text-sm">
                No lists yet — create one from the Lists page first.
              </p>
            ) : (
              lists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setBulkListId(list.id)}
                  className={cn(
                    "flex cursor-pointer items-center justify-between rounded-lg border-2 px-4 py-2.5 text-left transition-all",
                    bulkListId === list.id
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/40"
                  )}
                >
                  <span className="text-sm font-medium">{list.name}</span>
                  {bulkListId === list.id && <CheckCircle2 className="text-primary size-4" />}
                </button>
              ))
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkListOpen(false)} disabled={bulkListSaving}>
              Cancel
            </Button>
            <Button onClick={bulkAddToList} disabled={bulkListSaving || !bulkListId}>
              {bulkListSaving && <Loader2 className="animate-spin" />}
              Add contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.email} will be removed from every list and this cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
              onClick={() => deleteTarget && deleteContact(deleteTarget.id)}
            >
              <Trash2 /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.length} contacts?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all selected contacts and remove them from every list.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                setBulkDeleteOpen(false);
                bulkDelete();
              }}
            >
              <Trash2 /> Delete all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  importing,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  importing: boolean;
  onImport: (file: File) => void;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const inputRef = React.useRef<HTMLInputElement | null>(null);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFile(null);
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            Upload a CSV file to add contacts to your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="hover:border-primary/50 group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 transition-colors"
          >
            <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
              <FileSpreadsheet className="size-6" />
            </span>
            <span className="text-sm font-medium">
              {file ? file.name : "Drop your file here, or click to browse"}
            </span>
            <span className="text-muted-foreground text-xs">
              CSV · up to 50,000 rows
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
            <CheckCircle2 className="text-success size-4 shrink-0" />
            <p className="text-muted-foreground text-xs leading-relaxed">
              Expects a CSV with an <span className="font-medium text-foreground">email</span> column.
              Use the export button to download a template of the expected format.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={importing}>
            <X /> Cancel
          </Button>
          <Button onClick={() => file && onImport(file)} disabled={!file || importing}>
            {importing && <Loader2 className="animate-spin" />}
            Import {file ? `“${file.name}”` : "contacts"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
