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
  Loader2,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { getPageTitle } from "@/lib/page-title";
import { useUiStore } from "@/stores/ui-store";
import { useAuthStore } from "@/stores/auth-store";
import { isAdminRole } from "@/lib/permissions";
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
import { api } from "@/lib/api";
import { timeAgo } from "@/lib/format";
import { AppNotification } from "@/lib/types";

export function Topbar() {
  const pathname = usePathname();
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  const setAiOpen = useUiStore((s) => s.setAiOpen);
  const role = useAuthStore((s) => s.role);
  const showAi = isAdminRole(role);

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

        {showAi && (
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
        )}

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

function NotificationsMenu() {
  const router = useRouter();
  const open = useUiStore((s) => s.notificationsOpen);
  const setOpen = useUiStore((s) => s.setNotificationsOpen);
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ notifications: AppNotification[]; unread: number }>(
        "/api/v1/notifications"
      );
      setNotifications(res.notifications ?? []);
      setUnread(res.unread ?? 0);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not load notifications");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const run = async () => {
      await load();
    };
    run();
  }, [open, load]);

  React.useEffect(() => {
    const refreshUnread = async () => {
      try {
        const res = await api.get<{ notifications: AppNotification[]; unread: number }>(
          "/api/v1/notifications"
        );
        setNotifications(res.notifications ?? []);
        setUnread(res.unread ?? 0);
      } catch {
        // keep the current badge on transient errors
      }
    };
    const interval = window.setInterval(refreshUnread, 60000);
    return () => window.clearInterval(interval);
  }, []);

  const markRead = async (n: AppNotification) => {
    if (!n.read) {
      void api.post(`/api/v1/notifications/${n.id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setNotifications((list) =>
        list.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    if (n.link) router.push(n.link);
    setOpen(false);
  };

  const markAllRead = async () => {
    try {
      await api.post("/api/v1/notifications/read-all");
      setUnread(0);
      setNotifications((list) => list.map((x) => ({ ...x, read: true })));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update notifications");
    }
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" className="relative" aria-label="Notifications">
          <Bell className="size-[1.15rem]" />
          {unread > 0 && (
            <span className="bg-primary absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full text-[0.55rem] font-semibold text-primary-foreground ring-2 ring-background">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <DropdownMenuLabel className="flex items-center justify-between px-4 py-3">
          <span className="text-sm font-semibold">Notifications</span>
          <div className="flex items-center gap-2">
            {unread > 0 && (
              <Badge variant="secondary" className="text-xs">
                {unread} new
              </Badge>
            )}
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium"
              >
                Mark all as read
              </button>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <ScrollArea className="max-h-80">
          {loading && notifications.length === 0 ? (
            <div className="text-muted-foreground flex items-center gap-2 px-4 py-8 text-sm">
              <Loader2 className="animate-spin" />
              Loading…
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-muted-foreground flex flex-col items-center gap-1 px-4 py-8 text-center text-sm">
              <span>You&apos;re all caught up.</span>
              <span className="text-xs">Campaign and account updates will show up here.</span>
            </div>
          ) : (
            notifications.map((n) => (
              <DropdownMenuItem
                key={n.id}
                onSelect={(e) => {
                  e.preventDefault();
                  void markRead(n);
                }}
                className={cn(
                  "cursor-pointer items-start gap-3 px-4 py-3",
                  n.read && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "mt-1 flex size-2 shrink-0 rounded-full",
                    n.read ? "bg-muted-foreground/40" : "bg-primary/10"
                  )}
                >
                  {!n.read && <span className="bg-primary size-1.5 self-center rounded-full" />}
                </span>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <span className="flex items-center gap-2 text-sm font-medium">
                    {n.title}
                    {!n.read && (
                      <span className="bg-primary size-1.5 rounded-full" />
                    )}
                  </span>
                  <span className="text-muted-foreground text-xs leading-relaxed">{n.body}</span>
                  <span className="text-muted-foreground mt-0.5 text-[0.7rem]">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
              </DropdownMenuItem>
            ))
          )}
        </ScrollArea>
        {notifications.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="justify-center py-2 text-center text-xs font-medium"
              onSelect={(e) => {
                e.preventDefault();
                setOpen(false);
                router.push("/notifications");
              }}
            >
              View all notifications
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
function UserMenu() {
  const router = useRouter();
  const { user } = useAuthStore();
  const [signOutOpen, setSignOutOpen] = React.useState(false);
  const [signingOut, setSigningOut] = React.useState(false);

  const logout = useAuthStore((s) => s.logout);
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);

  const signOut = async () => {
    setSigningOut(true);
    try {
      await logout();
      router.push("/login");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
        <button className="focus-visible:ring-ring flex cursor-pointer items-center gap-2 rounded-full p-0.5 outline-none transition-colors focus-visible:ring-2">
          <Avatar className="size-8">
            <AvatarImage src={user?.avatarUrl ?? ""} alt={user?.name ?? "User"} />
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
        <DropdownMenuItem className="cursor-pointer" variant="destructive" onClick={() => setSignOutOpen(true)}>
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={signOutOpen} onOpenChange={setSignOutOpen}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Sign out of Mailgeko?</AlertDialogTitle>
          <AlertDialogDescription>
            You will need your password to sign back in. Any unsaved work will be lost.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={signOut} disabled={signingOut}>
            {signingOut && <Loader2 className="animate-spin" />}
            Sign out
          </AlertDialogAction>
        </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
