import { Link } from "@tanstack/react-router";
import { Bell, CheckCheck } from "lucide-react";

import { useNotifications } from "@/hooks/use-notifications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDateTime } from "@/lib/rpi-helpers";

export function NotificationBell() {
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 min-w-5 px-1 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px]">
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-border">
          <span className="text-sm font-medium">Notifications</span>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={() => markAllAsRead()}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Tout marquer lu
            </Button>
          )}
        </div>
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              Aucune notification.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((n) => {
                const content = (
                  <div
                    className={`px-3 py-2.5 text-sm hover:bg-accent/40 transition-colors ${
                      n.lu ? "" : "bg-primary/5"
                    }`}
                    onClick={() => {
                      if (!n.lu) markAsRead(n.id);
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.lu && (
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                      )}
                      <div className="flex-1">
                        <p className={n.lu ? "text-muted-foreground" : "font-medium"}>
                          {n.message}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {formatDateTime(n.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
                return n.demande_id ? (
                  <Link
                    key={n.id}
                    to="/demandes/$id"
                    params={{ id: n.demande_id }}
                    className="block"
                  >
                    {content}
                  </Link>
                ) : (
                  <div key={n.id}>{content}</div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
