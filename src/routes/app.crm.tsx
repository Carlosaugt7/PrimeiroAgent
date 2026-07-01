import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAppStore, type Conversation } from "@/lib/app-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Contact, Download, MessageCircle, Search, X, Trash2, Clock } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/crm")({
  head: () => ({ meta: [{ title: "Contatos (CRM) — Primeiro Agent" }] }),
  component: CRM,
});

const columns = [
  {
    id: "aberta",
    label: "Aberta (IA)",
    dotColor: "bg-sky-500",
    colBg: "bg-sky-500/[0.02] dark:bg-sky-500/[0.01]",
    colBorder: "border-sky-500/10 dark:border-sky-500/5",
    cardBg:
      "bg-sky-500/[0.04] dark:bg-sky-950/20 hover:bg-sky-500/[0.08] border-sky-500/10 hover:border-sky-500/30",
    shadow: "hover:shadow-sky-500/[0.06] hover:shadow-md",
    textClass: "text-sky-500 dark:text-sky-400",
  },
  {
    id: "em_atendimento",
    label: "Em Atendimento",
    dotColor: "bg-amber-500",
    colBg: "bg-amber-500/[0.02] dark:bg-amber-500/[0.01]",
    colBorder: "border-amber-500/10 dark:border-amber-500/5",
    cardBg:
      "bg-amber-500/[0.04] dark:bg-amber-950/20 hover:bg-amber-500/[0.08] border-amber-500/10 hover:border-amber-500/30",
    shadow: "hover:shadow-amber-500/[0.06] hover:shadow-md",
    textClass: "text-amber-500 dark:text-amber-400",
  },
  {
    id: "handoff",
    label: "Handoff",
    dotColor: "bg-orange-500",
    colBg: "bg-orange-500/[0.02] dark:bg-orange-500/[0.01]",
    colBorder: "border-orange-500/10 dark:border-orange-500/5",
    cardBg:
      "bg-orange-500/[0.04] dark:bg-orange-950/20 hover:bg-orange-500/[0.08] border-orange-500/10 hover:border-orange-500/30",
    shadow: "hover:shadow-orange-500/[0.06] hover:shadow-md",
    textClass: "text-orange-500 dark:text-orange-400",
  },
  {
    id: "resolvida",
    label: "Resolvida",
    dotColor: "bg-emerald-500",
    colBg: "bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01]",
    colBorder: "border-emerald-500/10 dark:border-emerald-500/5",
    cardBg:
      "bg-emerald-500/[0.04] dark:bg-emerald-950/20 hover:bg-emerald-500/[0.08] border-emerald-500/10 hover:border-emerald-500/30",
    shadow: "hover:shadow-emerald-500/[0.06] hover:shadow-md",
    textClass: "text-emerald-500 dark:text-emerald-400",
  },
] as const;

