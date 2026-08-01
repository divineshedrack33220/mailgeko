"use client";

import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Sparkles,
  PanelLeftClose,
  PanelLeftOpen,
  Bell,
  Moon,
  Sun,
  Command,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { getPageTitle } from "@/lib/page-title";
import { useUiStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

export function Topbar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setAiOpen = useUiStore((s) => s.setAiOpen);

  const title = React.useMemo(() => getPageTitle(pathname), [pathname]);

  return (
    <>
      <title>{`${title} · Mailgeko`}</title>
      <header className="bg-background/80 sticky top-0 z-20 flex h-16 items-center gap-3 border-b px-4 backdrop-blur-md lg:px-6">
      <Button
        variant="ghost"
        size="icon-sm"
        className="hidden lg:inline-flex"
        onClick={toggleSidebar}
        aria-label="Toggle sidebar"
      >
        {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
      </Button>

      <MobileNav />

      <div className="flex items-baseline gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          onClick={() => setCommandOpen(true)}
          className="text-muted-foreground hover:bg-accent hover:text-foreground hidden h-9 w-64 cursor-pointer items-center gap-2 rounded-md border bg-card px-3 text-sm transition-colors md:flex"
        >
          <Search className="size-4" />
          <span className="flex-1 text-left">Search anything…</span>
          <kbd className="bg-muted text-muted-foreground pointer-events-none inline-flex h-5 items-center gap-0.5 rounded border px-1.5 font-mono text-[0.65rem] font-medium">
            <Command className="size-2.5" />K
          </kbd>
        </button>

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="outline"
              className="text-primary hidden gap-2 sm:inline-flex"
              onClick={() => setAiOpen(true)}
            >
              <Sparkles className="size-4" />
              <span className="text-sm font-medium">AI Studio</span>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Open AI Studio</TooltipContent>
        </Tooltip>

        <ThemeToggle />
        <NotificationsMenu />
        <Separator orientation="vertical" className="mx-1 hidden h-6 sm:block" />
        <UserMenu />
      </div>
      </header>
    </>
  );
}

function MobileNav() {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
          <PanelLeftOpen />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 p-0">
        <SheetTitle className="sr-only">Navigation</SheetTitle>
        <AppSidebar />
      </SheetContent>
    </Sheet>
  );
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle theme"
        >
          <Sun className="dark:hidden" />
          <Moon className="hidden dark:block" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Toggle theme</TooltipContent>
    </Tooltip>
  );
}

const notifications = [
  {
    id: 1,
    title: "Campaign finished sending",
    detail: "July Product Digest reached 1,089 inboxes.",
    time: "2h ago",
    unread: true,
  },
  {
    id: 2,
    title: "Bounce rate spike detected",
    detail: "Bounce rate on Acme mailing is above 3%.",
    time: "5h ago",
    unread: true,
  },
  {
    id: 3,
    title: "AI Studio ready",
    detail: "New subject line generator is live.",
    time: "1d ago",
    unread: false,
  },
  {
    id: 4,
    title: "New subscriber milestone",
    detail: "You passed 1,200 active subscribers.",
    time: "2d ago",
    unread: false,
  },
];

function NotificationsMenu() {
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotificationsOpen);

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell className="size-[1.15rem]" />
          <span className="bg-primary absolute top-1.5 right-1.5 size-1.5 rounded-full ring-2 ring-background" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <Badge variant="secondary" className="text-xs">
            2 new
          </Badge>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-80">
          {notifications.map((n) => (
            <DropdownMenuItem
              key={n.id}
              className={cn(
                "cursor-pointer items-start gap-3 px-4 py-3",
                !n.unread && "opacity-60"
              )}
            >
              <span className="bg-primary/10 text-primary mt-1 flex size-2 shrink-0 rounded-full" />
              <span className="flex flex-col gap-0.5">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {n.title}
                  {n.unread && (
                    <span className="bg-primary size-1.5 rounded-full" />
                  )}
                </span>
                <span className="text-muted-foreground text-xs leading-relaxed">
                  {n.detail}
                </span>
                <span className="text-muted-foreground mt-0.5 text-[0.7rem]">
                  {n.time}
                </span>
              </span>
            </DropdownMenuItem>
          ))}
        </ScrollArea>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="cursor-pointer justify-center py-2 text-center text-xs font-medium"
          onClick={() => toast.info("Notification center is coming soon")}
        >
          View all notifications
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function UserMenu() {
  const router = useRouter();
  const { user } = useAuthStore();
  const logout = useAuthStore((s) => s.logout);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  const signOut = () => {
    logout();
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="focus-visible:ring-ring flex cursor-pointer items-center gap-2 rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2">
          <Avatar className="size-8">
            <AvatarImage src="" alt={user?.name ?? "User"} />
            <AvatarFallback className="bg-primary/10 text-primary font-semibold">
              {user?.name
                ?.split(" ")
                .filter(Boolean)
                .slice(0, 2)
                .map((n) => n[0]?.toUpperCase())
                .join("") || "U"}
            </AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>
          <span className="block text-sm font-semibold">{user?.name}</span>
          <span className="text-muted-foreground block truncate text-xs font-normal">
            {user?.email}
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/settings")}>
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem className="cursor-pointer" onClick={() => router.push("/settings/team")}>
            Workspace settings
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer"
            onClick={() => setCommandOpen(true)}
          >
            Keyboard shortcuts
            <DropdownMenuShortcut>⌘K</DropdownMenuShortcut>
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={signOut}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
