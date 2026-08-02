"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Send,
  Workflow,
  Users,
  ListFilter,
  FileText,
  Sparkles,
  BarChart3,
  Settings,
  ChevronRight,
  ChevronDown,
  CreditCard,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatNumber, initials } from "@/lib/format";
import { api } from "@/lib/api";
import { useAuthStore } from "@/stores/auth-store";
import { useUiStore } from "@/stores/ui-store";
import { useRouter } from "next/navigation";
import { GeckoMark } from "@/components/brand/gecko-mark";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  collapsible?: boolean;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Audience",
    icon: Users,
    collapsible: true,
    items: [
      { title: "Contacts", href: "/contacts", icon: Users },
      { title: "Lists & Segments", href: "/lists", icon: ListFilter },
    ],
  },
  {
    label: "Content",
    items: [
      { title: "Campaigns", href: "/campaigns", icon: Send },
      { title: "Automations", href: "/automations", icon: Workflow },
      { title: "Templates", href: "/templates", icon: FileText },
      { title: "AI Studio", href: "/ai", icon: Sparkles },
    ],
  },
  {
    label: "Insights",
    items: [{ title: "Reports", href: "/reports", icon: BarChart3 }],
  },
  {
    label: "Account",
    items: [{ title: "Settings", href: "/settings", icon: Settings }],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const [contactCount, setContactCount] = React.useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = React.useState("");
  const [workspaceLogo, setWorkspaceLogo] = React.useState("");
  const [planName, setPlanName] = React.useState("");

  React.useEffect(() => {
    let cancelled = false;
    api
      .get<{ total?: number }>("/api/v1/contacts?limit=1")
      .then((res) => {
        if (!cancelled && typeof res.total === "number") {
          setContactCount(formatNumber(res.total));
        }
      })
      .catch(() => {});
    api
      .get<{ workspace?: { name: string; logoUrl?: string } }>("/api/v1/workspace")
      .then((res) => {
        if (!cancelled) {
          if (res.workspace?.name) setWorkspaceName(res.workspace.name);
          if (res.workspace?.logoUrl) setWorkspaceLogo(res.workspace.logoUrl);
        }
      })
      .catch(() => {});
    api
      .get<{ limits?: { planName: string } }>("/api/v1/billing")
      .then((res) => {
        if (!cancelled && res.limits?.planName) setPlanName(res.limits.planName);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const isActive = (href: string) =>
    pathname === href || (href !== "/dashboard" && pathname.startsWith(href + "/"));

  const renderNavItem = (item: NavItem, iconOnly: boolean) => {
    const active = isActive(item.href);
    const badge = item.href === "/contacts" ? contactCount : item.badge;
    const link = (
      <Link
        href={item.href}
        className={cn(
          "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          iconOnly && "justify-center px-0"
        )}
      >
        <item.icon
          className={cn("size-[1.15rem] shrink-0", active && "text-primary")}
        />
        {!iconOnly && <span className="flex-1 truncate">{item.title}</span>}
        {!iconOnly && badge && (
          <Badge
            variant={badge === "New" ? "success" : "secondary"}
            className="px-1.5 py-0 text-xs"
          >
            {badge}
          </Badge>
        )}
        {active && !iconOnly && <ChevronRight className="size-3.5 text-primary" />}
      </Link>
    );
    return (
      <li key={item.href}>
        {iconOnly ? (
          <Tooltip>
            <TooltipTrigger asChild>{link}</TooltipTrigger>
            <TooltipContent side="right">{item.title}</TooltipContent>
          </Tooltip>
        ) : (
          link
        )}
      </li>
    );
  };

  return (
    <aside
      className={cn(
        "bg-sidebar text-sidebar-foreground border-sidebar-border sticky top-0 z-30 hidden h-dvh shrink-0 flex-col border-r transition-[width] duration-300 lg:flex",
        collapsed ? "w-[4.5rem]" : "w-64"
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b px-4">
        {collapsed ? (
          <span className="bg-primary/10 text-primary mx-auto flex size-9 items-center justify-center rounded-xl">
            <GeckoMark className="size-6" />
          </span>
        ) : (
          <span className="flex items-center gap-2.5">
            <span className="bg-primary/10 text-primary flex size-9 items-center justify-center rounded-xl">
              <GeckoMark className="size-6" />
            </span>
            <span className="text-[1.05rem] font-semibold tracking-tight">
              Mail<span className="text-primary">geko</span>
            </span>
          </span>
        )}
      </div>

      <nav className="scrollbar-thin flex-1 space-y-4 overflow-y-auto px-3 py-3">
        {sections.map((section) =>
          section.collapsible && section.icon ? (
            collapsed ? (
              <DropdownMenu key={section.label}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <DropdownMenuTrigger
                      className="text-sidebar-foreground/75 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground mx-auto flex size-10 cursor-pointer items-center justify-center rounded-lg transition-colors outline-none"
                      aria-label={section.label}
                    >
                      <section.icon className="size-[1.15rem]" />
                    </DropdownMenuTrigger>
                  </TooltipTrigger>
                  <TooltipContent side="right">{section.label}</TooltipContent>
                </Tooltip>
                <DropdownMenuContent align="start" side="right" sideOffset={8} className="w-52">
                  <DropdownMenuLabel>{section.label}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {section.items.map((item) => (
                    <DropdownMenuItem key={item.href} asChild>
                      <Link href={item.href}>
                        <item.icon />
                        {item.title}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Collapsible key={section.label} defaultOpen={section.items.some((i) => isActive(i.href))}>
                <CollapsibleTrigger asChild>
                  <button
                    className="group flex w-full cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-sidebar-accent/60"
                    aria-label={section.label}
                  >
                    <span className="flex items-center gap-3">
                      <section.icon className="text-sidebar-foreground/75 size-[1.15rem]" />
                      <span>{section.label}</span>
                    </span>
                    <ChevronDown className="text-muted-foreground size-4 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent className="mt-1">
                  <ul className="ml-3 space-y-0.5 border-l">
                    {section.items.map((item) => renderNavItem(item, false))}
                  </ul>
                </CollapsibleContent>
              </Collapsible>
            )
          ) : (
            <div key={section.label}>
              {!collapsed && (
                <p className="text-muted-foreground mb-1 px-3 text-xs font-medium tracking-wider uppercase">
                  {section.label}
                </p>
              )}
              <ul className="space-y-0.5">
                {section.items.map((item) => renderNavItem(item, collapsed))}
              </ul>
            </div>
          )
        )}
      </nav>

      <div className="space-y-2 border-t p-3">
        <WorkspaceSwitcher
          collapsed={collapsed}
          workspaceName={workspaceName}
          workspaceLogo={workspaceLogo}
          planName={planName}
        />
      </div>
    </aside>
  );
}

function WorkspaceSwitcher({
  collapsed,
  workspaceName,
  workspaceLogo,
  planName,
}: {
  collapsed: boolean;
  workspaceName: string;
  workspaceLogo: string;
  planName: string;
}) {
  const router = useRouter();
  const { user } = useAuthStore();
  const displayName = workspaceName || "Your workspace";
  const [first, ...rest] = displayName.trim().split(/\s+/);
  const avatarText = workspaceName ? initials(first, rest[0]) : "WS";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "hover:bg-sidebar-accent flex w-full cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-left transition-colors outline-none",
          collapsed && "justify-center px-0"
        )}
      >
        {workspaceLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={workspaceLogo}
            alt=""
            className="bg-sidebar-primary flex size-7 shrink-0 items-center justify-center rounded-md object-contain"
          />
        ) : (
          <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-[0.7rem] font-bold">
            {avatarText}
          </span>
        )}
        {!collapsed && (
          <>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">{displayName}</span>
              {planName && (
                <span className="text-muted-foreground text-xs">
                  {planName} plan
                </span>
              )}
            </span>
            <ChevronsUpDown className="text-muted-foreground size-4 shrink-0" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold">{displayName}</span>
          <span className="text-muted-foreground block text-xs">
            {planName ? `${planName} plan` : "Workspace"}
            {user?.role ? ` · ${user.role} access` : ""}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/settings/billing")}
        >
          <CreditCard className="size-4" /> Billing & plan
        </DropdownMenuItem>
        <DropdownMenuItem
          className="cursor-pointer"
          onClick={() => router.push("/settings")}
        >
          <Settings className="size-4" /> Workspace settings
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
