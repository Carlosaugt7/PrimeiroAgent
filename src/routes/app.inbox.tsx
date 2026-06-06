import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore, type Conversation } from "@/lib/app-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Send, UserCheck } from "lucide-react";

export const Route = createFileRoute("/app/inbox")({
  component: Inbox,
});

function Inbox() {
  const { conversations, agents } = useAppStore();
  const [selected, setSelected] = useState<Conversation | null>(conversations[0] ?? null);
  const [filter, setFilter] = useState<"todas" | "abertas" | "handoff">("todas");

  const filtered = conversations.filter((c) =>
    filter === "todas" ? true : filter === "abertas" ? c.status === "aberta" : c.status === "handoff",
  );

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-3xl font-bold">Inbox</h1>
        <p className="text-muted-foreground mt-1">Conversas dos seus agentes em tempo real.</p>
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)] min-h-[500px]">
        <div className="rounded-2xl bg-gradient-card border border-border flex flex-col overflow-hidden">
          <div className="p-3 border-b border-border flex gap-1">
            {(["todas", "abertas", "handoff"] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn(
                "px-3 py-1.5 rounded-lg text-xs capitalize",
                filter === f ? "bg-gradient-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary/60",
              )}>{f}</button>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            {filtered.map((c) => {
              const agent = agents.find((a) => a.id === c.agentId);
              return (
                <button key={c.id} onClick={() => setSelected(c)} className={cn(
                  "w-full text-left p-3 border-b border-border/50 flex gap-3 hover:bg-secondary/40 transition-colors",
                  selected?.id === c.id && "bg-secondary/60",
                )}>
                  <div className="size-10 rounded-full bg-secondary grid place-items-center text-xs font-semibold shrink-0">
                    {c.contactName.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{c.contactName}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{c.updatedAt}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{c.lastMessage}</p>
                    <p className="text-[10px] text-accent mt-0.5">via {agent?.name}</p>
                  </div>
                  {c.unread > 0 && <span className="size-5 rounded-full bg-gradient-primary text-[10px] font-bold grid place-items-center text-primary-foreground self-center">{c.unread}</span>}
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-2xl bg-gradient-card border border-border flex flex-col overflow-hidden">
          {selected ? (
            <>
              <div className="p-4 border-b border-border flex items-center justify-between">
                <div>
                  <p className="font-semibold">{selected.contactName}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selected.contactPhone}</p>
                </div>
                <Button variant="outline" size="sm"><UserCheck className="size-4" /> Assumir conversa</Button>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <Bubble side="left" text="Olá! Vi seu site, queria saber sobre o produto." />
                <Bubble side="right" text="Claro! Sobre qual produto especificamente posso te ajudar?" />
                <Bubble side="left" text={selected.lastMessage} />
              </div>
              <div className="p-3 border-t border-border flex gap-2">
                <input placeholder="Responder como humano..." className="flex-1 h-10 px-3 rounded-lg bg-secondary border border-border text-sm" />
                <Button variant="hero"><Send className="size-4" /></Button>
              </div>
            </>
          ) : (
            <div className="flex-1 grid place-items-center text-muted-foreground">Selecione uma conversa</div>
          )}
        </div>
      </div>
    </div>
  );
}

function Bubble({ side, text }: { side: "left" | "right"; text: string }) {
  return (
    <div className={cn("max-w-[70%] px-3.5 py-2.5 rounded-2xl text-sm",
      side === "right" ? "ml-auto bg-gradient-primary text-primary-foreground" : "bg-card border border-border")}>
      {text}
    </div>
  );
}
