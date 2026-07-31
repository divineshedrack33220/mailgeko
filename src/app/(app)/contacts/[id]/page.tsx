"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
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
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { contacts } from "@/lib/mock";

const activity = [
  { id: 1, type: "opened", campaign: "July Product Digest", detail: "Opened the email", time: "2026-07-28T14:03:00Z", icon: MailOpen, color: "text-primary" },
  { id: 2, type: "clicked", campaign: "July Product Digest", detail: "Clicked “See what shipped”", time: "2026-07-28T14:03:00Z", icon: MousePointerClick, color: "text-primary" },
  { id: 3, type: "sent", campaign: "Product Launch — AI Studio", detail: "Received the email", time: "2026-07-05T09:00:00Z", icon: Send, color: "text-muted-foreground" },
  { id: 4, type: "opened", campaign: "Welcome Campaign", detail: "Opened the email", time: "2026-06-30T10:12:00Z", icon: MailOpen, color: "text-primary" },
  { id: 5, type: "sent", campaign: "June Product Digest", detail: "Received the email", time: "2026-06-01T09:00:00Z", icon: Send, color: "text-muted-foreground" },
];

export default function ContactDetailPage() {
  const params = useParams<{ id: string }>();
  const contact = contacts.find((c) => c.id === params.id) ?? contacts[0];

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
            <Button variant="outline" size="sm" onClick={() => toast.info("Add to list is coming soon")}>
              <MailPlus /> Add to list
            </Button>
            <Button size="sm" onClick={() => toast.info("Compose a 1:1 email is coming soon")}>
              <Mail /> Send email
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon-sm" aria-label="Contact actions">
                  <MoreHorizontal />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Contact</DropdownMenuLabel>
                <DropdownMenuItem className="cursor-pointer" onClick={() => toast.info("Edit profile is coming soon")}>
                  <Pencil /> Edit profile
                </DropdownMenuItem>
                <DropdownMenuItem className="cursor-pointer" onClick={() => toast.info("Manage tags is coming soon")}>
                  <Tag /> Manage tags
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="cursor-pointer"
                  variant="destructive"
                  onClick={() => {
                    toast.success("Contact deleted");
                  }}
                >
                  <Trash2 /> Delete contact
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total emails sent" value="14" icon={Send} hint="Last 6 months" />
        <StatCard label="Opens" value="11" change={8.1} icon={MailOpen} hint="78.6% open rate" />
        <StatCard label="Clicks" value="7" change={4.3} icon={MousePointerClick} hint="50.0% click rate" />
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
                  {contact.tags.map((tag) => (
                    <Badge key={tag} variant="secondary">
                      {tag}
                    </Badge>
                  ))}
                  <Button variant="outline" size="sm" className="rounded-full px-2.5 text-xs" onClick={() => toast.info("Add a tag is coming soon")}>
                    <Tag /> Add
                  </Button>
                </div>
              </Card>

              <Card className="gap-3 py-5">
                <div className="px-6">
                  <span className="text-sm font-semibold">Custom fields</span>
                </div>
                <div className="divide-y px-6">
                  {Object.entries(contact.customFields).map(([key, value]) => (
                    <div key={key} className="flex items-center justify-between py-2.5">
                      <span className="text-muted-foreground text-sm">{key}</span>
                      <span className="text-sm font-medium capitalize">{value}</span>
                    </div>
                  ))}
                  {Object.keys(contact.customFields).length === 0 && (
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
                <div className="divide-y">
                  {activity.map((item) => (
                    <div key={item.id} className="relative flex items-start gap-4 px-6 py-4">
                      <span
                        className={`bg-card border flex size-8 shrink-0 items-center justify-center rounded-full ${item.color}`}
                      >
                        <item.icon className="size-3.5" />
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{item.campaign}</p>
                          <span className="text-muted-foreground text-xs whitespace-nowrap">
                            {timeAgo(item.time)}
                          </span>
                        </div>
                        <p className="text-muted-foreground text-xs">{item.detail}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