function downloadCSV(convs: Conversation[]) {
  const head = [
    "Nome",
    "Telefone",
    "Instância",
    "Status",
    "Tags",
    "Última mensagem",
    "Atualizado em",
  ];
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(escape).join(",")];
  for (const c of convs) {
    lines.push(
      [
        c.contactName || c.contactPhone,
        c.contactPhone,
        c.instanceName || "",
        c.status,
        c.tags?.join("; ") || "",
        c.lastMessage || "",
        c.updatedAt ? new Date(c.updatedAt).toLocaleString("pt-BR") : "",
      ]
        .map(escape)
        .join(","),
    );
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `crm-conversas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CRM() {
  const { conversations } = useAppStore();
  const [q, setQ] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);

  // Filtra conversas que têm histórico de mensagens ativo (não vazias)
  const activeConversations = useMemo(() => {
    return conversations.filter((c) => c.lastMessage !== null && c.lastMessage !== "");
  }, [conversations]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    activeConversations.forEach((c) => c.tags?.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [activeConversations]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return activeConversations.filter((c) => {
      if (activeTags.length > 0 && !activeTags.every((t) => c.tags?.includes(t))) return false;
      if (!term) return true;
      return (
        (c.contactName || "").toLowerCase().includes(term) ||
        c.contactPhone.toLowerCase().includes(term) ||
        (c.lastMessage || "").toLowerCase().includes(term)
      );
    });
  }, [activeConversations, q, activeTags]);

  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/plain", id);
  };

  const handleDrop = async (e: React.DragEvent, newStatus: Conversation["status"]) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;

    const conv = conversations.find((c) => c.id === id);
    if (!conv) return;

    if (conv.status === newStatus) return;

    // Atualiza status e pausa/ativa bot
    const botPaused = newStatus !== "aberta";

    try {
      const { error } = await supabase
        .from("conversations")
        .update({
          status: newStatus,
          botPaused: botPaused,
        })
        .eq("id", id);

      if (error) throw error;
      toast.success(
        `Conversa de ${conv.contactName || conv.contactPhone} movida para ${
          newStatus === "em_atendimento"
            ? "Em Atendimento"
            : newStatus[0].toUpperCase() + newStatus.slice(1)
        }`,
      );
    } catch (err: any) {
      toast.error(err.message || "Erro ao mover conversa");
    }
  };

  const handleDeleteHistory = async (id: string, name: string) => {
    if (
      !confirm(
        `Tem certeza que deseja apagar permanentemente todo o histórico de mensagens local da conversa com "${name}"? Esta ação NÃO apagará as mensagens no aparelho celular do cliente.`,
      )
    ) {
      return;
    }

    try {
      const { error: errorMsgs } = await supabase
        .from("messages")
        .delete()
        .eq("conversationId", id);

      if (errorMsgs) throw errorMsgs;

      const { error: errorConv } = await supabase
        .from("conversations")
        .update({ lastMessage: null })
        .eq("id", id);

      if (errorConv) throw errorConv;

      toast.success("Histórico de mensagens limpo com sucesso!");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao limpar histórico");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Contatos (CRM)</h1>
          <p className="text-muted-foreground mt-1">
            {activeConversations.length} conversas ativas · {filtered.length} no filtro atual
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => downloadCSV(filtered)}
          disabled={filtered.length === 0}
        >
          <Download className="size-4 mr-2" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar nome, telefone ou mensagem..."
              className="pl-9"
            />
          </div>
        </div>

        {allTags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted-foreground mr-1">Tags:</span>
            {allTags.map((t) => {
              const on = activeTags.includes(t);
              return (
                <button key={t} onClick={() => toggleTag(t)}>
                  <Badge variant={on ? "default" : "outline"} className="cursor-pointer gap-1">
                    {t}
                    {on && <X className="size-3" />}
                  </Badge>
                </button>
              );
            })}
            {activeTags.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={() => setActiveTags([])}
              >
                limpar
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Quadro Kanban */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Contact className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma conversa encontrada</p>
          <p className="text-sm text-muted-foreground mt-1">
            {activeConversations.length === 0
              ? "Conecte uma instância de WhatsApp e receba mensagens para alimentar o CRM."
              : "Ajuste os filtros para ver mais conversas."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-start overflow-x-auto pb-4">
          {columns.map((col) => {
            const colCards = filtered.filter(
              (c) => c.status === col.id || (col.id === "aberta" && !c.status),
            );
            const isOver = dragOverCol === col.id;
            return (
              <div
                key={col.id}
                onDragOver={(e) => e.preventDefault()}
                onDragEnter={() => setDragOverCol(col.id)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={(e) => {
                  setDragOverCol(null);
                  handleDrop(e, col.id);
                }}
                className={`rounded-2xl border flex flex-col p-4 min-h-[600px] transition-all duration-300 shadow-sm ${col.colBg} ${col.colBorder} ${
                  isOver ? "border-primary bg-primary/5 ring-2 ring-primary/35 scale-[1.01]" : ""
                }`}
              >
                {/* Cabeçalho da Coluna */}
                <div className="flex items-center justify-between mb-4 pb-2 border-b border-border/20">
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${col.dotColor} animate-pulse`} />
                    <span className={`font-bold text-sm tracking-wide ${col.textClass}`}>
                      {col.label}
                    </span>
                  </div>
                  <Badge
                    variant="secondary"
                    className="text-xs bg-secondary/55 font-semibold px-2 py-0.5 rounded-full"
                  >
                    {colCards.length}
                  </Badge>
                </div>

                {/* Lista de Cartões */}
                <div className="flex-1 flex flex-col gap-3">
                  {colCards.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, c.id)}
                      className={`group relative border rounded-xl p-3.5 shadow-sm transition-all duration-300 hover:-translate-y-1 cursor-grab active:cursor-grabbing backdrop-blur-[2px] ${col.cardBg} ${col.shadow}`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <h4
                          className="font-semibold text-sm truncate max-w-[150px]"
                          title={c.contactName || c.contactPhone}
                        >
                          {c.contactName || c.contactPhone}
                        </h4>
                        {c.instanceName && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1 py-0 truncate shrink-0 max-w-[80px]"
                          >
                            {c.instanceName}
                          </Badge>
                        )}
                      </div>

                      <div className="font-mono text-[11px] text-muted-foreground mb-2">
                        {c.contactPhone}
                      </div>

                      {c.profileNotes ? (
                        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem] mb-2 p-1.5 rounded border border-border/10 bg-secondary/15 italic">
                          📝 {c.profileNotes}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/90 line-clamp-2 min-h-[2rem] mb-2 whitespace-pre-wrap break-words">
                          {c.lastMessage}
                        </p>
                      )}

                      {c.leadScore && (
                        <div
                          className="flex items-center gap-0.5 text-amber-500 mb-3"
                          title={`Lead Score: ${c.leadScore}/5`}
                        >
                          {[1, 2, 3, 4, 5].map((star) => (
                            <span
                              key={star}
                              className={
                                star <= (c.leadScore || 0)
                                  ? "opacity-100"
                                  : "opacity-25 text-muted-foreground"
                              }
                            >
                              ★
                            </span>
                          ))}
                        </div>
                      )}

                      {c.tags && c.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {c.tags.slice(0, 3).map((t) => (
                            <Badge key={t} variant="secondary" className="text-[9px] px-1 py-0">
                              {t}
                            </Badge>
                          ))}
                          {c.tags.length > 3 && (
                            <span className="text-[9px] text-muted-foreground self-center">
                              +{c.tags.length - 3}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2.5 border-t border-border/20 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="size-3" />
                          {c.updatedAt ? new Date(c.updatedAt).toLocaleDateString("pt-BR") : "—"}
                        </span>

                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link to="/app/inbox" search={{ id: c.id }}>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="size-7 rounded-md"
                              title="Abrir no Inbox"
                            >
                              <MessageCircle className="size-3.5" />
                            </Button>
                          </Link>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-7 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            title="Limpar Histórico"
                            onClick={() =>
                              handleDeleteHistory(c.id, c.contactName || c.contactPhone)
                            }
                          >
                            <Trash2 className="size-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}

                  {colCards.length === 0 && (
                    <div className="flex-1 border-2 border-dashed border-border/10 rounded-xl flex items-center justify-center p-8 text-center text-xs text-muted-foreground/40">
                      Arraste conversas para cá
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
