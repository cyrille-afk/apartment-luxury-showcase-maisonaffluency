import { useState, useEffect } from "react";
import { Bell, X, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

interface NotificationMetadata {
  request_id?: string;
  requester_name?: string;
  requester_company?: string;
  product_name?: string;
  brand_name?: string;
  project_name?: string;
  project_location?: string;
  status?: string;
  quantity?: number;
  action_label?: string;
  action_link?: string;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
  metadata?: NotificationMetadata | null;
}

const STATUS_TONES: Record<string, string> = {
  new: "bg-primary/15 text-primary",
  open: "bg-primary/15 text-primary",
  in_progress: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  awaiting_client: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
  quoted: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
  resolved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  completed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
  closed: "bg-muted text-muted-foreground",
};

function StatusPill({ status }: { status: string }) {
  const tone = STATUS_TONES[status] ?? "bg-muted text-muted-foreground";
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded font-body text-[9px] uppercase tracking-wider ${tone}`}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!user) return;

    const fetchNotifications = async () => {
      const { data } = await (supabase as any)
        .from("notifications")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data || []);
    };

    fetchNotifications();

    const channel = supabase
      .channel(`notifications-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        (payload: any) => {
          setNotifications((prev) => [payload.new as Notification, ...prev]);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const markAllRead = async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unreadIds.length === 0) return;
    await (supabase as any)
      .from("notifications")
      .update({ is_read: true })
      .in("id", unreadIds);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  const goTo = (n: Notification, href: string | null | undefined) => {
    if (!href) return;
    if (!n.is_read) markAsRead(n.id);
    navigate(href);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground rounded-full text-[9px] flex items-center justify-center font-body">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 w-96 bg-background border border-border rounded-lg shadow-lg z-50 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="font-display text-sm text-foreground">
                Notifications
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="font-body text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setOpen(false)}
                  className="p-1 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="px-4 py-8 text-center font-body text-xs text-muted-foreground">
                  No notifications yet
                </p>
              ) : (
                notifications.map((n) => {
                  const meta = (n.metadata ?? {}) as NotificationMetadata;
                  const hasSummary =
                    meta.requester_name ||
                    meta.product_name ||
                    meta.project_name ||
                    meta.status;
                  const actionHref = meta.action_link || n.link;
                  const actionLabel = meta.action_label || "Open";

                  return (
                    <div
                      key={n.id}
                      className={`px-4 py-3 border-b border-border last:border-0 transition-colors ${
                        !n.is_read ? "bg-primary/5" : ""
                      }`}
                    >
                      <button
                        onClick={() => goTo(n, actionHref)}
                        className="w-full text-left"
                      >
                        <div className="flex items-start gap-2">
                          {!n.is_read && (
                            <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-body text-xs font-medium text-foreground truncate">
                                {n.title}
                              </p>
                              {meta.status && <StatusPill status={meta.status} />}
                            </div>

                            {hasSummary ? (
                              <div className="mt-1 space-y-0.5">
                                {meta.requester_name && (
                                  <p className="font-body text-[11px] text-foreground/80 truncate">
                                    <span className="text-muted-foreground">Name: </span>
                                    {meta.requester_name}
                                    {meta.requester_company
                                      ? ` · ${meta.requester_company}`
                                      : ""}
                                  </p>
                                )}
                                {meta.product_name && (
                                  <p className="font-body text-[11px] text-foreground/80 truncate">
                                    <span className="text-muted-foreground">Item: </span>
                                    {meta.product_name}
                                    {meta.brand_name ? ` (${meta.brand_name})` : ""}
                                    {meta.quantity && meta.quantity > 1
                                      ? ` × ${meta.quantity}`
                                      : ""}
                                  </p>
                                )}
                                {(meta.project_name || meta.project_location) && (
                                  <p className="font-body text-[11px] text-foreground/80 truncate">
                                    <span className="text-muted-foreground">Property: </span>
                                    {meta.project_name || "—"}
                                    {meta.project_location
                                      ? ` · ${meta.project_location}`
                                      : ""}
                                  </p>
                                )}
                              </div>
                            ) : (
                              <p className="font-body text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
                                {n.message}
                              </p>
                            )}

                            <p className="font-body text-[10px] text-muted-foreground/60 mt-1.5">
                              {formatDistanceToNow(new Date(n.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                      </button>

                      {actionHref && (
                        <div className="mt-2 flex items-center gap-2 pl-3.5">
                          <button
                            onClick={() => goTo(n, actionHref)}
                            className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border text-[10px] font-body text-foreground hover:bg-muted transition-colors"
                          >
                            {actionLabel}
                            <ArrowRight className="w-3 h-3" />
                          </button>
                          {!n.is_read && (
                            <button
                              onClick={() => markAsRead(n.id)}
                              className="text-[10px] font-body text-muted-foreground hover:text-foreground transition-colors"
                            >
                              Mark read
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
