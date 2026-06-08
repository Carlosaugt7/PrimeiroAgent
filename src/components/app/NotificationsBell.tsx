import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertTriangle, Bell, CheckCheck, CircleAlert, CircleCheck, Info } from "lucide-react";
import { cn } from "@/lib/utils";

interface NotifDoc {
  id: string;
  type: string;
  title: string;
  body?: string | null;
  severity?: "info" | "success" | "warning" | "error";
  link?: string | null;
  read?: boolean;
  createdAt?: string | null;
}

const ICONS: Record<string, any> = {
  info: Info,
  success: CircleCheck,
  warning: AlertTriangle,
  error: CircleAlert,
};
const TONES: Record<string, string> = {
  info: "text-accent",
  success: "text-success",
  warning: "text-orange-400",
  error: "text-destructive",
};

export function NotificationsBell() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<NotifDoc[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;

    const fetchNotifs = async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("createdAt", { ascending: false })
        .limit(20);

      if (error) {
        console.warn("[notifs]", error);
      } else if (data) {
        setItems(data as NotifDoc[]);
      }
    };

    fetchNotifs();

    const channel = supabase
      .channel("public:notifications")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `tenantId=eq.${tenant.id}`,
        },
        () => {
          fetchNotifs();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant?.id]);

  const unread = items.filter((i) => !i.read).length;

  const markAllRead = async () => {
    if (!tenant?.id) return;
    try {
      const unreadItems = items.filter((i) => !i.read);
      await Promise.all(
        unreadItems.map(async (n) => {
          await supabase.from("notifications").update({ read: true }).eq("id", n.id);
        }),
      );
      // Os eventos de realtime ou a mudança de estado devem disparar a atualização
    } catch (e) {
      console.warn(e);
    }
  };

  const onClick = async (n: NotifDoc) => {
    if (!tenant?.id || n.read) return;
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id);
    } catch {}
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="size-9 rounded-lg grid place-items-center hover:bg-secondary/60 relative"
          aria-label="Notificações"
        >
          <Bell className="size-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground grid place-items-center px-1">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <p className="font-semibold text-sm">Notificações</p>
          {unread > 0 && (
            <button
              onClick={markAllRead}
              className="text-xs text-accent hover:underline inline-flex items-center gap-1"
            >
              <CheckCheck className="size-3" /> Marcar todas como lidas
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto">
          {items.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              <Bell className="size-8 mx-auto mb-2 opacity-50" />
              Nenhuma notificação ainda.
            </div>
          ) : (
            items.map((n) => {
              const Icon = ICONS[n.severity ?? "info"] ?? Info;
              const tone = TONES[n.severity ?? "info"] ?? "text-accent";
              const inner = (
                <button
                  type="button"
                  className={cn(
                    "w-full text-left px-4 py-3 border-b border-border/40 hover:bg-secondary/40 flex gap-3",
                    !n.read && "bg-accent/5",
                  )}
                  onClick={() => onClick(n)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onClick(n);
                  }}
                >
                  <Icon className={cn("size-4 shrink-0 mt-0.5", tone)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{n.title}</p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    )}
                    {n.createdAt && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {new Date(n.createdAt).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                  {!n.read && <span className="size-2 rounded-full bg-accent mt-2" />}
                </button>
              );
              return n.link ? (
                <Link key={n.id} to={n.link} onClick={() => setOpen(false)} className="block">
                  {inner}
                </Link>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })
          )}
        </div>
        <div className="px-4 py-2 border-t border-border text-center">
          <Link
            to="/app/notifications"
            onClick={() => setOpen(false)}
            className="text-xs text-accent hover:underline"
          >
            Ver todas
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
