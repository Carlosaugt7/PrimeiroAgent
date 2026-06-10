import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { logAudit, notify } from "@/lib/notifications";
import { ensureLimit } from "@/lib/limits";
import { toast } from "sonner";

export type AgentStatus = "online" | "offline" | "treinando";

export interface Persona {
  name: string;
  role: string;
  specialty: string;
  tone: string;
  writingStyle: string;
  rules: string;
  goals: string;
}

export interface Agent {
  id: string;
  tenantId: string;
  name: string;
  photoUrl?: string;
  category: string;
  department: string;
  description: string;
  status: AgentStatus;
  segment: string;
  systemPrompt: string;
  promptVersion: number;
  providerId?: string;
  model: string;
  temperature: number;
  topP: number;
  maxTokens: number;
  memory: "curto" | "longo" | "vetorial";
  persona: Persona;
  messages30d: number;
  conversions30d: number;
  createdAt: string;
  whatsappInstanceId?: string;
  autoReply?: boolean;
}

export interface LLMProvider {
  id: string;
  tenantId: string;
  name: string;
  kind: "openai" | "anthropic" | "google" | "groq" | "deepseek" | "openrouter" | "custom";
  baseUrl: string;
  apiKey: string; // stored as-is for now; Phase 5 will encrypt
  models: { id: string; contextWindow?: number }[];
  createdAt: string;
}

export interface Conversation {
  id: string;
  tenantId: string;
  agentId?: string;
  instanceName?: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
  status: "aberta" | "resolvida" | "handoff";
  botPaused?: boolean;
  tags?: string[];
}

export interface KnowledgeDoc {
  id: string;
  tenantId: string;
  name: string;
  type: "pdf" | "docx" | "xlsx" | "txt" | "csv" | "json" | "site" | "faq";
  sizeKb: number;
  uploadedAt: string;
  agentId?: string;
  status: "fila" | "processando" | "indexado" | "erro";
}

export interface Instance {
  id: string;
  tenantId: string;
  name: string;
  status: "online" | "offline" | "conectando";
  number?: string;
  webhook?: string;
  createdAt: string;
}

export interface AppPlan {
  name: string;
  messagesUsed: number;
  messagesLimit: number;
  renewsAt: string;
}

