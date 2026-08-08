"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ChevronLeft,
  Mail,
  MailOpen,
  MousePointerClick,
  Send,
  Building2,
  Briefcase,
  MapPin,
  Phone,
  CalendarDays,
  Tag,
  MoreHorizontal,
  Trash2,
  Pencil,
  MailPlus,
  Globe,
  Loader2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/shared/stat-card";
import { ContactStatusBadge } from "@/components/shared/status-badges";
import { Separator } from "@/components/ui/separator";
import { initials, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { canManage, canSend } from "@/lib/permissions";
import type { Contact, ContactList } from "@/lib/types";

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const manage = canManage(role);
  const send = canSend(role);

  React.useEffect(() => {
    if (role && !canManage(role)) router.replace("/contacts");
  }, [role, router]);

  if (role && !canManage(role)) return null;

  const [contact, setContact] = React.useState<Contact | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteOpen, setDeleteOpen] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [editOpen, setEditOpen] = React.useState(false);
  const [tagOpen, setTagOpen] = React.useState(false);
  const [listOpen, setListOpen] = React.useState(false);
  const [mailOpen, setMailOpen] = React.useState(false);
  const [mailSubject, setMailSubject] = React.useState("");
  const [mailBody, setMailBody] = React.useState("");
  const [sending, setSending] = React.useState(false);
  const [lists, setLists] = React.useState<ContactList[]>([]);
  const [listId, setListId] = React.useState("");
  const [draftTags, setDraftTags] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<{ contact: Contact }>(`/api/v1/contacts/${params.id}`);
        if (!cancelled) setContact(res.contact);
      } catch (err) {
        if (!cancelled) {
          toast.error(err instanceof Error ? err.message : "Could not load contact");
          router.replace("/contacts");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [params.id, router]);

  const deleteContact = async () => {
    setDeleting(true);
    try {
      await api.delete(`/api/v1/contacts/${params.id}`);
      toast.success("Contact deleted");
      router.replace("/contacts");
    } catch (err) {
      setDeleting(false);
      toast.error(err instanceof Error ? err.message : "Could not delete contact");
    }
  };

  const saveProfile = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    if (!email) {
      toast.error("Email is required");
      return;
    }
    setSaving(true);
    try {
      const res = await api.patch<{ contact: Contact }>(`/api/v1/contacts/${params.id}`, {
        email,
        firstName: String(data.get("firstName") ?? "").trim(),
        lastName: String(data.get("lastName") ?? "").trim(),
        company: String(data.get("company") ?? "").trim(),
        position: String(data.get("position") ?? "").trim(),
        phoneNumber: String(data.get("phoneNumber") ?? "").trim(),
        country: String(data.get("country") ?? "").trim(),
        city: String(data.get("city") ?? "").trim(),
        status: String(data.get("status") ?? contact?.status ?? "active"),
      });
      setContact(res.contact);
      setEditOpen(false);
      toast.success("Contact updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update contact");
    } finally {
      setSaving(false);
    }
  };

  const openTags = () => {
    setDraftTags([...(contact?.tags ?? [])]);
    setTagInput("");
    setTagOpen(true);
  };

  const addDraftTag = () => {
    const value = tagInput.trim();
    if (!value) return;
    if (!draftTags.includes(value)) setDraftTags([...draftTags, value]);
    setTagInput("");
  };

  const saveTags = async () => {
    setSaving(true);
    try {
      const res = await api.patch<{ contact: Contact }>(`/api/v1/contacts/${params.id}`, {
        email: contact?.email,
        tags: draftTags,
      });
      setContact(res.contact);
      setTagOpen(false);
      toast.success("Tags updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update tags");
    } finally {
      setSaving(false);
    }
  };

  const openAddToList = async () => {
    setListOpen(true);
    setListId("");
    try {
      const res = await api.get<{ lists: ContactList[] }>("/api/v1/lists");
      setLists(res.lists ?? []);
    } catch {
      setLists([]);
    }
  };

  const addToList = async () => {
    if (!listId) {
      toast.error("Select a list");
      return;
    }
    setSaving(true);
    try {
      await api.post(`/api/v1/lists/${listId}/contacts`, { contactIds: [params.id] });
      toast.success("Added to list");
      setListOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add to list");
    } finally {
      setSaving(false);
    }
  };

  const openMail = () => {
    setMailSubject("");
    setMailBody("");
    setMailOpen(true);
  };

  const sendMail = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!mailSubject.trim() || !mailBody.trim()) {
      toast.error("Subject and message are required");
      return;
    }
    setSending(true);
    try {
      await api.post<{ messageId: string }>(`/api/v1/contacts/${params.id}/send`, {
        subject: mailSubject,
        body: mailBody,
      });
      setMailOpen(false);
      toast.success("Email sent to " + contact?.email);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not send email");
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 py-24">
        <Loader2 className="animate-spin text-muted-foreground size-6" />
        <p className="text-muted-foreground text-sm">Loading contact…</p>
      </div>
    );
  }

  if (!contact) return null;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/contacts"
          className="text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1 text-sm transition-colors"
        >
          <ChevronLeft className="size-4" /> Back to contacts
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              <AvatarFallback className="bg-primary/10 text-primary text-lg font-semibold">
                {initials(contact.firstName, contact.lastName)}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold tracking-tight">
                  {contact.firstName} {contact.lastName}
                </h2>
                <ContactStatusBadge status={contact.status} />
              </div>
              <p className="text-muted-foreground mt-0.5 text-sm">{contact.email}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button variant="outline" size="sm" onClick={openAddToList}>
              <MailPlus /> Add to list
            </Button>
            {send && (
              <Button size="sm" onClick={openMail}>
                <Mail /> Send email
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Contact actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Contact</DropdownMenuLabel>
                <DropdownMenuItem className="cursor-pointer" onClick={() => setEditOpen(true)}>
                  <Pencil /> Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={openTags}>
                  <Tag /> Manage tags
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  variant="destructive"
                  onClick={() => setDeleteOpen(true)}
                  disabled={deleting}
                >
                  <Trash2 /> Delete contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total emails sent" value="—" icon={Send} hint="No data yet" />
        <StatCard label="Opens" value="—" change={0} icon={MailOpen} hint="No data yet" />
        <StatCard label="Clicks" value="—" change={0} icon={MousePointerClick} hint="No data yet" />
        <StatCard label="Last engaged" value={contact.lastEngagementAt ? timeAgo(contact.lastEngagementAt) : "—"} icon={CalendarDays} hint="Most recent activity" />
      </div>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="engagement">Engagement</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="gap-0 overflow-hidden py-0 lg:col-span-2">
              <CardHeader>
                <CardTitle>Contact details</CardTitle>
                <CardDescription>Stored profile information</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid gap-px sm:grid-cols-2">
                  {[
                    { icon: Mail, label: "Email", value: contact.email },
                    { icon: Building2, label: "Company", value: contact.company ?? "—" },
                    { icon: Briefcase, label: "Position", value: contact.position ?? "—" },
                    { icon: Phone, label: "Phone", value: contact.phoneNumber ?? "—" },
                    { icon: Globe, label: "Country", value: contact.country ?? "—" },
                    { icon: MapPin, label: "City", value: contact.city ?? "—" },
                  ].map((row) => (
                    <div key={row.label} className="border-border flex items-start gap-3 border-b p-4">
                      <row.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-muted-foreground text-xs">{row.label}</p>
                        <p className="mt-0.5 truncate text-sm font-medium">{row.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <div className="flex flex-col gap-4">
              <Card className="gap-3 py-5">
                <div className="flex items-center gap-2 px-6">
                  <Tag className="text-primary size-4" />
                  <span className="text-sm font-semibold">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2 px-6">
                  {(contact.tags ?? []).map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-full px-2.5 text-xs" onClick={openTags}>
                    <Tag /> Add
                  </Button>
                </div>
              </Card>

              <Card className="gap-3 py-5">
                <div className="px-6">
                  <span className="text-sm font-semibold">Custom fields</span>
                </div>
                <div className="divide-y px-6">
                  {Object.entries(contact.customFields ?? {}).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2.5">
                      <span className="text-muted-foreground text-sm">{key}</span>
                      <span className="text-sm font-medium capitalize">{value}</span>
                    </div>
                  ))}
                  {Object.keys(contact.customFields ?? {}).length === 0 && (
                    <p className="text-muted-foreground py-2 text-sm">No custom fields set</p>
                  )}
                </div>
              </Card>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="engagement" className="mt-5">
          <Card className="gap-0 overflow-hidden py-0">
            <CardHeader>
              <CardTitle>Campaign activity</CardTitle>
              <CardDescription>Every interaction with your campaigns</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="relative">
                <Separator orientation="vertical" className="absolute top-0 bottom-0 left-[38px]" />
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16">
                  <MailOpen className="text-muted-foreground size-6" />
                  <p className="text-muted-foreground text-sm">No engagement data yet</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit contact</DialogTitle>
            <DialogDescription>Update the profile information for this contact.</DialogDescription>
          </DialogHeader>
          <form onSubmit={saveProfile} noValidate className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input id="edit-email" type="email" name="email" defaultValue={contact.email} required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-status">Status</Label>
                <select
                  id="edit-status"
                  name="status"
                  defaultValue={contact.status}
                  className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="unsubscribed">Unsubscribed</option>
                  <option value="bounced">Bounced</option>
                  <option value="spam">Spam</option>
                </select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-firstName">First name</Label>
                <Input id="edit-firstName" name="firstName" defaultValue={contact.firstName} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-lastName">Last name</Label>
                <Input id="edit-lastName" name="lastName" defaultValue={contact.lastName} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-company">Company</Label>
                <Input id="edit-company" name="company" defaultValue={contact.company} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-position">Position</Label>
                <Input id="edit-position" name="position" defaultValue={contact.position} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-phone">Phone</Label>
                <Input id="edit-phone" name="phoneNumber" defaultValue={contact.phoneNumber} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-country">Country</Label>
                <Input id="edit-country" name="country" defaultValue={contact.country} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-city">City</Label>
                <Input id="edit-city" name="city" defaultValue={contact.city} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="animate-spin" />}
                Save changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={tagOpen} onOpenChange={setTagOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Manage tags</DialogTitle>
            <DialogDescription>Tags help you organize and segment this contact.</DialogDescription>
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
            <Button type="button" variant="outline" onClick={() => setTagOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveTags} disabled={saving}>
              {saving && <Loader2 className="animate-spin" />}
              Save tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={listOpen} onOpenChange={setListOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add to list</DialogTitle>
            <DialogDescription>Choose a list to add this contact to.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-2">
            {lists.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No lists yet — create one on the Lists &amp; Segments page.
              </p>
            ) : (
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="border-input bg-background ring-offset-background focus-visible:ring-ring h-9 rounded-md border px-3 py-1 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <option value="">Select a list…</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {list.name}
                  </option>
                ))}
              </select>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setListOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={addToList} disabled={saving || lists.length === 0}>
              {saving && <Loader2 className="animate-spin" />}
              Add to list
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={mailOpen} onOpenChange={setMailOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Send email to {contact.firstName || contact.email}</DialogTitle>
            <DialogDescription>
              Sent from {contact.email}. Use {"{{first_name}}"}, {"{{company}}"} etc. and they
              will be replaced with this contact&apos;s details.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={sendMail} noValidate className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="mail-subject">
                Subject <span className="text-destructive">*</span>
              </Label>
              <Input
                id="mail-subject"
                value={mailSubject}
                onChange={(e) => setMailSubject(e.target.value)}
                placeholder="Hi {{first_name}} — quick question"
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="mail-body">
                Message <span className="text-destructive">*</span>
              </Label>
              <textarea
                id="mail-body"
                value={mailBody}
                onChange={(e) => setMailBody(e.target.value)}
                placeholder="Hey {{first_name}}, I wanted to follow up on…"
                required
                className="border-input bg-background ring-offset-background focus-visible:ring-ring min-h-40 rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setMailOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={sending}>
                {sending && <Loader2 className="animate-spin" />}
                <Send /> Send email
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this contact?</AlertDialogTitle>
            <AlertDialogDescription>
              {contact?.email ?? "This contact"} will be permanently removed from every list.
              This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              disabled={deleting}
              onClick={deleteContact}
            >
              <Trash2 /> Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
