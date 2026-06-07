import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { db } from "@/integrations/firebase/client";
import { collection, doc, onSnapshot, orderBy, query, updateDoc, limit, arrayUnion, arrayRemove } from "firebase/firestore";
import { sendText } from "@/lib/evolution.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { MessagesSquare, Send, Loader2, Bot, BotOff, X, Plus, CheckCircle2, MessageSquareText } from "lucide-react";
import { toast } from "sonner";
import type { Template } from "@/routes/app.templates";

export const Route = createFileRoute("/app/inbox")({ component: Inbox });

interface Conv {
  id: string;
  instanceName?: string;
  contactName: string;
  contactPhone: string;
  remoteJid?: string;
  lastMessage: string;
  updatedAt: string;
  unread?: number;
  status?: "aberta" | "resolvida" | "handoff" | string;
  botPaused?: boolean;
  tags?: string[];
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

  const [convs, setConvs] = useState<Conv[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);

  const convRef = (id: string) => doc(db, "tenants", tenant!.id, "conversations", id);

  const toggleBot = async (paused: boolean) => {
    if (!tenant || !activeId) return;
    await updateDoc(convRef(activeId), {
      botPaused: paused,
      status: paused ? "handoff" : "aberta",
    }).catch((e) => toast.error(e?.message ?? "Falha ao atualizar"));
  };

  const setStatus = async (status: "aberta" | "resolvida") => {
    if (!tenant || !activeId) return;
    await updateDoc(convRef(activeId), { status }).catch((e) => toast.error(e?.message));
  };

  const addTag = async () => {
    const t = tagInput.trim();
    if (!t || !tenant || !activeId) return;
    await updateDoc(convRef(activeId), { tags: arrayUnion(t) }).catch((e) => toast.error(e?.message));
    setTagInput("");
  };

  const removeTag = async (t: string) => {
    if (!tenant || !activeId) return;
    await updateDoc(convRef(activeId), { tags: arrayRemove(t) }).catch((e) => toast.error(e?.message));
  };

  useEffect(() => {
    if (!tenant) return;
    const q = query(collection(db, "tenants", tenant.id, "conversations"), orderBy("updatedAt", "desc"), limit(100));
    return onSnapshot(q, (s) => {
      setConvs(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Conv[]);
    }, (e) => console.error("[inbox] convs:", e));
  }, [tenant]);

  // Subscribe messages of active conversation
  useEffect(() => {
    if (!tenant || !activeId) { setMessages([]); return; }
    const q = query(collection(db, "tenants", tenant.id, "conversations", activeId, "messages"), orderBy("createdAt", "asc"), limit(500));
    return onSnapshot(q, (s) => {
      setMessages(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Msg[]);
      // Zera unread
      updateDoc(doc(db, "tenants", tenant.id, "conversations", activeId), { unread: 0 }).catch(() => {});
    });
  }, [tenant, activeId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages.length]);

  const active = useMemo(() => convs.find((c) => c.id === activeId) ?? null, [convs, activeId]);

  const handleSend = async () => {
    if (!draft.trim() || !active?.instanceName || !active.remoteJid) return;
    setSending(true);
    try {
      const number = active.remoteJid.split("@")[0];
      await sendFn({ data: { instanceName: active.instanceName, number, text: draft.trim() } });
      setDraft("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar");
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Inbox</h1>
        <p className="text-muted-foreground mt-1">Central de conversas em tempo real.</p>
      </div>

      {convs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <MessagesSquare className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhuma conversa ainda</p>
          <p className="text-sm text-muted-foreground mt-1">Conecte uma instância em WhatsApp e envie uma mensagem para começar.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-[320px_1fr] gap-4 h-[calc(100vh-220px)]">
          {/* Lista */}
          <div className="rounded-2xl border border-border bg-card/30 overflow-y-auto">
            <ul className="divide-y divide-border">
              {convs.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setActiveId(c.id)}
                    className={`w-full text-left p-3 hover:bg-secondary/40 transition ${activeId === c.id ? "bg-secondary/60" : ""}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium text-sm truncate">{c.contactName}</p>
                      <div className="flex items-center gap-1 shrink-0">
                        {c.botPaused && <BotOff className="size-3 text-muted-foreground" />}
                        {c.unread ? <Badge className="bg-primary text-primary-foreground">{c.unread}</Badge> : null}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.lastMessage}</p>
                    {(c.tags?.length ?? 0) > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {c.tags!.slice(0, 3).map((t) => <Badge key={t} variant="outline" className="text-[9px] px-1 py-0">{t}</Badge>)}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">{new Date(c.updatedAt).toLocaleString()}</p>
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Painel */}
          <div className="rounded-2xl border border-border bg-card/30 flex flex-col overflow-hidden">
            {!active ? (
              <div className="flex-1 grid place-items-center text-sm text-muted-foreground">Selecione uma conversa</div>
            ) : (
              <>
                <div className="border-b border-border px-4 py-3 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm truncate">{active.contactName}</p>
                      {active.status === "resolvida" && <Badge variant="secondary" className="gap-1"><CheckCircle2 className="size-3" />Resolvida</Badge>}
                      {active.status === "handoff" && <Badge variant="outline">Handoff humano</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{active.contactPhone} · {active.instanceName}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 text-xs select-none cursor-pointer">
                      {active.botPaused ? <BotOff className="size-4 text-muted-foreground" /> : <Bot className="size-4 text-primary" />}
                      <span>{active.botPaused ? "IA pausada" : "IA ativa"}</span>
                      <Switch checked={!active.botPaused} onCheckedChange={(v) => toggleBot(!v)} />
                    </label>
                    {active.status !== "resolvida" ? (
                      <Button size="sm" variant="outline" onClick={() => setStatus("resolvida")}>Resolver</Button>
                    ) : (
                      <Button size="sm" variant="outline" onClick={() => setStatus("aberta")}>Reabrir</Button>
                    )}
                  </div>
                </div>

                {/* Tags */}
                <div className="border-b border-border px-4 py-2 flex items-center gap-2 flex-wrap">
                  {(active.tags ?? []).map((t) => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-1">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-destructive ml-1"><X className="size-3" /></button>
                    </Badge>
                  ))}
                  <div className="flex items-center gap-1">
                    <Input
                      value={tagInput}
                      onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Adicionar tag"
                      className="h-7 w-32 text-xs"
                    />
                    <Button size="icon" variant="ghost" className="size-7" onClick={addTag}><Plus className="size-3" /></Button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {messages.map((m) => (
                    <div key={m.id} className={`flex ${m.fromMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${m.fromMe ? "bg-primary text-primary-foreground" : "bg-secondary"}`}>
                        <p className="whitespace-pre-wrap break-words">{m.text}</p>
                        <p className="text-[10px] opacity-70 mt-1">{new Date(m.createdAt).toLocaleTimeString()}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={bottomRef} />
                </div>
                <div className="border-t border-border p-3 flex gap-2">
                  <Input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="Digite uma mensagem..."
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    disabled={sending}
                  />
                  <Button onClick={handleSend} disabled={sending || !draft.trim()}>
                    {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
