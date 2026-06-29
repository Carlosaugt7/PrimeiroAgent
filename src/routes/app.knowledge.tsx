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
import { Database, Upload, Loader2, Trash2, FileText, Globe, Pencil, RefreshCw, AlertCircle } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/knowledge")({ component: Page });

interface KnowDoc {
  id: string;
  name: string;
  sourceUrl?: string; // populated for URL-based docs
  source?: "texto" | "txt" | "md";
  chunks?: number;
  embedModel: string;
  embedProviderId: string;
  vectorDim?: number;
  status?: "processando" | "indexado" | "erro";
  createdAt: string;
  agentId?: string | null;
}

// Gera UUID compatível inclusive em contextos HTTP (localhost sem HTTPS)
function generateId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
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
    if (end >= clean.length) break;
    i = end - overlap;
    if (i <= 0) break;
  }
  return out.filter(Boolean);
}

function Page() {
  const { tenant } = useAuth();
  const { providers, agents } = useAppStore();
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
  const [agentId, setAgentId] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState(false);
  const [progress, setProgress] = useState("");

  // Edit modal state
  const [editDoc, setEditDoc] = useState<KnowDoc | null>(null);
  const [editName, setEditName] = useState("");
  const [editText, setEditText] = useState("");
  const [editAgentId, setEditAgentId] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editProgress, setEditProgress] = useState("");

  // Refresh (URL re-scrape) state
  const [refreshDoc, setRefreshDoc] = useState<KnowDoc | null>(null);
  const [refreshBusy, setRefreshBusy] = useState(false);

  // RAG fails state
  const [fails, setFails] = useState<{ id: string; createdAt: string; userText: string; agentName: string }[]>([]);
  const [loadingFails, setLoadingFails] = useState(true);

  const fetchFails = async () => {
    if (!tenant?.id) return;
    setLoadingFails(true);
    try {
      const { data, error } = await supabase
        .from("ai_logs")
        .select("id, createdAt, userText, agentName")
        .eq("tenantId", tenant.id)
        .eq("ragSuccess", false)
        .order("createdAt", { ascending: false })
        .limit(50);
      if (data && !error) setFails(data as any[]);
    } catch (e) {
      console.warn("Erro ao buscar furos do RAG:", e);
    } finally {
      setLoadingFails(false);
    }
  };

  useEffect(() => {
    fetchFails();
  }, [tenant?.id]);
  // DeepSeek e Groq NÃO suportam embeddings via API direta
  const EMBED_CAPABLE_KINDS = ["openai", "openrouter", "google", "custom"];
  const embedProviders = providers.filter((p) =>
    EMBED_CAPABLE_KINDS.includes(p.kind),
  );

  // Provedores sem suporte a embeddings (para exibir aviso)
  const nonEmbedProviders = providers.filter(
    (p) => !EMBED_CAPABLE_KINDS.includes(p.kind),
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
      toast.error("Máx 5 MB");
      return;
    }
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["txt", "md", "xlsx"].includes(ext ?? "")) {
      toast.error("Apenas .txt, .md e .xlsx");
      return;
    }
    if (ext === "xlsx") {
      try {
        const { read, utils } = await import("xlsx");
        const ab = await file.arrayBuffer();
        const wb = read(ab, { type: "array" });
        let textVal = "";
        wb.SheetNames.forEach((sheetName) => {
          const ws = wb.Sheets[sheetName];
          const csv = utils.sheet_to_csv(ws);
          if (csv.trim()) {
            textVal += `Planilha: ${sheetName}\n${csv}\n\n`;
          }
        });
        setText(textVal);
        if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
      } catch (err) {
        toast.error("Erro ao ler planilha Excel");
        console.error(err);
      }
    } else {
      setText(await file.text());
      if (!name) setName(file.name.replace(/\.[^.]+$/, ""));
    }
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
    const docId = generateId();
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
            kind: provider.kind,
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
        sourceUrl: activeTab === "url" ? url.trim() : null,
        agentId: agentId || null,
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
      setAgentId(null);
      setProgress("");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Falha na ingestão";
      // Mensagens mais claras para erros comuns
      if (msg.includes("404") || msg.includes("not found")) {
        toast.error("Modelo de embedding não encontrado neste provedor. Verifique o nome do modelo.");
      } else if (msg.includes("401") || msg.includes("403") || msg.includes("Unauthorized")) {
        toast.error("API Key inválida ou sem permissão para embeddings. Verifique nas configurações do provedor.");
      } else if (msg.includes("fetch") || msg.includes("network") || msg.includes("ECONNREFUSED")) {
        toast.error("Falha de rede ao conectar com o provedor. Verifique sua conexão com a internet.");
      } else {
        toast.error(msg);
      }
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

  // Abre o modal de edição carregando os chunks existentes para texto
  const openEdit = async (d: KnowDoc) => {
    setEditDoc(d);
    setEditName(d.name);
    setEditAgentId(d.agentId || null);
    setEditText("");
    setEditProgress("Carregando conteúdo...");
    try {
      const { data: chunks } = await supabase
        .from("knowledge_chunks")
        .select("id, text")
        .eq("knowledgeId", d.id)
        .order("id", { ascending: true });
      if (chunks && chunks.length > 0) {
        setEditText(chunks.map((c: { text: string }) => c.text).join("\n\n"));
      }
    } catch {
      // ignora erro ao carregar, usuário pode digitar manualmente
    } finally {
      setEditProgress("");
    }
  };

  // Salva edição: renomeia e re-indexa os chunks com o novo texto
  const saveEdit = async () => {
    if (!tenant || !editDoc) return;
    const provider = providers.find((p) => p.id === editDoc.embedProviderId);
    if (!provider) {
      toast.error("Provedor de embeddings do documento não encontrado");
      return;
    }
    if (!editName.trim()) {
      toast.error("Nome obrigatório");
      return;
    }
    if (!editText.trim()) {
      toast.error("Conteúdo obrigatório");
      return;
    }
    setEditBusy(true);
    try {
      const chunks = chunkText(editText);
      setEditProgress(`Gerando embeddings (${chunks.length} chunks)...`);

      const vectors: number[][] = [];
      const BATCH = 64;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const r = await embed({
          data: {
            kind: provider.kind,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: editDoc.embedModel,
            texts: slice,
          },
        });
        vectors.push(...r.vectors);
        setEditProgress(`Embeddings: ${Math.min(i + BATCH, chunks.length)}/${chunks.length}`);
      }

      setEditProgress("Atualizando banco...");

      // Remove chunks antigos e insere os novos
      await supabase.from("knowledge_chunks").delete().eq("knowledgeId", editDoc.id);

      const chunkInserts = chunks.map((c, idx) => ({
        id: `${editDoc.id}_${String(idx).padStart(5, "0")}`,
        knowledgeId: editDoc.id,
        text: c,
        embedding: vectors[idx],
      }));

      for (let i = 0; i < chunkInserts.length; i += 200) {
        const { error } = await supabase
          .from("knowledge_chunks")
          .insert(chunkInserts.slice(i, i + 200));
        if (error) throw error;
      }

      // Atualiza o nome e o agente
      await supabase
        .from("knowledge")
        .update({ 
          name: editName.trim(),
          agentId: editAgentId || null
        })
        .eq("id", editDoc.id);

      toast.success(`"${editName}" atualizado (${chunks.length} chunks)`);
      setEditDoc(null);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setEditBusy(false);
      setEditProgress("");
    }
  };

  // Atualiza um documento de URL: re-faz scraping e re-indexa
  const runRefresh = async (d: KnowDoc) => {
    if (!tenant) return;
    const srcUrl = d.sourceUrl || (d.name.startsWith("http") ? d.name : null);
    if (!srcUrl) return;
    const provider = providers.find((p) => p.id === d.embedProviderId);
    if (!provider) {
      toast.error("Provedor de embeddings do documento não encontrado");
      return;
    }
    setRefreshDoc(d);
    setRefreshBusy(true);
    try {
      toast.info("Buscando página atualizada...");
      const res = await fetchWebpage({ data: { url: srcUrl } });
      const chunks = chunkText(res.text);

      const vectors: number[][] = [];
      const BATCH = 64;
      for (let i = 0; i < chunks.length; i += BATCH) {
        const slice = chunks.slice(i, i + BATCH);
        const r = await embed({
          data: {
            kind: provider.kind,
            baseUrl: provider.baseUrl,
            apiKey: provider.apiKey,
            model: d.embedModel,
            texts: slice,
          },
        });
        vectors.push(...r.vectors);
      }

      // Substitui todos os chunks
      await supabase.from("knowledge_chunks").delete().eq("knowledgeId", d.id);

      const chunkInserts = chunks.map((c, idx) => ({
        id: `${d.id}_${String(idx).padStart(5, "0")}`,
        knowledgeId: d.id,
        text: c,
        embedding: vectors[idx],
      }));

      for (let i = 0; i < chunkInserts.length; i += 200) {
        const { error } = await supabase
          .from("knowledge_chunks")
          .insert(chunkInserts.slice(i, i + 200));
        if (error) throw error;
      }

      toast.success(`"${d.name}" sincronizado (${chunks.length} chunks)`);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    } finally {
      setRefreshBusy(false);
      setRefreshDoc(null);
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
          <DialogContent className="max-w-2xl" aria-describedby={undefined}>
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
                  <Label>Agente Associado</Label>
                  <Select value={agentId || "global"} onValueChange={(val) => setAgentId(val === "global" ? null : val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o agente..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="global">Global (Todos os agentes)</SelectItem>
                      {agents.map((a) => (
                        <SelectItem key={a.id} value={a.id}>
                          {a.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Provedor de embeddings</Label>
                  <Select value={providerId} onValueChange={(val) => {
                    setProviderId(val);
                    const p = providers.find((x) => x.id === val);
                    if (p?.kind === "google") {
                      setEmbedModel("gemini-embedding-2");
                    } else if (p?.kind === "openrouter") {
                      setEmbedModel("openai/text-embedding-3-small");
                    } else {
                      setEmbedModel("text-embedding-3-small");
                    }
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione provedor..." />
                    </SelectTrigger>
                    <SelectContent>
                      {embedProviders.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name} · {p.kind}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {nonEmbedProviders.length > 0 && (
                    <p className="text-[10px] text-amber-500">
                      {nonEmbedProviders.map((p) => p.name).join(", ")} não aparecem aqui pois não suportam embeddings via API.
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>Modelo de embedding</Label>
                  <Input
                    value={embedModel}
                    onChange={(e) => setEmbedModel(e.target.value)}
                    placeholder="text-embedding-3-small"
                  />
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {(() => {
                      const p = providers.find((x) => x.id === providerId);
                      if (p?.kind === "google") {
                        return "Google: gemini-embedding-2 (768).";
                      }
                      if (p?.kind === "openrouter") {
                        return "OpenRouter: ex: openai/text-embedding-3-small.";
                      }
                      if (p?.kind === "custom") {
                        return "Custom: informe o modelo do provedor.";
                      }
                      return "OpenAI: text-embedding-3-small (1536) ou text-embedding-3-large (3072).";
                    })()}
                  </p>
                </div>
              </div>
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="file">Arquivo / Texto</TabsTrigger>
                  <TabsTrigger value="url">Link / URL</TabsTrigger>
                </TabsList>

                <TabsContent value="file" className="space-y-3 pt-3">
                  <div className="space-y-1.5">
                    <Label>Arquivo (.txt / .md / .xlsx) ou cole o texto</Label>
                    <input
                      type="file"
                      accept=".txt,.md,.xlsx"
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
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm space-y-2">
          <p className="font-semibold text-amber-600">Nenhum provedor com suporte a embeddings encontrado</p>
          <p>
            Para indexar documentos, cadastre um provedor compatível em <strong>LLM Providers</strong>:
          </p>
          <ul className="list-disc ml-5 text-xs text-muted-foreground space-y-1">
            <li><strong>Google Gemini</strong> — modelo <code>text-embedding-004</code></li>
            <li><strong>OpenAI</strong> — modelo <code>text-embedding-3-small</code></li>
            <li><strong>OpenRouter</strong> — modelo <code>openai/text-embedding-3-small</code></li>
          </ul>
          <p className="text-xs text-amber-500">
            Nota: DeepSeek e Groq <strong>não suportam</strong> embeddings via API.
          </p>
        </div>
      )}

      <Tabs defaultValue="documents" className="w-full" onValueChange={(val) => { if (val === "fails") fetchFails(); }}>
        <TabsList className="grid w-full grid-cols-2 max-w-sm">
          <TabsTrigger value="documents">Documentos indexados</TabsTrigger>
          <TabsTrigger value="fails">Furos de resposta</TabsTrigger>
        </TabsList>

        <TabsContent value="documents" className="space-y-4 pt-4">
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
              {docs.map((d) => {
                const isUrl = !!(d.sourceUrl || d.name.startsWith("http://") || d.name.startsWith("https://"));
                const isRefreshing = refreshDoc?.id === d.id && refreshBusy;
                return (
                  <li
                    key={d.id}
                    className="rounded-2xl border border-border bg-gradient-card p-4 flex items-start justify-between gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-sm truncate flex items-center gap-2">
                        {isUrl ? (
                          <Globe className="size-4 shrink-0 text-primary" />
                        ) : (
                          <FileText className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        {d.name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                        <span>{d.embedModel}</span>
                        <span className="text-[9px] bg-secondary px-1.5 py-0.5 rounded text-secondary-foreground">
                          {d.agentId 
                            ? `Agente: ${agents.find((a) => a.id === d.agentId)?.name || "Desconhecido"}` 
                            : "Global"}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isUrl && (
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Sincronizar com a página"
                          disabled={isRefreshing}
                          onClick={() => runRefresh(d)}
                        >
                          <RefreshCw className={`size-4 text-primary ${isRefreshing ? "animate-spin" : ""}`} />
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => openEdit(d)}
                      >
                        <Pencil className="size-4 text-muted-foreground" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Excluir" onClick={() => remove(d)}>
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        <TabsContent value="fails" className="space-y-4 pt-4">
          {loadingFails ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="size-6 animate-spin text-muted-foreground" />
            </div>
          ) : fails.length === 0 ? (
            <div className="rounded-2xl border border-border bg-gradient-card p-8 text-center text-muted-foreground text-sm">
              <AlertCircle className="size-8 mx-auto text-success mb-2" />
              Nenhum furo de RAG registrado. Todos os clientes receberam respostas com base no conhecimento disponível!
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-500/10 border border-amber-500/20 text-amber-500 rounded-xl p-4 text-xs">
                As perguntas abaixo resultaram na resposta de contingência do bot (falta de conhecimento na base). Use o botão de atalho para adicionar novos conteúdos cobrindo estas dúvidas.
              </div>
              <ul className="space-y-3">
                {fails.map((f) => (
                  <li key={f.id} className="rounded-xl border border-border bg-gradient-card p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <p className="font-medium text-sm text-foreground">"{f.userText}"</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Agente: <strong>{f.agentName}</strong></span>
                        <span>·</span>
                        <span>{new Date(f.createdAt).toLocaleString("pt-BR")}</span>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => {
                      setName(`Resposta para: ${f.userText.slice(0, 30)}...`);
                      setText(`Dúvida do cliente: ${f.userText}\n\nResposta:\n`);
                      setOpen(true);
                    }}>
                      Indexar resposta
                    </Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Edit Document Dialog */}
      <Dialog open={!!editDoc} onOpenChange={(o) => { if (!o) setEditDoc(null); }}>
        <DialogContent className="max-w-2xl" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Editar documento</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nome do documento"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Agente Associado</Label>
              <Select value={editAgentId || "global"} onValueChange={(val) => setEditAgentId(val === "global" ? null : val)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o agente..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="global">Global (Todos os agentes)</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Conteúdo</Label>
              {editProgress && !editBusy ? (
                <p className="text-xs text-muted-foreground py-2">{editProgress}</p>
              ) : (
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={12}
                  placeholder="Conteúdo do documento..."
                  className="font-mono text-xs"
                />
              )}
              <p className="text-[10px] text-muted-foreground">
                {editText.length.toLocaleString()} chars · ~{Math.max(1, Math.ceil(editText.length / 800))} chunks
              </p>
            </div>
            {editBusy && editProgress && (
              <p className="text-xs text-muted-foreground flex items-center gap-2">
                <Loader2 className="size-3 animate-spin" /> {editProgress}
              </p>
            )}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setEditDoc(null)} disabled={editBusy}>
                Cancelar
              </Button>
              <Button variant="hero" onClick={saveEdit} disabled={editBusy || !editText.trim()}>
                {editBusy ? <><Loader2 className="size-4 animate-spin" /> Salvando...</> : "Salvar alterações"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
