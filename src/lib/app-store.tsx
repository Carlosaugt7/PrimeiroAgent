import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { db } from "@/integrations/firebase/client";
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  setDoc,
  serverTimestamp,
  query,
  orderBy,
  limit,
} from "firebase/firestore";

export type AgentStatus = "online" | "offline" | "treinando";
export type WhatsAppStatus = "conectado" | "desconectado" | "aguardando_qr";

export interface AgentTool {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
}
export interface AgentTrigger {
  id: string;
  type: "mensagem" | "cron" | "webhook";
  label: string;
  config: string;
  enabled: boolean;
}
export interface AgentEnvVar { id: string; key: string; value: string; secret: boolean }

export interface Agent {
  id: string;
  name: string;
  description: string;
  segment: string;
  status: AgentStatus;
  whatsapp: WhatsAppStatus;
  whatsappNumber?: string;
  model: string;
  provider: "openai" | "anthropic" | "google" | "lovable";
  temperature: number;
  topP: number;
  maxTokens: number;
  presencePenalty: number;
  frequencyPenalty: number;
  memory: "curto" | "longo" | "vetorial";
  systemPrompt: string;
  messages30d: number;
  conversions30d: number;
  createdAt: string;
  knowledgeBaseIds: string[];
  tools: AgentTool[];
  triggers: AgentTrigger[];
  envVars: AgentEnvVar[];
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: "pdf" | "site" | "planilha" | "texto";
  sizeKb: number;
  uploadedAt: string;
  agentId?: string;
  indexProgress: number;
  status: "fila" | "processando" | "indexado" | "erro";
}

export interface Conversation {
  id: string;
  agentId: string;
  contactName: string;
  contactPhone: string;
  lastMessage: string;
  unread: number;
  updatedAt: string;
  status: "aberta" | "resolvida" | "handoff";
}

export interface TenantUser {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "editor" | "viewer";
}

export interface Integration {
  id: string;
  name: string;
  kind: "whatsapp" | "webhook" | "telegram" | "slack" | "api";
  status: "ativo" | "inativo";
  detail: string;
}

export interface LogEntry {
  id: string;
  ts: string;
  agentId: string;
  level: "info" | "warn" | "error" | "tool";
  message: string;
  durationMs?: number;
  tokens?: number;
}

export interface Deployment {
  id: string;
  agentId: string;
  version: string;
  env: "dev" | "prod";
  deployedAt: string;
  deployedBy: string;
  status: "ativo" | "rollback";
}

export interface PlanInfo {
  name: string;
  price: string;
  renewsAt: string;
  messagesUsed: number;
  messagesLimit: number;
}

interface AppState {
  agents: Agent[];
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  users: TenantUser[];
  integrations: Integration[];
  logs: LogEntry[];
  deployments: Deployment[];
  plan: PlanInfo;
  loading: boolean;
  createAgent: (a: Pick<Agent, "name" | "description" | "segment" | "model" | "temperature" | "systemPrompt">) => Promise<string>;
  updateAgent: (id: string, patch: Partial<Agent>) => Promise<void>;
  deleteAgent: (id: string) => Promise<void>;
  connectWhatsapp: (agentId: string, number: string) => Promise<void>;
  addDoc: (d: Pick<KnowledgeDoc, "name" | "type" | "sizeKb" | "agentId">) => Promise<void>;
  removeDoc: (id: string) => Promise<void>;
  toggleIntegration: (id: string) => Promise<void>;
  promoteDeployment: (agentId: string) => Promise<void>;
}

const defaultTools = (): AgentTool[] => [
  { id: "t_web", name: "web_search", description: "Pesquisa na web em tempo real", enabled: true },
  { id: "t_http", name: "http_request", description: "Chama APIs externas (GET/POST)", enabled: false },
  { id: "t_cal", name: "calendar", description: "Lê e cria eventos de calendário", enabled: false },
  { id: "t_code", name: "code_interpreter", description: "Executa cálculos e Python sandbox", enabled: false },
  { id: "t_img", name: "image_generation", description: "Gera imagens sob demanda", enabled: false },
];

const defaultPlan: PlanInfo = { name: "—", price: "—", renewsAt: "—", messagesUsed: 0, messagesLimit: 0 };

