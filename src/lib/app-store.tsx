import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "@/integrations/firebase/client";
import {
  collection,
  onSnapshot,
  addDoc as fsAddDoc,
  updateDoc,
  deleteDoc,
  doc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";
import { useAuth } from "@/lib/auth";
import { logAudit, notify } from "@/lib/notifications";
import { ensureLimit } from "@/lib/limits";

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
}

export interface LLMProvider {
  id: string;
  name: string;
  kind: "openai" | "anthropic" | "google" | "groq" | "deepseek" | "openrouter" | "custom";
  baseUrl: string;
  apiKey: string; // stored as-is for now; Phase 5 will encrypt
  models: { id: string; contextWindow?: number }[];
  createdAt: string;
}

export interface Conversation {
  id: string;
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
  name: string;
  type: "pdf" | "docx" | "xlsx" | "txt" | "csv" | "json" | "site" | "faq";
  sizeKb: number;
  uploadedAt: string;
  agentId?: string;
  status: "fila" | "processando" | "indexado" | "erro";
}

export interface Instance {
  id: string;
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
  createProvider: (p: Omit<LLMProvider, "id" | "createdAt" | "models"> & { models?: LLMProvider["models"] }) => Promise<string>;
  updateProvider: (id: string, patch: Partial<LLMProvider>) => Promise<void>;
  deleteProvider: (id: string) => Promise<void>;
}

const defaultPersona = (): Persona => ({
  name: "", role: "", specialty: "", tone: "Profissional, cordial",
  writingStyle: "Direto e claro", rules: "Nunca prometa o que não pode cumprir.", goals: "Qualificar e converter leads.",
});

const defaultPlan: AppPlan = { name: "Trial", messagesUsed: 0, messagesLimit: 1000, renewsAt: "—" };

const Ctx = createContext<AppState | null>(null);

function tcol(tenantId: string, name: string) {
  return collection(db, "tenants", tenantId, name);
}
function tdoc(tenantId: string, name: string, id: string) {
  return doc(db, "tenants", tenantId, name, id);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const { tenant, profile, isMaster, loading: authLoading } = useAuth();
  const tenantId = tenant?.id ?? null;

  const [agents, setAgents] = useState<Agent[]>([]);
  const [providers, setProviders] = useState<LLMProvider[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [knowledge, setKnowledge] = useState<KnowledgeDoc[]>([]);
  const [instances, setInstances] = useState<Instance[]>([]);
  const [plan] = useState<AppPlan>(defaultPlan);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) { setLoading(authLoading); return; }
    setLoading(true);
    const subs: Array<() => void> = [];

    subs.push(onSnapshot(tcol(tenantId, "agents"), (s) => {
      setAgents(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Agent[]);
      setLoading(false);
    }, (e) => { console.error("[fs] agents:", e); setLoading(false); }));

    subs.push(onSnapshot(tcol(tenantId, "llm_providers"), (s) => {
      setProviders(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as LLMProvider[]);
    }));

    subs.push(onSnapshot(query(tcol(tenantId, "conversations"), orderBy("updatedAt", "desc"), limit(50)), (s) => {
      setConversations(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Conversation[]);
    }));

    subs.push(onSnapshot(tcol(tenantId, "knowledge"), (s) => {
      setKnowledge(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as KnowledgeDoc[]);
    }));

    const prevInstanceStatus = new Map<string, string>();
    subs.push(onSnapshot(tcol(tenantId, "instances"), (s) => {
      const next = s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Instance[];
      // Alerta quando uma instância sai de open/connected
      for (const inst of next) {
        const prev = prevInstanceStatus.get(inst.id);
        const cur = String((inst as any).status ?? "").toLowerCase();
        const wasOk = prev === "open" || prev === "connected";
        const isDown = cur && cur !== "open" && cur !== "connected" && cur !== "connecting";
        if (prev && wasOk && isDown) {
          notify(tenantId, {
            type: "instance_down", severity: "error",
            title: "Instância WhatsApp caiu",
            body: `${(inst as any).instanceName ?? inst.id} agora está "${cur}".`,
            link: "/app/whatsapp",
          });
          logAudit(tenantId, { action: "instance.down", target: inst.id, targetLabel: (inst as any).instanceName, meta: { from: prev, to: cur } });
        }
        prevInstanceStatus.set(inst.id, cur);
      }
      setInstances(next);
    }));

    return () => subs.forEach((u) => u());
  }, [tenantId, authLoading]);

  const value = useMemo<AppState>(() => ({
    loading, tenantId, agents, providers, conversations, knowledge, instances, plan,
    createAgent: async (a) => {
      if (!tenantId) throw new Error("Sem tenant");
      const lim = ensureLimit(tenantId, tenant?.plan, "agents", agents.length, isMaster);
      if (!lim.ok) throw new Error(lim.message ?? "Limite de agentes atingido");
      const ref = await fsAddDoc(tcol(tenantId, "agents"), {
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
        _ts: serverTimestamp(),
        _createdBy: profile?.uid ?? "",
      });
      const actor = { actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName };
      logAudit(tenantId, { action: "agent.create", target: ref.id, targetLabel: a.name, ...actor });
      notify(tenantId, { type: "system", severity: "success", title: "Agente criado", body: `${a.name} foi adicionado.`, link: "/app/agents" });
      return ref.id;
    },
    updateAgent: async (id, patch) => {
      if (!tenantId) return;
      await updateDoc(tdoc(tenantId, "agents", id), patch as Record<string, unknown>);
      logAudit(tenantId, { action: "agent.update", target: id, targetLabel: (patch as any)?.name, actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName, meta: { fields: Object.keys(patch as object) } });
    },
    deleteAgent: async (id) => {
      if (!tenantId) return;
      const name = agents.find((x) => x.id === id)?.name;
      await deleteDoc(tdoc(tenantId, "agents", id));
      logAudit(tenantId, { action: "agent.delete", target: id, targetLabel: name, actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName });
      notify(tenantId, { type: "system", severity: "warning", title: "Agente removido", body: name ?? id });
    },
    createProvider: async (p) => {
      if (!tenantId) throw new Error("Sem tenant");
      const ref = await fsAddDoc(tcol(tenantId, "llm_providers"), {
        ...p, models: p.models ?? [], createdAt: new Date().toISOString(), _ts: serverTimestamp(),
      });
      return ref.id;
    },
    updateProvider: async (id, patch) => {
      if (!tenantId) return;
      await updateDoc(tdoc(tenantId, "llm_providers", id), patch as Record<string, unknown>);
    },
    deleteProvider: async (id) => {
      if (!tenantId) return;
      await deleteDoc(tdoc(tenantId, "llm_providers", id));
    },
  }), [loading, tenantId, profile, tenant?.plan, isMaster, agents, providers, conversations, knowledge, instances, plan]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
