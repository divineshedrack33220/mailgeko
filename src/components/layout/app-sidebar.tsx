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
  CreditCard,
  ChevronsUpDown,
  LifeBuoy,
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
import { Badge } from "@/components/ui/badge";

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

interface NavSection {
  label: string;
  items: NavItem[];
}

const sections: NavSection[] = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", href: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Audience",
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
    items: [
      { title: "Billing", href: "/settings/billing", icon: CreditCard },
      { title: "Settings", href: "/settings", icon: Settings },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const [contactCount, setContactCount] = React.useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = React.useState("");
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
      .get<{ workspace?: { name: string } }>("/api/v1/workspace")
      .then((res) => {
        if (!cancelled && res.workspace?.name) setWorkspaceName(res.workspace.name);
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
        {sections.map((section) => (
          <div key={section.label}>
            {!collapsed && (
              <p className="text-muted-foreground mb-1 px-3 text-xs font-medium tracking-wider uppercase">
                {section.label}
              </p>
            )}
            <ul className="space-y-0.5">
              {section.items.map((item) => {
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
                      collapsed && "justify-center px-0"
                    )}
                  >
                    <item.icon
                      className={cn(
                        "size-[1.15rem] shrink-0",
                        active && "text-primary"
                      )}
                    />
                    {!collapsed && <span className="flex-1 truncate">{item.title}</span>}
                    {!collapsed && badge && (
                      <Badge
                        variant={badge === "New" ? "success" : "secondary"}
                        className="px-1.5 py-0 text-xs"
                      >
                        {badge}
                      </Badge>
                    )}
                    {active && !collapsed && (
                      <ChevronRight className="size-3.5 text-primary" />
                    )}
                  </Link>
                );
                return (
                  <li key={item.href}>
                    {collapsed ? (
                      <Tooltip>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right">{item.title}</TooltipContent>
                      </Tooltip>
                    ) : (
                      link
                    )}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="space-y-2 border-t p-3">
        {!collapsed && (
          <div className="bg-primary/5 border-primary/15 rounded-xl border p-3">
            <div className="flex items-center gap-2">
              <LifeBuoy className="text-primary size-4" />
              <p className="text-sm font-medium">Need a hand?</p>
            </div>
            <p className="text-muted-foreground mt-1 text-xs leading-relaxed">
              Check the docs or open a support ticket.
            </p>
            <Link
              href="/settings"
              className="text-primary mt-2 inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Contact support <ChevronRight className="size-3" />
            </Link>
          </div>
        )}

        <WorkspaceSwitcher
          collapsed={collapsed}
          workspaceName={workspaceName}
          planName={planName}
        />
      </div>
    </aside>
  );
}

function WorkspaceSwitcher({
  collapsed,
  workspaceName,
  planName,
}: {
  collapsed: boolean;
  workspaceName: string;
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
        <span className="bg-sidebar-primary text-sidebar-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-md text-[0.7rem] font-bold">
          {avatarText}
        </span>
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