interface AppState {
  loading: boolean;
  tenantId: string | null;
  agents: Agent[];
  providers: LLMProvider[];
  conversations: Conversation[];
  knowledge: KnowledgeDoc[];
  instances: Instance[];
  plan: AppPlan;
  createAgent: (a: Partial<Agent> & { name: string }) => Promise<string>;
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  createProvider: (
    p: Omit<LLMProvider, "id" | "createdAt" | "models" | "tenantId"> & {
      models?: LLMProvider["models"];
    },
  ) => Promise<string>;
  updateProvider: (id: string, patch: Partial<LLMProvider>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
  activeQrFor: string | null;
  activeQrBase64: string | null;
  activeQrLoading: boolean;
  openQr: (instanceName: string) => Promise<void>;
  closeQr: () => void;
}

const defaultPersona = (): Persona => ({
  name: "",
  role: "",
  specialty: "",
  tone: "Profissional, cordial",
  writingStyle: "Direto e claro",
  rules: "Nunca prometa o que não pode cumprir.",
  goals: "Qualificar e converter leads.",
});

const defaultPlan: AppPlan = { name: "Trial", messagesUsed: 0, messagesLimit: 1000, renewsAt: "—" };

const Ctx = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { readonly children: ReactNode }) {
  const { tenant, profile, isMaster, loading: authLoading } = useAuth();
  const tenantId = tenant?.id ?? null;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeDoc[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [plan] = useState<AppPlan>(defaultPlan);
  const [loading, setLoading] = useState(true);

  const [activeQrFor, setActiveQrFor] = useState<string | null>(null);
  const [activeQrBase64, setActiveQrBase64] = useState<string | null>(null);
  const [activeQrLoading, setActiveQrLoading] = useState(false);

  useEffect(() => {
    if (!tenantId || !activeQrFor) return;
    const iv = setInterval(async () => {
      try {
        const { instanceState } = await import("@/lib/evolution.functions");
        const r = await instanceState({ data: { tenantId, instanceName: activeQrFor } });
        if (r.state.toLowerCase() === "open") {
          toast.success("WhatsApp conectado com sucesso!");
          notify(tenantId, {
            type: "system",
            severity: "success",
            title: "WhatsApp conectado!",
            body: `Instância ${activeQrFor} conectada com sucesso.`,
            link: "/app/whatsapp",
          });
          setActiveQrFor(null);
          setActiveQrBase64(null);
        }
      } catch {
        /* ignore */
      }
    }, 3000);
    return () => clearInterval(iv);
  }, [activeQrFor, tenantId]);

  useEffect(() => {
    if (!tenantId) {
      setLoading(authLoading);
      return;
    }
    setLoading(true);

    const fetchInitial = async () => {
      try {
        const [
          { data: agentsData },
          { data: providersData },
          { data: convsData },
          { data: knowData },
          { data: instData },
        ] = await Promise.all([
          supabase.from("agents").select("*").eq("tenantId", tenantId),
          supabase.from("llm_providers").select("*").eq("tenantId", tenantId),
          supabase
            .from("conversations")
            .select("*")
            .eq("tenantId", tenantId)
            .order("updatedAt", { ascending: false })
            .limit(50),
          supabase.from("knowledge").select("*").eq("tenantId", tenantId),
          supabase.from("instances").select("*").eq("tenantId", tenantId),
        ]);

        if (agentsData) setAgents(agentsData as Agent[]);
        if (providersData) setProviders(providersData as LLMProvider[]);
        if (convsData) setConversations(convsData as Conversation[]);
        if (knowData) setKnowledge(knowData as KnowledgeDoc[]);
        if (instData) setInstances(instData as Instance[]);
      } catch (err) {
        console.error("Failed to fetch initial data", err);
      } finally {
        setLoading(false);
      }
    };

    fetchInitial();

    const channel = supabase
      .channel(`tenant_${tenantId}_changes`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "agents", filter: `tenantId=eq.${tenantId}` },
        async () => {
          const { data } = await supabase.from("agents").select("*").eq("tenantId", tenantId);
          if (data) setAgents(data as Agent[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "llm_providers", filter: `tenantId=eq.${tenantId}` },
        async () => {
          const { data } = await supabase
            .from("llm_providers")
            .select("*")
            .eq("tenantId", tenantId);
          if (data) setProviders(data as LLMProvider[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations", filter: `tenantId=eq.${tenantId}` },
        async () => {
          const { data } = await supabase
            .from("conversations")
            .select("*")
            .eq("tenantId", tenantId)
            .order("updatedAt", { ascending: false })
            .limit(50);
          if (data) setConversations(data as Conversation[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "knowledge", filter: `tenantId=eq.${tenantId}` },
        async () => {
          const { data } = await supabase.from("knowledge").select("*").eq("tenantId", tenantId);
          if (data) setKnowledge(data as KnowledgeDoc[]);
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "instances", filter: `tenantId=eq.${tenantId}` },
        async () => {
          const { data } = await supabase.from("instances").select("*").eq("tenantId", tenantId);
          if (data) {
            const next = data as Instance[];
            setInstances((prev) => {
              // Check for instance down logic
              const prevMap = new Map(prev.map((i) => [i.id, i.status]));
              next.forEach((inst) => {
                const prevStatus = prevMap.get(inst.id);
                const curStatus = inst.status;
                const wasOk = prevStatus === "online";
                const isDown = curStatus && curStatus !== "online" && curStatus !== "conectando";

                if (prevStatus && wasOk && isDown) {
                  notify(tenantId, {
                    type: "instance_down",
                    severity: "error",
                    title: "Instância WhatsApp caiu",
                    body: `${(inst as any).instanceName ?? inst.id} agora está "${curStatus}".`,
                    link: "/app/whatsapp",
                  });
                  logAudit(tenantId, {
                    action: "instance.down",
                    target: inst.id,
                    targetLabel: (inst as any).instanceName,
                    meta: { from: prevStatus, to: curStatus },
                  });
                }
              });
              return next;
            });
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, authLoading]);

  const value = useMemo<AppState>(
    () => ({
      loading,
      tenantId,
      agents,
      providers,
      conversations,
      knowledge,
      instances,
      plan,
      createAgent: async (a) => {
        if (!tenantId) throw new Error("Sem tenant");
        const lim = ensureLimit(tenantId, tenant?.plan, "agents", agents.length, isMaster);
        if (!lim.ok) throw new Error(lim.message ?? "Limite de agentes atingido");

        const newAgent = {
          tenantId,
          name: a.name,
          photoUrl: a.photoUrl ?? "",
          category: a.category ?? "Geral",
          department: a.department ?? "Atendimento",
          description: a.description ?? "",
          status: "offline" as AgentStatus,
          segment: a.segment ?? "Vendas",
          systemPrompt: a.systemPrompt ?? "Você é um assistente prestativo.",
          promptVersion: 1,
          providerId: a.providerId ?? "",
          model: a.model ?? "",
          temperature: a.temperature ?? 0.5,
          topP: a.topP ?? 1,
          maxTokens: a.maxTokens ?? 1024,
          memory: a.memory ?? "vetorial",
          persona: a.persona ?? defaultPersona(),
          messages30d: 0,
          conversions30d: 0,
          createdAt: new Date().toISOString(),
          _createdBy: profile?.uid ?? "",
        };

        const { data, error } = await supabase
          .from("agents")
          .insert(newAgent)
          .select("id")
          .single();
        if (error || !data) throw new Error("Erro ao criar agente: " + error?.message);

        const actor = {
          actorId: profile?.uid,
          actorEmail: profile?.email,
          actorName: profile?.displayName,
        };
        logAudit(tenantId, {
          action: "agent.create",
          target: data.id,
          targetLabel: a.name,
          ...actor,
        });
        notify(tenantId, {
          type: "system",
          severity: "success",
          title: "Agente criado",
          body: `${a.name} foi adicionado.`,
          link: "/app/agents",
        });
        return data.id;
      },
      updateAgent: async (id, patch) => {
        if (!tenantId) return;
        await supabase.from("agents").update(patch).eq("id", id).eq("tenantId", tenantId);
        logAudit(tenantId, {
          action: "agent.update",
          target: id,
          targetLabel: (patch as Partial<Agent>).name,
          actorId: profile?.uid,
          actorEmail: profile?.email,
          actorName: profile?.displayName,
          meta: { fields: Object.keys(patch) },
        });
      },
      deleteAgent: async (id) => {
        if (!tenantId) return;
        const name = agents.find((x) => x.id === id)?.name;
        await supabase.from("agents").delete().eq("id", id).eq("tenantId", tenantId);
        logAudit(tenantId, {
          action: "agent.delete",
          target: id,
          targetLabel: name,
          actorId: profile?.uid,
          actorEmail: profile?.email,
          actorName: profile?.displayName,
        });
        notify(tenantId, {
          type: "system",
          severity: "warning",
          title: "Agente removido",
          body: name ?? id,
        });
      },
      createProvider: async (p) => {
        if (!tenantId) throw new Error("Sem tenant");
        const newProvider = {
          ...p,
          tenantId,
          models: p.models ?? [],
          createdAt: new Date().toISOString(),
        };
        const { data, error } = await supabase
          .from("llm_providers")
          .insert(newProvider)
          .select("id")
          .single();
        if (error || !data) throw new Error("Erro ao criar provider: " + error?.message);
        return data.id;
      },
      updateProvider: async (id, patch) => {
        if (!tenantId) return;
        await supabase.from("llm_providers").update(patch).eq("id", id).eq("tenantId", tenantId);
      },
      deleteProvider: async (id) => {
        if (!tenantId) return;
        await supabase.from("llm_providers").delete().eq("id", id).eq("tenantId", tenantId);
      },
      activeQrFor,
      activeQrBase64,
      activeQrLoading,
      openQr: async (instanceName) => {
        if (!tenantId) return;
        setActiveQrFor(instanceName);
        setActiveQrBase64(null);
        setActiveQrLoading(true);
        try {
          const { connectInstance } = await import("@/lib/evolution.functions");
          const r = await connectInstance({ data: { tenantId, instanceName } });
          setActiveQrBase64(r.base64);
        } catch (error: any) {
          toast.error(error?.message ?? "Falha ao carregar QR Code");
          setActiveQrFor(null);
        } finally {
          setActiveQrLoading(false);
        }
      },
      closeQr: () => {
        setActiveQrFor(null);
        setActiveQrBase64(null);
      },
    }),
    [
      loading,
      tenantId,
      profile,
      tenant?.plan,
      isMaster,
      agents,
      providers,
      conversations,
      knowledge,
      instances,
      plan,
      activeQrFor,
      activeQrBase64,
      activeQrLoading,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
