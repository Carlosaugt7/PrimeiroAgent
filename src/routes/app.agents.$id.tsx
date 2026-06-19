import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useAppStore, type Agent, type Persona } from "@/lib/app-store";
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
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Bot, Save, Trash2, Loader2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

export const Route = createFileRoute("/app/agents/$id")({
  component: AgentDetail,
});

function AgentDetail() {
  const { id } = Route.useParams();
  const { agents, providers, updateAgent, deleteAgent, loading, instances } = useAppStore();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 min-h-[50vh]">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const agent = agents.find((a) => a.id === id);

  if (!agent) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/app/agents">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          </Link>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Bot className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Agente não encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">O agente pode ter sido excluído.</p>
        </div>
      </div>
    );
  }

  return (
    <AgentDetailForm
      agent={agent}
      providers={providers}
      instances={instances}
      updateAgent={updateAgent}
      deleteAgent={deleteAgent}
      navigate={navigate}
    />
  );
}

interface AgentFormProps {
  agent: Agent;
  providers: any[];
  instances: any[];
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  navigate: ReturnType<typeof useNavigate>;
}

function AgentDetailForm({ agent, providers, instances, updateAgent, deleteAgent, navigate }: AgentFormProps) {
  const id = agent.id;
  const [form, setForm] = useState<Partial<Agent>>(agent);
  const [busy, setBusy] = useState(false);

  const provider = providers.find((p) => p.id === form.providerId);

  const handleSave = async () => {
    if (!form.name?.trim()) {
      toast.error("Informe o nome do agente");
      return;
    }
    setBusy(true);
    try {
      // Cria uma cópia limpa do patch sem id e sem tenantId para evitar erros de restrição no Supabase
      const { id: _, tenantId: __, createdAt: ___, messages30d: ____, conversions30d: _____, ...cleanPatch } = form;
      await updateAgent(id, cleanPatch);
      toast.success("Agente atualizado");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Excluir agente "${agent.name}"?`)) return;
    await deleteAgent(id);
    toast.success("Agente excluído");
    await navigate({ to: "/app/agents" });
  };

  const pf = (p: Partial<Persona>) =>
    setForm((f) => ({ ...f, persona: { ...(f.persona ?? agent.persona), ...p } }));

  const linkedInstance = instances.find((inst) => inst.name === form.whatsappInstanceId);
  const currentStatus = linkedInstance ? linkedInstance.status : agent.status;

  function statusClass(status: string) {
    if (status === "online") return "bg-success/15 text-success";
    if (status === "treinando") return "bg-accent/15 text-accent";
    if (status === "conectando") return "bg-amber-500/15 text-amber-500";
    return "bg-muted text-muted-foreground";
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link to="/app/agents">
            <Button variant="outline" size="sm">
              <ArrowLeft className="size-4" /> Voltar
            </Button>
          </Link>
          <div>
            <h1 className="font-display text-2xl font-bold">{agent.name}</h1>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${statusClass(currentStatus)}`}>
                {currentStatus}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {agent.segment}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="size-4" /> Excluir
          </Button>
          <Button variant="hero" size="sm" onClick={handleSave} disabled={busy}>
            <Save className="size-4" /> {busy ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <Tabs defaultValue="basic">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basic">Básico</TabsTrigger>
          <TabsTrigger value="persona">Persona</TabsTrigger>
          <TabsTrigger value="voice">Voz / Áudio</TabsTrigger>
          <TabsTrigger value="prompt">Prompt</TabsTrigger>
          <TabsTrigger value="model">Modelo</TabsTrigger>
        </TabsList>

        <TabsContent value="basic" className="space-y-4 pt-4">
          <div>
            <Label>Nome</Label>
            <Input
              value={form.name ?? ""}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Descrição</Label>
            <Input
              value={form.description ?? ""}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1"
            />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Categoria</Label>
              <Input
                value={form.category ?? ""}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Departamento</Label>
              <Input
                value={form.department ?? ""}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Segmento</Label>
              <Select
                value={form.segment ?? ""}
                onValueChange={(v) => setForm({ ...form, segment: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[
                    "Vendas",
                    "Suporte",
                    "Saúde",
                    "Imobiliária",
                    "E-commerce",
                    "Educação",
                    "Financeiro",
                    "Outros",
                  ].map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Instância WhatsApp vinculada</Label>
            <Input
              value={form.whatsappInstanceId ?? ""}
              onChange={(e) => setForm({ ...form, whatsappInstanceId: e.target.value })}
              placeholder="ex: vendas-loja-1"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Nome da instância Evolution API. Quando preenchido, o agente responde automaticamente
              às mensagens recebidas.
            </p>
          </div>
          <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-gradient-card">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Respostas Automáticas (IA)</Label>
              <p className="text-xs text-muted-foreground">
                Habilite ou desabilite as respostas automáticas do agente na instância do WhatsApp vinculada.
              </p>
            </div>
            <Switch
              checked={form.autoReply !== false}
              onCheckedChange={(checked) => setForm({ ...form, autoReply: checked })}
            />
          </div>
        </TabsContent>

        <TabsContent value="persona" className="space-y-3 pt-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Nome da persona</Label>
              <Input
                value={form.persona?.name ?? ""}
                onChange={(e) => pf({ name: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Cargo</Label>
              <Input
                value={form.persona?.role ?? ""}
                onChange={(e) => pf({ role: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label>Especialidade</Label>
              <Input
                value={form.persona?.specialty ?? ""}
                onChange={(e) => pf({ specialty: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Tom de voz</Label>
              <Input
                value={form.persona?.tone ?? ""}
                onChange={(e) => pf({ tone: e.target.value })}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Estilo de escrita</Label>
              <Input
                value={form.persona?.writingStyle ?? ""}
                onChange={(e) => pf({ writingStyle: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label>Regras comportamentais</Label>
              <Textarea
                rows={2}
                value={form.persona?.rules ?? ""}
                onChange={(e) => pf({ rules: e.target.value })}
                className="mt-1"
              />
            </div>
            <div className="col-span-2">
              <Label>Objetivos</Label>
              <Textarea
                rows={2}
                value={form.persona?.goals ?? ""}
                onChange={(e) => pf({ goals: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="voice" className="space-y-4 pt-4">
          <div>
            <Label>Modo de Resposta de Voz</Label>
            <Select
              value={form.voiceResponseMode ?? "audio_only_on_audio"}
              onValueChange={(v: any) => setForm({ ...form, voiceResponseMode: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text_only">Apenas Texto</SelectItem>
                <SelectItem value="audio_only_on_audio">Responder com áudio apenas quando receber áudio</SelectItem>
                <SelectItem value="always_audio">Responder sempre com áudio</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              Determina se o agente responderá por texto ou por mensagem de áudio gravada no WhatsApp.
            </p>
          </div>

          <div>
            <Label>Gênero da Voz</Label>
            <Select
              value={form.elevenlabsVoiceGender ?? "female"}
              onValueChange={(v) => setForm({ ...form, elevenlabsVoiceGender: v })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Feminino (Mulher)</SelectItem>
                <SelectItem value="male">Masculino (Homem)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Voice ID do ElevenLabs</Label>
            <Input
              value={form.elevenlabsVoiceId ?? ""}
              onChange={(e) => setForm({ ...form, elevenlabsVoiceId: e.target.value })}
              placeholder="ex: 21m00Tcm4TlvDq8ikWAM (Rachel)"
              className="mt-1"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Insira o ID da voz do ElevenLabs que o agente usará. Você pode escolher vozes pré-fabricadas ou clonadas no painel do ElevenLabs.
            </p>
          </div>
        </TabsContent>

        <TabsContent value="prompt" className="space-y-3 pt-4">
          <Label>Prompt do sistema</Label>
          <p className="text-xs text-muted-foreground">
            Suporta variáveis como <code className="text-accent">{"{{nome}}"}</code>,{" "}
            <code className="text-accent">{"{{empresa}}"}</code>.
          </p>
          <Textarea
            rows={14}
            value={form.systemPrompt ?? ""}
            onChange={(e) => setForm({ ...form, systemPrompt: e.target.value })}
            className="font-mono text-xs"
          />
        </TabsContent>

        <TabsContent value="model" className="space-y-4 pt-4">
          {providers.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-6 text-center">
              <p className="text-sm font-semibold">Nenhum provedor cadastrado</p>
              <p className="text-xs text-muted-foreground mt-1 mb-3">
                Cadastre um provedor LLM antes.
              </p>
              <Link to="/app/llm-providers">
                <Button variant="outline" size="sm">
                  Cadastrar provedor
                </Button>
              </Link>
            </div>
          ) : (
            <>
              <div>
                <Label>Provedor</Label>
                <Select
                  value={form.providerId ?? ""}
                  onValueChange={(v) => setForm({ ...form, providerId: v, model: "" })}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {providers.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name} <span className="text-muted-foreground">({p.kind})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo</Label>
                <Select
                  value={form.model ?? ""}
                  onValueChange={(v) => setForm({ ...form, model: v })}
                  disabled={!provider}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={provider ? "Selecione..." : "Escolha um provedor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {provider?.models.map((m: { id: string; contextWindow?: number }) => (
                      <SelectItem key={m.id} value={m.id}>
                        {m.id}
                        {m.contextWindow ? ` · ${m.contextWindow.toLocaleString()} tokens` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label>Temperatura ({form.temperature ?? 0.5})</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={form.temperature ?? 0.5}
                    onChange={(e) =>
                      setForm({ ...form, temperature: Number.parseFloat(e.target.value) })
                    }
                    className="w-full accent-primary mt-3"
                  />
                </div>
                <div>
                  <Label>Top P ({form.topP ?? 1})</Label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={form.topP ?? 1}
                    onChange={(e) => setForm({ ...form, topP: Number.parseFloat(e.target.value) })}
                    className="w-full accent-primary mt-3"
                  />
                </div>
                <div>
                  <Label>Max tokens</Label>
                  <Input
                    type="number"
                    value={form.maxTokens ?? 1024}
                    onChange={(e) =>
                      setForm({ ...form, maxTokens: Number.parseInt(e.target.value, 10) || 1024 })
                    }
                    className="mt-1"
                  />
                </div>
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
