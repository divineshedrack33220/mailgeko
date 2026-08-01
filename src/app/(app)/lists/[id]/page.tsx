"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ChevronLeft, Loader2, Mail, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ContactStatusBadge } from "@/components/shared/status-badges";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { formatNumber, initials, timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import type { Contact, ContactList } from "@/lib/types";

export default function ListDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [list, setList] = React.useState<ContactList | null>(null);
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const run = async () => {
      setLoading(true);
      try {
        const [listRes, contactsRes] = await Promise.all([
          api.get<{ list: ContactList }>(`/api/v1/lists/${id}`),
          api.get<{ contacts: Contact[] }>(`/api/v1/contacts?listId=${id}&limit=500`),
        ]);
        setList(listRes.list ?? null);
        setContacts(contactsRes.contacts ?? []);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not load list");
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" asChild className="text-muted-foreground -ml-2">
        <Link href="/lists">
          <ChevronLeft /> Back to lists
        </Link>
      </Button>

      <PageHeader
        title={list?.name ?? "List"}
        description={list?.description || "Contacts in this list."}
        icon={Users}
        actions={
          list && (
            <Badge variant="secondary" className="gap-1">
              <Mail className="size-3.5" />
              {formatNumber(contacts.length)} contacts
            </Badge>
          )
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16">
            <Loader2 className="animate-spin text-muted-foreground size-6" />
            <p className="text-muted-foreground text-sm">Loading contacts…</p>
          </div>
        ) : contacts.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No contacts in this list"
            description="Add contacts from the Contacts page by selecting rows and choosing “Add to list”."
            actionLabel="Manage contacts"
            actionHref="/contacts"
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contact</TableHead>
                <TableHead className="hidden xl:table-cell">Company</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Engaged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contacts.map((contact, rowIndex) => (
                <TableRow
                  key={contact.id}
                  className="group animate-fade-in-up"
                  style={{ animationDelay: `${rowIndex * 30}ms` }}
                >
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
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>
    </div>
  );
}
