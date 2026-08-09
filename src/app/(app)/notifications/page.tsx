"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { api } from "@/lib/api";
import type { AppNotification } from "@/lib/types";

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = React.useState<AppNotification[]>([]);
  const [unread, setUnread] = React.useState(0);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await api.get<{ notifications: AppNotification[]; unread: number }>(
          "/api/v1/notifications?limit=50"
        );
        if (cancelled) return;
        setNotifications(res.notifications ?? []);
        setUnread(res.unread ?? 0);
      } catch (err) {
        if (!cancelled) toast.error(err instanceof Error ? err.message : "Could not load notifications");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const open = async (n: AppNotification) => {
    if (!n.read) {
      void api.post(`/api/v1/notifications/${n.id}/read`).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setNotifications((list) =>
        list.map((x) => (x.id === n.id ? { ...x, read: true } : x))
      );
    }
    if (n.link) router.push(n.link);
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
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Campaign, team, and account updates for this workspace."
        icon={Bell}
        actions={
          unread > 0 && (
            <Button variant="outline" size="sm" onClick={markAllRead}>
              <CheckCheck /> Mark all as read
            </Button>
          )
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        {loading && notifications.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 px-4 py-16 text-sm">
            <Loader2 className="animate-spin" /> Loading…
          </div>
        ) : notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="No notifications yet"
            description="Campaign results, team activity, and account updates will show up here."
            className="py-14"
          />
        ) : (
          <div className="divide-y">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => void open(n)}
                className={cn(
                  "hover:bg-muted/40 flex w-full cursor-pointer items-start gap-3 px-5 py-4 text-left transition-colors",
                  n.read && "opacity-60"
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 flex size-2 shrink-0 rounded-full",
                    n.read ? "bg-muted-foreground/40" : "bg-primary"
                  )}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{n.title}</span>
                    {!n.read && (
                      <Badge variant="secondary" className="px-1.5 py-0 text-[0.65rem]">
                        New
                      </Badge>
                    )}
                  </span>
                  <span className="text-muted-foreground text-sm leading-relaxed">{n.body}</span>
                  <span className="text-muted-foreground mt-1 text-xs">
                    {timeAgo(n.createdAt)}
                  </span>
                </span>
                {n.link && (
                  <span className="text-muted-foreground mt-1 text-xs underline-offset-4 hover:underline">
                    Open
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </Card>

      {unread > 0 && (
        <p className="text-muted-foreground text-center text-xs">
          {unread} unread notification{unread === 1 ? "" : "s"}
        </p>
      )}
    </div>
  );
}
