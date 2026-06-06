import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

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
  indexProgress: number; // 0-100
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

interface AppState {
  agents: Agent[];
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  users: TenantUser[];
  integrations: Integration[];
  logs: LogEntry[];
  deployments: Deployment[];
  plan: { name: string; price: string; renewsAt: string; messagesUsed: number; messagesLimit: number };
  createAgent: (a: Pick<Agent, "name" | "description" | "segment" | "model" | "temperature" | "systemPrompt">) => string;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  connectWhatsapp: (agentId: string, number: string) => void;
  addDoc: (d: Pick<KnowledgeDoc, "name" | "type" | "sizeKb" | "agentId">) => void;
  removeDoc: (id: string) => void;
  toggleIntegration: (id: string) => void;
  promoteDeployment: (agentId: string) => void;
}

const defaultTools = (): AgentTool[] => [
  { id: "t_web", name: "web_search", description: "Pesquisa na web em tempo real", enabled: true },
  { id: "t_http", name: "http_request", description: "Chama APIs externas (GET/POST)", enabled: false },
  { id: "t_cal", name: "calendar", description: "Lê e cria eventos de calendário", enabled: false },
  { id: "t_code", name: "code_interpreter", description: "Executa cálculos e Python sandbox", enabled: false },
  { id: "t_img", name: "image_generation", description: "Gera imagens sob demanda", enabled: false },
];

const baseAgent = (over: Partial<Agent>): Agent => ({
  id: "", name: "", description: "", segment: "Vendas",
  status: "offline", whatsapp: "desconectado",
  model: "gpt-4o-mini", provider: "openai", temperature: 0.4, topP: 1, maxTokens: 1024,
  presencePenalty: 0, frequencyPenalty: 0, memory: "vetorial",
  systemPrompt: "", messages30d: 0, conversions30d: 0,
  createdAt: new Date().toISOString().slice(0, 10),
  knowledgeBaseIds: [], tools: defaultTools(), triggers: [], envVars: [],
  ...over,
});

const seedAgents: Agent[] = [];
const seedDocs: KnowledgeDoc[] = [];
const seedConvs: Conversation[] = [];
const seedUsers: TenantUser[] = [];
const seedIntegrations: Integration[] = [];
const seedLogs: LogEntry[] = [];
const seedDeployments: Deployment[] = [];

const AppCtx = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(seedAgents);
  const [docs, setDocs] = useState<KnowledgeDoc[]>(seedDocs);
  const [conversations] = useState<Conversation[]>(seedConvs);
  const [users] = useState<TenantUser[]>(seedUsers);
  const [integrations, setIntegrations] = useState<Integration[]>(seedIntegrations);
  const [logs] = useState<LogEntry[]>(seedLogs);
  const [deployments, setDeployments] = useState<Deployment[]>(seedDeployments);

  const value = useMemo<AppState>(() => ({
    agents, docs, conversations, users, integrations, logs, deployments,
    plan: { name: "Pro", price: "R$ 597", renewsAt: "30/06/2026", messagesUsed: 7710, messagesLimit: 10000 },
    createAgent: (a) => {
      const id = `ag_${Date.now()}`;
      setAgents((prev) => [...prev, baseAgent({ ...a, id })]);
      return id;
    },
    updateAgent: (id, patch) => setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    deleteAgent: (id) => setAgents((prev) => prev.filter((a) => a.id !== id)),
    connectWhatsapp: (agentId, number) => setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, whatsapp: "conectado", whatsappNumber: number, status: "online" } : a)),
    addDoc: (d) => {
      const id = `doc_${Date.now()}`;
      setDocs((prev) => [...prev, { ...d, id, uploadedAt: new Date().toISOString().slice(0, 10), indexProgress: 0, status: "processando" }]);
      let p = 0;
      const tick = setInterval(() => {
        p += 20;
        setDocs((prev) => prev.map((x) => x.id === id ? { ...x, indexProgress: Math.min(100, p), status: p >= 100 ? "indexado" : "processando" } : x));
        if (p >= 100) clearInterval(tick);
      }, 600);
    },
    removeDoc: (id) => setDocs((prev) => prev.filter((d) => d.id !== id)),
    toggleIntegration: (id) => setIntegrations((prev) => prev.map((i) => i.id === id ? { ...i, status: i.status === "ativo" ? "inativo" : "ativo" } : i)),
    promoteDeployment: (agentId) => setDeployments((prev) => {
      const dev = prev.find((d) => d.agentId === agentId && d.env === "dev");
      if (!dev) return prev;
      return [
        ...prev.filter((d) => !(d.agentId === agentId && d.env === "prod")),
        { ...dev, id: `d_${Date.now()}`, env: "prod", deployedAt: new Date().toISOString().slice(0, 16).replace("T", " ") },
      ];
    }),
  }), [agents, docs, conversations, users, integrations, logs, deployments]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
