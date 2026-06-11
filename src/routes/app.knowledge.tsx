import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/auth";
import { useAppStore } from "@/lib/app-store";
import { supabase } from "@/integrations/supabase/client";
import { embedTexts, fetchWebpageText } from "@/lib/llm.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Database, Upload, Loader2, Trash2, FileText, Globe } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/knowledge")({ component: Page });

interface KnowDoc {
  id: string;
  name: string;
  source?: "texto" | "txt" | "md";
  chunks?: number;
  embedModel: string;
  embedProviderId: string;
  vectorDim?: number;
  status?: "processando" | "indexado" | "erro";
  createdAt: string;
}

// Divide texto em chunks de ~chunkSize chars com overlap
function chunkText(text: string, chunkSize = 800, overlap = 120): string[] {
  const clean = text
    .replace(/\r/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (clean.length <= chunkSize) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(i + chunkSize, clean.length);
    // tenta quebrar em fim de parágrafo/sentença
    if (end < clean.length) {
      const slice = clean.slice(i, end);
      const cut = Math.max(
        slice.lastIndexOf("\n\n"),
        slice.lastIndexOf(". "),
        slice.lastIndexOf("! "),
        slice.lastIndexOf("? "),
      );
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
  const fetchWebpage = useServerFn(fetchWebpageText);

  const [docs, setDocs] = useState<KnowDoc[]>([]);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [activeTab, setActiveTab] = useState("file");
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

    const fetchKnowledge = async () => {
      const { data, error } = await supabase
        .from("knowledge")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("createdAt", { ascending: false });

      if (error) console.warn("[knowledge] docs:", error);
      else if (data) setDocs(data as KnowDoc[]);
    };

    fetchKnowledge();

    const channel = supabase
      .channel("public:knowledge")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "knowledge",
          filter: `tenantId=eq.${tenant.id}`,
        },
        fetchKnowledge,
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenant]);

  const onPickFile = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Máx 5 MB (use TXT/MD por enquanto)");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md"].includes(ext ?? "")) {
      toast.error("Apenas .txt e .md no MVP");
      return;
    }
    setText(await file.text());
    if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
  };

  const ingest = async () => {
    if (!tenant) return;
    const provider = providers.find((p) => p.id === providerId);
    if (!provider) {
      toast.error("Selecione um provedor de embeddings");
      return;
    }
    if (!name.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (activeTab === "file" && !text.trim()) {
      toast.error("Conteúdo obrigatório");
      return;
    }
    if (activeTab === "url" && !url.trim()) {
      toast.error("URL obrigatória");
      return;
    }

    setIngesting(true);
    const docId = crypto.randomUUID();
    try {
      let finalDocText = text;

      if (activeTab === "url") {
        setProgress("Buscando conteúdo da página web...");
        const res = await fetchWebpage({ data: { url: url.trim() } });
        finalDocText = res.text;
      }

      const chunks = chunkText(finalDocText);
      setProgress(`Gerando embeddings (${chunks.length} chunks)...`);

      // Lote de 64 chunks por chamada para evitar payload grande
      const vectors: number[][] = [];
      const BATCH = 64;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const r = await embed({
          data: {
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: embedModel,
            texts: slice,
          },
        });
        vectors.push(...r.vectors);
        setProgress(`Embeddings: ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
      }

      setProgress("Salvando no banco...");

      // Salva o link no campo de nome se o usuário não inseriu um nome personalizado, ou mantém o nome
      const finalDocName =
        activeTab === "url" && name.trim() === url.trim() ? url.trim() : name.trim();

      const { error: docErr } = await supabase.from("knowledge").insert({
        id: docId,
        tenantId: tenant.id,
        name: finalDocName,
        embedModel,
        embedProviderId: providerId,
        createdAt: new Date().toISOString(),
      });
      if (docErr) throw docErr;

      const chunkInserts = chunks.map((c, idx) => ({
        id: `${docId}_${String(idx).padStart(5, "0")}`,
        knowledgeId: docId,
        text: c,
        embedding: vectors[idx],
      }));

      // Ingest em lotes de 200
      for (let i = 0; i < chunkInserts.length; i += 200) {
        const slice = chunkInserts.slice(i, i + 200);
        const { error: chunkErr } = await supabase.from("knowledge_chunks").insert(slice);
        if (chunkErr) throw chunkErr;
      }

      toast.success(`"${finalDocName}" indexado (${chunks.length} chunks)`);
      setOpen(false);
      setName("");
      setText("");
      setUrl("");
      setProgress("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na ingestão";
      toast.error(msg);
    } finally {
      setIngesting(false);
    }
  };

  const remove = async (d: KnowDoc) => {
    if (!tenant || !confirm(`Excluir "${d.name}"?`)) return;
    try {
      // O delete do record principal dispara a deleção em cascata de todos os chunks no Postgres
      const { error } = await supabase.from("knowledge").delete().eq("id", d.id);
      if (error) throw error;
      toast.success("Excluído");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha ao excluir";
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display text-3xl font-bold">Base de conhecimento</h1>
          <p className="text-muted-foreground mt-1">
            Indexação vetorial (RAG) para enriquecer as respostas dos agentes.
          </p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="hero" size="sm" disabled={embedProviders.length === 0}>
              <Upload className="size-4" /> Adicionar documento
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Adicionar documento à base</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Nome</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: FAQ Produto X"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Provedor (embeddings)</Label>
                  <Select value={providerId} onValueChange={setProviderId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione..." />
                    </SelectTrigger>
                    <SelectContent>
                      {embedProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.kind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Modelo de embedding</Label>
                <Input
                  value={embedModel}
                  onChange={(e) => setEmbedModel(e.target.value)}
                  placeholder="text-embedding-3-small"
                />
                <p className="text-xs text-muted-foreground">
                  OpenAI: text-embedding-3-small (1536) ou text-embedding-3-large (3072).
                </p>
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file">Arquivo / Texto</TabsTrigger>
                  <TabsTrigger value="url">Link / URL</TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label>Arquivo (.txt / .md) ou cole o texto</Label>
                    <input
                      type="file"
                      accept=".txt,.md"
                      onChange={(e) => e.target.files?.[0] && onPickFile(e.target.files[0])}
                      className="text-xs file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-secondary file:text-foreground"
                    />
                    <Textarea
                      value={text}
                      onChange={(e) => setText(e.target.value)}
                      rows={8}
                      placeholder="Cole aqui FAQ, política, manual, transcrição..."
                      className="font-mono text-xs"
                    />
                    <p className="text-[10px] text-muted-foreground">
                      {text.length.toLocaleString()} chars · ~
                      {Math.max(1, Math.ceil(text.length / 800))} chunks
                    </p>
                  </div>
                </TabsContent>

                <TabsContent value="url" className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label>Endereço URL (Link do site)</Label>
                    <Input
                      value={url}
                      onChange={(e) => {
                        setUrl(e.target.value);
                        // Define o nome baseado na URL automaticamente caso o nome esteja vazio
                        if (!name) {
                          setName(e.target.value);
                        }
                      }}
                      placeholder="https://exemplo.com/faq"
                    />
                    <p className="text-xs text-muted-foreground">
                      O sistema fará o download da página, removerá menus e scripts, e indexará
                      apenas o conteúdo principal.
                    </p>
                  </div>
                </TabsContent>
              </Tabs>
              {progress && <p className="text-xs text-muted-foreground">{progress}</p>}
              <Button variant="hero" className="w-full" onClick={ingest} disabled={ingesting}>
                {ingesting ? (
                  <>
                    <Loader2 className="size-4 animate-spin" /> Processando...
                  </>
                ) : (
                  "Indexar"
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {embedProviders.length === 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm">
          Configure um provedor OpenAI-compatível em <strong>LLM Providers</strong> para habilitar
          embeddings.
        </div>
      )}

      {docs.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Database className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum documento indexado</p>
          <p className="text-sm text-muted-foreground mt-1">
            Adicione FAQs, manuais ou políticas para o agente consultar antes de responder.
          </p>
        </div>
      ) : (
        <ul className="grid md:grid-cols-2 gap-3">
          {docs.map((d) => (
            <li
              key={d.id}
              className="rounded-2xl border border-border bg-gradient-card p-4 flex items-start justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="font-semibold text-sm truncate flex items-center gap-2">
                  {d.name.startsWith("http://") || d.name.startsWith("https://") ? (
                    <Globe className="size-4 text-primary" />
                  ) : (
                    <FileText className="size-4 text-muted-foreground" />
                  )}
                  {d.name}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{d.embedModel}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => remove(d)}>
                <Trash2 className="size-4 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
