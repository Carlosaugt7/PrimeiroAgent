import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { sendText } from "@/lib/evolution.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  MessagesSquare,
  Send,
  Loader2,
  Bot,
  BotOff,
  X,
  Plus,
  CheckCircle2,
  MessageSquareText,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import type { Template } from "@/routes/app.templates";

export const Route = createFileRoute("/app/inbox")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      id: (search.id as string) || undefined,
    };
  },
  component: Inbox,
});

interface Conv {
  id: string;
  instanceName?: string;
  contactName: string;
  contactPhone: string;
  remoteJid?: string;
  lastMessage: string;
  updatedAt: string;
  unread?: number;
  status?: "aberta" | "em_atendimento" | "resolvida" | "handoff";
  botPaused?: boolean;
  tags?: string[];
  isFrustrated?: boolean | null;
}
interface Msg {
  id: string;
  text: string;
  fromMe: boolean;
  createdAt: string;
}

function Inbox() {
  const { tenant } = useAuth();
  const sendFn = useServerFn(sendText);
  const search = Route.useSearch();

  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (search.id) {
      setActiveId(search.id);
    }
  }, [search.id]);

  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [templates, setTemplates] = useState<Template[]>([]);
  const [tplOpen, setTplOpen] = useState(false);
  const [tplIdx, setTplIdx] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Templates do tenant
  useEffect(() => {
    if (!tenant) return;

    const fetchTemplates = async () => {
      const { data } = await supabase
        .from("templates")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("shortcut", { ascending: true });
      if (data) setTemplates(data as Template[]);
    };
    fetchTemplates();

    const channel = supabase
      .channel("public:templates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "templates", filter: `tenantId=eq.${tenant.id}` },
        fetchTemplates,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  // Filtra templates pelo termo após "/"
  const tplQuery = draft.startsWith("/") ? draft.slice(1).toLowerCase() : "";
  const tplMatches = draft.startsWith("/")
    ? templates
        .filter((t) => t.shortcut.includes(tplQuery) || t.title.toLowerCase().includes(tplQuery))
        .slice(0, 6)
    : [];

  const applyTemplate = (t: Template) => {
    setDraft(t.body);
    setTplOpen(false);
    setTplIdx(0);
  };

  const toggleBot = async (paused: boolean) => {
    if (!tenant || !activeId) return;
    const { error } = await supabase
      .from("conversations")
      .update({
        botPaused: paused,
        status: paused ? "handoff" : "aberta",
      })
      .eq("id", activeId);
    if (error) toast.error(error.message);
  };

  const setStatus = async (status: "aberta" | "resolvida") => {
    if (!tenant || !activeId) return;
    const { error } = await supabase.from("conversations").update({ status }).eq("id", activeId);
    if (error) toast.error(error.message);
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || !tenant || !activeId) return;

    const c = convs.find((x) => x.id === activeId);
    if (!c) return;

    const newTags = Array.from(new Set([...(c.tags || []), t]));
    const { error } = await supabase
      .from("conversations")
      .update({ tags: newTags })
      .eq("id", activeId);
    if (error) toast.error(error.message);
    else setTagInput("");
  };

  const removeTag = async (t: string) => {
    if (!tenant || !activeId) return;
    const c = convs.find((x) => x.id === activeId);
    if (!c) return;

    const newTags = (c.tags || []).filter((x) => x !== t);
    const { error } = await supabase
      .from("conversations")
      .update({ tags: newTags })
      .eq("id", activeId);
    if (error) toast.error(error.message);
  };

  const clearHistory = async () => {
    if (!tenant || !activeId) return;
    if (
      !confirm(
        "Tem certeza que deseja apagar definitivamente todo o histórico de mensagens local desta conversa? Esta ação NÃO apagará as mensagens no aparelho celular do cliente.",
      )
    ) {
      return;
    }

    try {
      const { error: errorMsgs } = await supabase
        .from("messages")
        .delete()
        .eq("conversationId", activeId);

      if (errorMsgs) throw errorMsgs;

      const { error: errorConv } = await supabase
        .from("conversations")
        .update({ lastMessage: null })
        .eq("id", activeId);

      if (errorConv) throw errorConv;

      toast.success("Histórico de mensagens limpo com sucesso!");
      setActiveId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao limpar histórico");
    }
  };

  const clearAllHistory = async () => {
    if (!tenant?.id) return;
    if (
      !confirm(
        "ATENÇÃO: Tem certeza que deseja apagar permanentemente todo o histórico de mensagens local de TODAS as conversas? Esta ação NÃO apagará as mensagens nos aparelhos celulares dos clientes.",
      )
    ) {
      return;
    }

    try {
      const { error: errorMsgs } = await supabase
        .from("messages")
        .delete()
        .eq("tenantId", tenant.id);

      if (errorMsgs) throw errorMsgs;

      const { error: errorConv } = await supabase
        .from("conversations")
        .update({ lastMessage: null })
        .eq("tenantId", tenant.id);

      if (errorConv) throw errorConv;

      toast.success("Histórico de todas as conversas limpo com sucesso!");
      setActiveId(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao limpar conversas");
    }
  };

  useEffect(() => {
    if (!tenant) return;

    const fetchConvs = async () => {
      const { data } = await supabase
        .from("conversations")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("updatedAt", { ascending: false })
        .limit(100);
      if (data) setConvs(data as Conv[]);
    };
    fetchConvs();

    const channel = supabase
      .channel("public:conversations")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "conversations",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchConvs,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  // Subscribe messages of active conversation
  useEffect(() => {
    if (!tenant || !activeId) {
      setMessages([]);
      return;
    }

    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("tenantId", tenant.id)
        .eq("conversationId", activeId)
        .order("createdAt", { ascending: true })
        .limit(500);
      if (data) setMessages(data as Msg[]);

      // Zera unread
      await supabase.from("conversations").update({ unread: 0 }).eq("id", activeId);
    };
    fetchMessages();

    const channel = supabase
      .channel("public:messages")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversationId=eq.${activeId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          const newMsg = payload.new as unknown as Msg;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "messages",
          filter: `conversationId=eq.${activeId}`,
        },
        () => {
          fetchMessages();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant, activeId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  const active = useMemo(() => convs.find((c) => c.id === activeId) ?? null, [convs, activeId]);

  const visibleConvs = useMemo(() => {
    return convs.filter((c) => c.lastMessage && c.lastMessage.trim() !== "");
  }, [convs]);

  const handleSend = async () => {
    if (!draft.trim() || !active?.instanceName || !active.remoteJid || !tenant?.id) return;
    setSending(true);
    try {
      const number = active.remoteJid.split("@")[0];
      await sendFn({
        data: {
          tenantId: tenant.id,
          instanceName: active.instanceName,
          number,
          text: draft.trim(),
        },
      });
      setDraft("");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao enviar");
    } finally {
      setSending(false);
    }
  };

  const handleDraftKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (tplOpen && tplMatches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setTplIdx((i) => (i + 1) % tplMatches.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setTplIdx((i) => (i - 1 + tplMatches.length) % tplMatches.length);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setTplOpen(false);
        return;
      }
      if (e.key === "Tab" || (e.key === "Enter" && !e.shiftKey)) {
        e.preventDefault();
        applyTemplate(tplMatches[tplIdx]);
        return;
      }
    }
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Inbox</h1>
          <p className="text-muted-foreground mt-1">Central de conversas em tempo real.</p>
        </div>
        {convs.length > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
            onClick={clearAllHistory}
          >
            <Trash2 className="size-4 mr-2" /> Limpar Todas
          </Button>
        )}
      </div>

      {convs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <MessagesSquare className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma conversa ainda</p>
          <p className="text-sm text-muted-foreground mt-1">
            Conecte uma instância em WhatsApp e envie uma mensagem para começar.
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
          {/* Lista */}
          <div className="rounded-2xl border border-border bg-card/30 overflow-y-auto">
            <ul className="divide-y divide-border">
              {visibleConvs.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-3 hover:bg-secondary/40 transition ${activeId === c.id ? "bg-secondary/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate flex items-center gap-1.5">
                        {c.contactName}
                        {c.isFrustrated && (
                          <span
                            className="text-[10px] text-red-500 font-bold bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5 animate-pulse"
                            title="Cliente irritado ou frustrado!"
                          >
                            ⚠️ Frustrado
                          </span>
                        )}
                        {c.leadScore && (
                          <span
                            className="text-[10px] text-amber-500 font-bold bg-amber-500/10 px-1 py-0.5 rounded shrink-0 flex items-center gap-0.5"
                            title={`Lead Score: ${c.leadScore}/5`}
                          >
                            ★ {c.leadScore}
                          </span>
                        )}
                      </p>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.botPaused && <BotOff className="size-3 text-muted-foreground" />}
                        {c.unread ? (
                          <Badge className="bg-primary text-primary-foreground">{c.unread}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                    {(c.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.tags!.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">
                            {t}
                          </Badge>
                        ))}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {new Date(c.updatedAt).toLocaleString()}
                    </p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Painel */}
          <div className="rounded-2xl border border-border bg-card/30 grid grid-cols-1 lg:grid-cols-[1fr_260px] overflow-hidden">
            {active ? (
              <>
                <div className="flex flex-col border-r border-border h-full overflow-hidden">
                  <div className="border-b border-border px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{active.contactName}</p>
                        {active.status === "resolvida" && (
                          <Badge variant="secondary" className="gap-1">
                            <CheckCircle2 className="size-3" />
                            Resolvida
                          </Badge>
                        )}
                        {active.status === "handoff" && (
                          <Badge variant="outline">Handoff humano</Badge>
                        )}
                        {active.status === "em_atendimento" && (
                          <Badge
                            variant="outline"
                            className="bg-amber-500/10 text-amber-500 border-amber-500/20"
                          >
                            Em Atendimento
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {active.contactPhone} · {active.instanceName}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                        {active.botPaused ? (
                          <BotOff className="size-4 text-muted-foreground" />
                        ) : (
                          <Bot className="size-4 text-primary" />
                        )}
                        <span>{active.botPaused ? "IA pausada" : "IA ativa"}</span>
                        <Switch
                          checked={!active.botPaused}
                          onCheckedChange={(v) => toggleBot(!v)}
                        />
                      </label>
                      {active.status === "resolvida" ? (
                        <Button size="sm" variant="outline" onClick={() => setStatus("aberta")}>
                          Reabrir
                        </Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setStatus("resolvida")}>
                          Resolver
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        onClick={clearHistory}
                      >
                        <Trash2 className="size-4 mr-1" />
                        Limpar
                      </Button>
                    </div>
                  </div>

                  {/* Tags */}
                  <div className="border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap">
                    {(active.tags ?? []).map((t) => (
                      <Badge key={t} variant="secondary" className="gap-1 pr-1">
                        {t}
                        <button
                          onClick={() => removeTag(t)}
                          className="hover:text-destructive ml-1"
                        >
                          <X className="size-3" />
                        </button>
                      </Badge>
                    ))}
                    <div className="flex items-center gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addTag();
                          }
                        }}
                        placeholder="Adicionar tag"
                        className="h-7 w-32 text-xs"
                      />
                      <Button size="icon" variant="ghost" className="size-7" onClick={addTag}>
                        <Plus className="size-3" />
                      </Button>
                    </div>
                  </div>

                  {/* Mensagens */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {messages.map((m) => (
                      <div
                        key={m.id}
                        className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}
                      >
                        <div
                          className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.fromMe ? "bg-primary text-primary-foreground" : "bg-secondary"}`}
                        >
                          <p className="whitespace-pre-wrap break-words">{m.text}</p>
                          <p className="text-[10px] opacity-70 mt-1">
                            {new Date(m.createdAt).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ))}
                    <div ref={bottomRef} />
                  </div>

                  {/* Digitação */}
                  <div className="border-t border-border p-3 relative">
                    {tplOpen && tplMatches.length > 0 && (
                      <div className="absolute bottom-full left-3 right-3 mb-2 rounded-xl border border-border bg-popover shadow-lg overflow-hidden z-10">
                        <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border flex items-center gap-1.5">
                          <MessageSquareText className="size-3" /> Templates · ↑↓ navegar · Enter
                          aplicar · Esc fechar
                        </div>
                        <ul>
                          {tplMatches.map((t, i) => (
                            <li key={t.id}>
                              <button
                                onMouseEnter={() => setTplIdx(i)}
                                onClick={() => applyTemplate(t)}
                                className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 ${i === tplIdx ? "bg-secondary" : "hover:bg-secondary/60"}`}
                              >
                                <Badge variant="outline" className="font-mono shrink-0">
                                  /{t.shortcut}
                                </Badge>
                                <span className="font-medium truncate">{t.title}</span>
                                <span className="text-xs text-muted-foreground truncate">
                                  — {t.body}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Input
                        value={draft}
                        onChange={(e) => {
                          const v = e.target.value;
                          setDraft(v);
                          setTplOpen(v.startsWith("/"));
                          setTplIdx(0);
                        }}
                        placeholder="Digite uma mensagem ou /atalho para templates..."
                        onKeyDown={handleDraftKeyDown}
                        disabled={sending}
                      />
                      <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                        {sending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Send className="size-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Coluna Direita: Perfil do Cliente */}
                <div className="hidden lg:flex flex-col bg-secondary/5 p-4 space-y-4 overflow-y-auto h-full">
                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Perfil do Cliente
                    </h4>
                    <div className="mt-2 p-3 rounded-lg border border-border bg-secondary/20 text-xs text-foreground space-y-2 leading-relaxed whitespace-pre-wrap">
                      {active.profileNotes ? (
                        active.profileNotes
                      ) : (
                        <p className="text-muted-foreground italic">
                          Nenhum perfil gerado ainda. O bot criará um resumo após interações.
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      Classificação (Score)
                    </h4>
                    <div className="mt-2 flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <span
                          key={star}
                          className={`text-lg transition-colors ${
                            star <= (active.leadScore || 0)
                              ? "text-amber-500"
                              : "text-muted-foreground opacity-30"
                          }`}
                        >
                          ★
                        </span>
                      ))}
                      <span className="text-xs text-muted-foreground ml-2">
                        {active.leadScore ? `${active.leadScore}/5` : "Sem nota"}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="col-span-full flex-1 grid place-items-center text-sm text-muted-foreground">
                Selecione uma conversa
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
