import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useAppStore, type Conversation } from "@/lib/app-store";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Contact, Download, MessageCircle, Search, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/crm")({
  head: () => ({ meta: [{ title: "Contatos (CRM) — AgentHub AI" }] }),
  component: CRM,
});

interface ContactRow {
  phone: string;
  name: string;
  conversations: number;
  lastMessage: string;
  lastAt: string;
  tags: string[];
  status: Conversation["status"];
  instanceName?: string;
  convId: string;
}

function aggregate(convs: Conversation[]): ContactRow[] {
  const map = new Map<string, ContactRow>();
  for (const c of convs) {
    if (!c.contactPhone) continue;
    const cur = map.get(c.contactPhone);
    if (!cur) {
      map.set(c.contactPhone, {
        phone: c.contactPhone,
        name: c.contactName || c.contactPhone,
        conversations: 1,
        lastMessage: c.lastMessage ?? "",
        lastAt: c.updatedAt ?? "",
        tags: [...(c.tags ?? [])],
        status: c.status,
        instanceName: c.instanceName,
        convId: c.id,
      });
    } else {
      cur.conversations += 1;
      cur.tags = Array.from(new Set([...cur.tags, ...(c.tags ?? [])]));
      if ((c.updatedAt ?? "") > cur.lastAt) {
        cur.lastAt = c.updatedAt ?? cur.lastAt;
        cur.lastMessage = c.lastMessage ?? cur.lastMessage;
        cur.status = c.status;
        cur.name = c.contactName || cur.name;
        cur.instanceName = c.instanceName ?? cur.instanceName;
        cur.convId = c.id;
      }
    }
  }
  return [...map.values()].sort((a, b) => (b.lastAt || "").localeCompare(a.lastAt || ""));
}

function downloadCSV(rows: ContactRow[]) {
  const head = ["Nome", "Telefone", "Conversas", "Status", "Tags", "Última mensagem", "Atualizado em"];
  const escape = (v: string) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const lines = [head.map(escape).join(",")];
  for (const r of rows) {
    lines.push([r.name, r.phone, String(r.conversations), r.status, r.tags.join("; "), r.lastMessage, r.lastAt].map(escape).join(","));
  }
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `contatos-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CRM() {
  const { conversations } = useAppStore();
  const [q, setQ] = useState("");
  const [activeTags, setActiveTags] = useState<string[]>([]);
  const [status, setStatus] = useState<"all" | Conversation["status"]>("all");

  const contacts = useMemo(() => aggregate(conversations), [conversations]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    contacts.forEach((c) => c.tags.forEach((t) => set.add(t)));
    return [...set].sort();
  }, [contacts]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    return contacts.filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (activeTags.length > 0 && !activeTags.every((t) => c.tags.includes(t))) return false;
      if (!term) return true;
      return (
        c.name.toLowerCase().includes(term) ||
        c.phone.toLowerCase().includes(term) ||
        c.lastMessage.toLowerCase().includes(term)
      );
    });
  }, [contacts, q, activeTags, status]);

  const toggleTag = (t: string) =>
    setActiveTags((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]));

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Contatos (CRM)</h1>
          <p className="text-muted-foreground mt-1">{contacts.length} contatos únicos · {filtered.length} no filtro atual</p>
        </div>
        <Button variant="outline" onClick={() => downloadCSV(filtered)} disabled={filtered.length === 0}>
          <Download className="size-4" /> Exportar CSV
        </Button>
      </div>

      {/* Filtros */}
      <div className="rounded-2xl border border-border bg-card/30 p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-64">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar nome, telefone ou mensagem..." className="pl-9" />
          </div>
          <div className="flex items-center gap-1">
            {(["all", "aberta", "handoff", "resolvida"] as const).map((s) => (
              <Button key={s} size="sm" variant={status === s ? "default" : "outline"} onClick={() => setStatus(s)}>
                {s === "all" ? "Todos" : s[0].toUpperCase() + s.slice(1)}
              </Button>
            ))}
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
                    {t}{on && <X className="size-3" />}
                  </Badge>
                </button>
              );
            })}
            {activeTags.length > 0 && (
              <Button size="sm" variant="ghost" className="h-6 text-xs" onClick={() => setActiveTags([])}>limpar</Button>
            )}
          </div>
        )}
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Contact className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum contato encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {contacts.length === 0
              ? "Conecte uma instância de WhatsApp e receba mensagens para alimentar o CRM."
              : "Ajuste os filtros para ver mais contatos."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-border bg-card/30 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contato</TableHead>
                <TableHead>Telefone</TableHead>
                <TableHead>Conversas</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Tags</TableHead>
                <TableHead>Última atualização</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.phone}>
                  <TableCell>
                    <div className="font-medium">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate max-w-xs">{c.lastMessage}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{c.phone}</TableCell>
                  <TableCell>{c.conversations}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "resolvida" ? "secondary" : c.status === "handoff" ? "outline" : "default"}>
                      {c.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 max-w-xs">
                      {c.tags.slice(0, 4).map((t) => <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>)}
                      {c.tags.length > 4 && <span className="text-xs text-muted-foreground">+{c.tags.length - 4}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {c.lastAt ? new Date(c.lastAt).toLocaleString("pt-BR") : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Link to="/app/inbox">
                      <Button size="sm" variant="ghost" onClick={() => toast.info(`Abra a conversa "${c.name}" no Inbox`)}>
                        <MessageCircle className="size-3.5" /> Abrir
                      </Button>
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
