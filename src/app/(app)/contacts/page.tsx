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
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactStatusBadge } from "@/components/shared/status-badges";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { formatNumber, initials, timeAgo } from "@/lib/format";
import { contacts as mockContacts } from "@/lib/mock";
import type { ContactStatus } from "@/lib/types";

const statusOptions: Array<{ value: "all" | ContactStatus; label: string }> = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "unsubscribed", label: "Unsubscribed" },
  { value: "bounced", label: "Bounced" },
  { value: "spam", label: "Spam" },
];

export default function ContactsPage() {
  const [contacts, setContacts] = React.useState(mockContacts);
  const [search, setSearch] = React.useState("");
  const [status, setStatus] = React.useState<"all" | ContactStatus>("all");
  const [tag, setTag] = React.useState("all");
  const [selected, setSelected] = React.useState<string[]>([]);
  const [page, setPage] = React.useState(1);
  const [importOpen, setImportOpen] = React.useState(false);
  const [importStep, setImportStep] = React.useState<"upload" | "map">("upload");
  const [importing, setImporting] = React.useState(false);
  const [sortDesc, setSortDesc] = React.useState(false);

  const pageSize = 8;
  const allTags = React.useMemo(
    () => Array.from(new Set(contacts.flatMap((c) => c.tags))).sort(),
    [contacts]
  );

  const filtered = contacts.filter((c) => {
    const matchesSearch =
      c.email.toLowerCase().includes(search.toLowerCase()) ||
      (c.firstName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.lastName ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (c.company ?? "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = status === "all" || c.status === status;
    const matchesTag = tag === "all" || c.tags.includes(tag);
    return matchesSearch && matchesStatus && matchesTag;
  });

  const sorted = React.useMemo(
    () =>
      [...filtered].sort((a, b) => {
        const nameA = `${a.firstName} ${a.lastName}`.toLowerCase();
        const nameB = `${b.firstName} ${b.lastName}`.toLowerCase();
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

  const exportCsv = () => {
    const rows = filtered;
    const header = "email,first_name,last_name,company,position,country,city,status,tags";
    const body = rows
      .map((c) =>
        [c.email, c.firstName ?? "", c.lastName ?? "", c.company ?? "", c.position ?? "", c.country ?? "", c.city ?? "", c.status, c.tags.join(";")].join(",")
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

  const bulkDelete = () => {
    setContacts((prev) => prev.filter((c) => !selected.includes(c.id)));
    toast.success(`${selected.length} contacts deleted`);
    setSelected([]);
  };

  const startImport = () => {
    setImporting(true);
    setTimeout(() => {
      setImporting(false);
      setImportOpen(false);
      setImportStep("upload");
      toast.success("312 contacts imported · 4 duplicates skipped");
    }, 1600);
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
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <Upload /> Import
            </Button>
            <Button asChild>
              <Link href="/contacts/new">
                <Plus /> Add contact
              </Link>
            </Button>
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
              <Button variant="outline" size="sm" onClick={() => toast.info(`Tag ${selected.length} contacts — coming soon`)}>
                <Tag /> Tag
              </Button>
              <Button variant="outline" size="sm" onClick={() => toast.info(`Add ${selected.length} contacts to a list — coming soon`)}>
                <Mail /> Add to list
              </Button>
              <Button variant="outline" size="sm" onClick={exportCsv}>
                <Download /> Export
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={bulkDelete}
              >
                <Trash2 /> Delete
              </Button>
            </div>
          </div>
        )}

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
                          {contact.firstName} {contact.lastName}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">{contact.email}</p>
                      </div>
                    </Link>
                  </TableCell>
                  <TableCell className="hidden xl:table-cell">
                    <p className="text-sm">{contact.company ?? "—"}</p>
                    <p className="text-muted-foreground text-xs">{contact.position}</p>
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden text-sm md:table-cell">
                    {contact.country ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex max-w-[200px] flex-wrap gap-1">
                      {contact.tags.slice(0, 2).map((t) => (
                        <Badge key={t} variant="secondary" className="text-[0.65rem]">
                          {t}
                        </Badge>
                      ))}
                      {contact.tags.length > 2 && (
                        <Badge variant="outline" className="text-[0.65rem]">
                          +{contact.tags.length - 2}
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
                          <DropdownMenuItem
                            className="cursor-pointer"
                            onClick={() => toast.info("Manage tags — coming soon")}
                          >
                            <Tag /> Manage tags
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="cursor-pointer"
                            variant="destructive"
                            onClick={() => {
                              setContacts((prev) => prev.filter((c) => c.id !== contact.id));
                              toast.success(`${contact.email} deleted`);
                            }}
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

        <div className="flex items-center justify-between border-t px-6 py-3">
          <p className="text-muted-foreground text-xs">
            Showing{" "}
            <span className="font-medium text-foreground">
              {(safePage - 1) * pageSize + 1}–{Math.min(safePage * pageSize, filtered.length)}
            </span>{" "}
            of <span className="font-medium text-foreground">{formatNumber(filtered.length)}</span>
          </p>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon-sm" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
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
            <Button variant="outline" size="icon-sm" disabled={safePage === totalPages} onClick={() => setPage((p) => p + 1)}>
              <ChevronRight />
            </Button>
          </div>
        </div>
      </Card>

      <ImportDialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) setImportStep("upload");
        }}
        step={importStep}
        onStepChange={setImportStep}
        importing={importing}
        onImport={startImport}
      />
    </div>
  );
}

function ImportDialog({
  open,
  onOpenChange,
  step,
  onStepChange,
  importing,
  onImport,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  step: "upload" | "map";
  onStepChange: (step: "upload" | "map") => void;
  importing: boolean;
  onImport: () => void;
}) {
  const [fileName, setFileName] = React.useState("");
  const [mapping, setMapping] = React.useState<Record<string, string>>({
    "Column A": "Email",
    "Column B": "First name",
    "Column C": "Last name",
    "Column D": "Company",
    "Column E": "Position",
    "Column F": "Country",
  });

  const preview = [
    ["sarah@acme.co", "Sarah", "Johnson", "Acme Corp", "Head of Marketing", "US"],
    ["miguel@novatech.dev", "Miguel", "Rodriguez", "Novatech", "Founder", "MX"],
    ["emma@lumenhealth.io", "Emma", "Chen", "Lumen Health", "Product Manager", "SG"],
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Import contacts</DialogTitle>
          <DialogDescription>
            {step === "upload"
              ? "Upload a CSV or Excel file to add contacts to your workspace."
              : "Map your file columns to contact fields. Review the preview before importing."}
          </DialogDescription>
        </DialogHeader>

        {step === "upload" ? (
          <div className="flex flex-col gap-4">
            <button
              type="button"
              onClick={() => {
                setFileName("mailgeko_contacts_export.csv");
                onStepChange("map");
              }}
              className="hover:border-primary/50 group flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-6 py-12 transition-colors"
            >
              <span className="bg-primary/10 text-primary flex size-12 items-center justify-center rounded-xl">
                <FileSpreadsheet className="size-6" />
              </span>
              <span className="text-sm font-medium">Drop your file here, or click to browse</span>
              <span className="text-muted-foreground text-xs">
                CSV or Excel · up to 50,000 rows
              </span>
            </button>
            <div className="flex items-center gap-3 rounded-lg border px-4 py-3">
              <CheckCircle2 className="text-success size-4 shrink-0" />
              <p className="text-muted-foreground text-xs leading-relaxed">
                Your data stays in your database. We only read the file to map
                columns — it&apos;s never uploaded to a third party.
              </p>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border px-4 py-2.5">
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="text-primary size-4" />
                <span className="font-medium">{fileName}</span>
              </div>
              <Badge variant="secondary">312 rows</Badge>
            </div>

            <div className="flex flex-col gap-3">
              {Object.entries(mapping).map(([col, field]) => (
                <div key={col} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="bg-muted/50 rounded-md px-3 py-2">
                    <p className="text-xs font-mono font-medium">{col}</p>
                    <p className="text-muted-foreground text-xs truncate">
                      {preview[0][Object.keys(mapping).indexOf(col)]}
                    </p>
                  </div>
                  <Select
                    value={field}
                    onValueChange={(v) => setMapping((prev) => ({ ...prev, [col]: v }))}
                  >
                    <SelectTrigger className="w-40" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {["Email", "First name", "Last name", "Company", "Position", "Country", "City", "Phone", "Tags", "Skip column"].map((f) => (
                        <SelectItem key={f} value={f}>
                          {f}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <Separator />

            <div>
              <p className="text-muted-foreground mb-2 text-xs font-medium uppercase">Preview</p>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-muted/50">
                      {preview[0].map((_, i) => (
                        <th key={i} className="text-muted-foreground px-3 py-2 text-left font-medium">
                          {mapping[`Column ${String.fromCharCode(65 + i)}`]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, r) => (
                      <tr key={r} className="border-t">
                        {row.map((cell, c) => (
                          <td key={c} className="px-3 py-1.5">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {importing ? <X /> : null} Cancel
          </Button>
          {step === "upload" ? (
            <Button onClick={() => onStepChange("map")}>
              Continue <ChevronRight />
            </Button>
          ) : (
            <Button onClick={onImport} disabled={importing}>
              {importing && <Loader2 className="animate-spin" />}
              Import 312 contacts
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
