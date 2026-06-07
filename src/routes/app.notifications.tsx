import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, updateDoc } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";
import { useAuth } from "@/lib/auth";
import { Bell, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/notifications")({
  head: () => ({ meta: [{ title: "Notificações — AgentHub AI" }] }),
  component: Page,
});

function Page() {
  const { tenant } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!tenant?.id) return;
    return onSnapshot(
      query(collection(db, "tenants", tenant.id, "notifications"), orderBy("createdAt", "desc")),
      (s) => setItems(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
    );
  }, [tenant?.id]);

  const list = filter === "unread" ? items.filter((i) => !i.read) : items;

  const markRead = async (id: string) => {
    if (!tenant?.id) return;
    try { await updateDoc(doc(db, "tenants", tenant.id, "notifications", id), { read: true }); } catch {}
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold">Notificações</h1>
          <p className="text-muted-foreground mt-1">{items.length} total · {items.filter((i) => !i.read).length} não lidas</p>
        </div>
        <div className="flex gap-1 rounded-lg bg-secondary/60 p-1">
          {(["all", "unread"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn("px-3 py-1 text-xs rounded-md font-medium",
                filter === f ? "bg-card text-foreground" : "text-muted-foreground")}>
              {f === "all" ? "Todas" : "Não lidas"}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-gradient-card divide-y divide-border/40">
        {list.length === 0 ? (
          <div className="p-16 text-center text-sm text-muted-foreground">
            <Bell className="size-10 mx-auto mb-3 opacity-40" />
            Nada por aqui.
          </div>
        ) : list.map((n) => (
          <div key={n.id} onClick={() => markRead(n.id)}
            className={cn("p-4 flex gap-3 hover:bg-secondary/30 cursor-pointer", !n.read && "bg-accent/5")}>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className={cn("text-[10px] uppercase font-bold px-1.5 py-0.5 rounded",
                  n.severity === "error" ? "bg-destructive/20 text-destructive" :
                  n.severity === "warning" ? "bg-orange-500/20 text-orange-400" :
                  n.severity === "success" ? "bg-success/20 text-success" :
                  "bg-accent/20 text-accent")}>{n.severity ?? "info"}</span>
                <p className="font-semibold text-sm">{n.title}</p>
                {!n.read && <span className="size-2 rounded-full bg-accent" />}
              </div>
              {n.body && <p className="text-sm text-muted-foreground mt-1">{n.body}</p>}
              <p className="text-[11px] text-muted-foreground mt-1">
                {n.createdAt?.seconds ? new Date(n.createdAt.seconds * 1000).toLocaleString("pt-BR") : "—"}
                {" · "}{n.type}
              </p>
            </div>
            {n.link && (
              <Link to={n.link} className="text-accent text-xs inline-flex items-center gap-1 self-center">
                Abrir <ExternalLink className="size-3" />
              </Link>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
