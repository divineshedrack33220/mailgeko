"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Workflow,
  Users,
  ListFilter,
  FileText,
  BarChart3,
  Sparkles,
  Settings,
  Search,
  Upload,
  Plus,
  Mail,
  CreditCard,
} from "lucide-react";
import { useUiStore } from "@/stores/ui-store";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
  CommandShortcut,
} from "@/components/ui/command";

const navigationItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Campaigns", href: "/campaigns", icon: Send },
  { label: "Automations", href: "/automations", icon: Workflow },
  { label: "Contacts", href: "/contacts", icon: Users },
  { label: "Lists & Segments", href: "/lists", icon: ListFilter },
  { label: "Templates", href: "/templates", icon: FileText },
  { label: "Reports", href: "/reports", icon: BarChart3 },
  { label: "AI Studio", href: "/ai", icon: Sparkles },
  { label: "Billing", href: "/settings/billing", icon: CreditCard },
  { label: "Settings", href: "/settings", icon: Settings },
];

const actions = [
  { label: "Create campaign", shortcut: "C", icon: Plus, run: () => window.location.assign("/campaigns/new") },
  { label: "Import contacts", shortcut: "I", icon: Upload, run: () => window.location.assign("/contacts") },
  { label: "New automation", shortcut: "A", icon: Workflow, run: () => window.location.assign("/automations") },
  { label: "Create template", shortcut: "T", icon: FileText, run: () => window.location.assign("/templates") },
  { label: "Compose quick email", shortcut: "E", icon: Mail, run: () => window.location.assign("/campaigns/new") },
];

export function CommandMenu() {
  const router = useRouter();
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);

  const run = React.useCallback(
    (href: string) => {
      setOpen(false);
      router.push(href);
    },
    [router, setOpen]
  );

  return (
    <CommandDialog
      open={open}
      onOpenChange={setOpen}
      contentClassName="top-[20%] translate-y-0"
    >
      <CommandInput autoFocus placeholder="Search pages, contacts, campaigns…" />
      <CommandList>
        <CommandEmpty className="py-8 text-sm">
          No results found. Try a different search.
        </CommandEmpty>
        <CommandGroup heading="Quick actions">
          {actions.map((action) => (
            <CommandItem
              key={action.label}
              value={action.label}
              onSelect={() => {
                setOpen(false);
                action.run();
              }}
              className="cursor-pointer"
            >
              <action.icon />
              <span>{action.label}</span>
              <CommandShortcut>{action.shortcut}</CommandShortcut>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Navigate">
          {navigationItems.map((item) => (
            <CommandItem
              key={item.href}
              value={`${item.label} ${item.href}`}
              onSelect={() => run(item.href)}
              className="cursor-pointer"
            >
              <item.icon />
              <span>{item.label}</span>
            </CommandItem>
          ))}
        </CommandGroup>
        <CommandSeparator />
        <CommandGroup heading="Search">
          <CommandItem className="cursor-pointer" onSelect={() => run("/contacts?q=sarah")}>
            <Search className="size-4" />
            <span className="flex flex-col">
              <span>Sarah Johnson</span>
              <span className="text-muted-foreground text-xs">sarah.johnson@acme.co</span>
            </span>
          </CommandItem>
          <CommandItem className="cursor-pointer" onSelect={() => run("/campaigns/cmp-001")}>
            <Send className="size-4" />
            <span className="flex flex-col">
              <span>July Product Digest</span>
              <span className="text-muted-foreground text-xs">Sent campaign</span>
            </span>
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
