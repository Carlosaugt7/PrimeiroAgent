import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/app-store";
import { db } from "@/integrations/firebase/client";
import {
  collection, doc, onSnapshot, setDoc, deleteDoc, getDocs, writeBatch, serverTimestamp,
} from "firebase/firestore";
import { embedTexts } from "@/lib/llm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Database, Upload, Loader2, Trash2, FileText } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/knowledge")({ component: Page });

interface KnowDoc {
  id: string;
  name: string;
  source: "texto" | "txt" | "md";
  chunks: number;
  embedModel: string;
  embedProviderId: string;
  vectorDim: number;
  status: "processando" | "indexado" | "erro";
  createdAt: string;
}

// Divide texto em chunks de ~chunkSize chars com overlap
function chunkText(text: string, chunkSize = 800, overlap = 120): string[] {
  const clean = text.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
  if (clean.length <= chunkSize) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + chunkSize, clean.length);
    // tenta quebrar em fim de parágrafo/sentença
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const cut = Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("! "), slice.lastIndexOf("? "));
      if (cut > chunkSize * 0.5) end = i + cut + 1;
    }
    out.push(clean.slice(i, end).trim());
    i = end - overlap;
    if (i <= 0) break;
  }
  return out.filter(Boolean);
}

function Page() {
  const { tenant } = useAuth();
  const { providers } = useAppStore();
  const embed = useServerFn(embedTexts);

  const [docs, setDocs] = useState<KnowDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [providerId, setProviderId] = useState("");
  const [embedModel, setEmbedModel] = useState("text-embedding-3-small");
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState("");

  // Apenas provedores OpenAI-compatíveis suportam /embeddings facilmente
  const embedProviders = providers.filter((p) =>
    ["openai", "openrouter", "deepseek", "groq", "custom"].includes(p.kind),
  );

  useEffect(() => {
    if (!tenant) return;
    return onSnapshot(collection(db, "tenants", tenant.id, "knowledge"), (s) => {
      setDocs(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as KnowDoc[]);
    });
  }, [tenant]);

  const onPickFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) { toast.error("Máx 5 MB (use TXT/MD por enquanto)"); return; }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md"].includes(ext ?? "")) { toast.error("Apenas .txt e .md no MVP"); return; }
    setText(await file.text());
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const ingest = async () => {
    if (!tenant) return;
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) { toast.error("Selecione um provedor de embeddings"); return; }
    if (!name.trim() || !text.trim()) { toast.error("Nome e conteúdo obrigatórios"); return; }

    setIngesting(true);
    const docId = crypto.randomUUID();
    try {
      const chunks = chunkText(text);
      setProgress(`Gerando embeddings (${chunks.length} chunks)...`);

      // Lote de 64 chunks por chamada para evitar payload grande
      const vectors: number[][] = [];
      const BATCH = 64;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const r = await embed({
          data: { baseUrl: provider.baseUrl, apiKey: provider.apiKey, model: embedModel, texts: slice },
        });
        vectors.push(...r.vectors);
        setProgress(`Embeddings: ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
      }
      const dim = vectors[0]?.length ?? 0;

      // Grava doc + chunks em batch
      setProgress("Salvando no banco...");
      const docRef = doc(db, "tenants", tenant.id, "knowledge", docId);
      await setDoc(docRef, {
        id: docId,
        name: name.trim(),
        source: "texto",
        chunks: chunks.length,
        embedModel,
        embedProviderId: providerId,
        vectorDim: dim,
        status: "indexado",
        createdAt: new Date().toISOString(),
        _ts: serverTimestamp(),
      });

      // Firestore batch limit = 500
      for (let i = 0; i < chunks.length; i += 400) {
        const batch = writeBatch(db);
        const slice = chunks.slice(i, i + 400);
        slice.forEach((c, j) => {
          const cid = String(i + j).padStart(5, "0");
          batch.set(doc(db, "tenants", tenant.id, "knowledge", docId, "chunks", cid), {
            id: cid, text: c, embedding: vectors[i + j], order: i + j,
          });
        });
        await batch.commit();
      }

      toast.success(`"${name}" indexado (${chunks.length} chunks)`);
      setOpen(false); setName(""); setText(""); setProgress("");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha na ingestão");
    } finally { setIngesting(false); }
  };

  const remove = async (d: KnowDoc) => {
    if (!tenant || !confirm(`Excluir "${d.name}" e seus ${d.chunks} chunks?`)) return;
    try {
      const chunksSnap = await getDocs(collection(db, "tenants", tenant.id, "knowledge", d.id, "chunks"));
      for (let i = 0; i < chunksSnap.docs.length; i += 400) {
        const batch = writeBatch(db);
        chunksSnap.docs.slice(i, i + 400).forEach((c) => batch.delete(c.ref));
        await batch.commit();
      }
      await deleteDoc(doc(db, "tenants", tenant.id, "knowledge", d.id));
      toast.success("Excluído");
    } catch (e: any) { toast.error(e?.message ?? "Falha ao excluir"); }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Base de conhecimento</h1>
          <p className="text-muted-foreground mt-1">Indexação vetorial (RAG) para enriquecer as respostas dos agentes.</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" disabled={embedProviders.length === 0}>
              <Upload className="size-4" /> Adicionar documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Adicionar documento à base</DialogTitle></DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: FAQ Produto X" />
                </div>
                <div className="space-y-1.5">
                  <Label>Provedor (embeddings)</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                    <SelectContent>
                      {embedProviders.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} · {p.kind}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Modelo de embedding</Label>
                <Input value={embedModel} onChange={(e) => setEmbedModel(e.target.value)} placeholder="text-embedding-3-small" />
                <p className="text-xs text-muted-foreground">OpenAI: text-embedding-3-small (1536) ou text-embedding-3-large (3072).</p>
              </div>
              <div className="space-y-1.5">
                <Label>Arquivo (.txt / .md) ou cole o texto</Label>
                <input type="file" accept=".txt,.md" onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
                  className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground" />
                <Textarea value={text} onChange={(e) => setText(e.target.value)} rows={10}
                  placeholder="Cole aqui FAQ, política, manual, transcrição..." className="font-mono text-xs" />
                <p className="text-[10px] text-muted-foreground">{text.length.toLocaleString()} chars · ~{Math.max(1, Math.ceil(text.length / 800))} chunks</p>
              </div>
              {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
              <Button variant="hero" className="w-full" onClick={ingest} disabled={ingesting}>
                {ingesting ? <><Loader2 className="size-4 animate-spin" /> Processando...</> : "Indexar"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {embedProviders.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Configure um provedor OpenAI-compatível em <strong>LLM Providers</strong> para habilitar embeddings.
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Database className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum documento indexado</p>
          <p className="text-sm text-muted-foreground mt-1">Adicione FAQs, manuais ou políticas para o agente consultar antes de responder.</p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {docs.map((d) => (
            <li key={d.id} className="rounded-2xl border border-border bg-gradient-card p-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate flex items-center gap-2"><FileText className="size-4" />{d.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{d.chunks} chunks · dim {d.vectorDim} · {d.embedModel}</p>
                <Badge variant="outline" className="mt-2 text-[10px]">{d.status}</Badge>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(d)}><Trash2 className="size-4 text-destructive" /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