const AppCtx = createContext<AppState | null>(null);

function useCollectionSync<T extends { id: string }>(name: string, setter: (rows: T[]) => void) {
  useEffect(() => {
    const unsub = onSnapshot(collection(db, name), (snap) => {
      setter(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as T[]);
    }, (err) => console.error(`[firebase] ${name}:`, err));
    return () => unsub();
  }, [name, setter]);
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<TenantUser[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [plan, setPlan] = useState<PlanInfo>(defaultPlan);
  const [loading, setLoading] = useState(true);

  useCollectionSync<Agent>("agents", setAgents);
  useCollectionSync<KnowledgeDoc>("docs", setDocs);
  useCollectionSync<TenantUser>("users", setUsers);
  useCollectionSync<Integration>("integrations", setIntegrations);
  useCollectionSync<Deployment>("deployments", setDeployments);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "conversations"), orderBy("updatedAt", "desc")),
      (snap) => setConversations(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Conversation[]),
      (err) => console.error("[firebase] conversations:", err),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "logs"), orderBy("ts", "desc"), limit(100)),
      (snap) => setLogs(snap.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as LogEntry[]),
      (err) => console.error("[firebase] logs:", err),
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, "settings", "plan"), (d) => {
      if (d.exists()) setPlan(d.data() as PlanInfo);
      setLoading(false);
    }, (err) => { console.error("[firebase] plan:", err); setLoading(false); });
    return () => unsub();
  }, []);

  const value = useMemo<AppState>(() => ({
    agents, docs, conversations, users, integrations, logs, deployments, plan, loading,
    createAgent: async (a) => {
      const ref = await addDoc(collection(db, "agents"), {
        name: a.name, description: a.description, segment: a.segment,
        status: "offline", whatsapp: "desconectado",
        model: a.model, provider: "openai",
        temperature: a.temperature, topP: 1, maxTokens: 1024,
        presencePenalty: 0, frequencyPenalty: 0, memory: "vetorial",
        systemPrompt: a.systemPrompt, messages30d: 0, conversions30d: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        knowledgeBaseIds: [], tools: defaultTools(), triggers: [], envVars: [],
      });
      return ref.id;
    },
    updateAgent: async (id, patch) => {
      await updateDoc(doc(db, "agents", id), patch as Record<string, unknown>);
    },
    deleteAgent: async (id) => { await deleteDoc(doc(db, "agents", id)); },
    connectWhatsapp: async (agentId, number) => {
      await updateDoc(doc(db, "agents", agentId), { whatsapp: "conectado", whatsappNumber: number, status: "online" });
    },
    addDoc: async (d) => {
      const ref = await addDoc(collection(db, "docs"), {
        ...d, uploadedAt: new Date().toISOString().slice(0, 10), indexProgress: 0, status: "processando",
      });
      let p = 0;
      const tick = setInterval(async () => {
        p += 20;
        await updateDoc(doc(db, "docs", ref.id), {
          indexProgress: Math.min(100, p),
          status: p >= 100 ? "indexado" : "processando",
        });
        if (p >= 100) clearInterval(tick);
      }, 600);
    },
    removeDoc: async (id) => { await deleteDoc(doc(db, "docs", id)); },
    toggleIntegration: async (id) => {
      const cur = integrations.find((i) => i.id === id);
      if (!cur) return;
      await updateDoc(doc(db, "integrations", id), { status: cur.status === "ativo" ? "inativo" : "ativo" });
    },
    promoteDeployment: async (agentId) => {
      const dev = deployments.find((d) => d.agentId === agentId && d.env === "dev");
      if (!dev) return;
      const prod = deployments.find((d) => d.agentId === agentId && d.env === "prod");
      if (prod) await deleteDoc(doc(db, "deployments", prod.id));
      await setDoc(doc(collection(db, "deployments")), {
        agentId, version: dev.version, env: "prod",
        deployedAt: new Date().toISOString().slice(0, 16).replace("T", " "),
        deployedBy: dev.deployedBy, status: "ativo", _ts: serverTimestamp(),
      });
    },
  }), [agents, docs, conversations, users, integrations, logs, deployments, plan, loading]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
