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

const seedAgents: Agent[] = [
  baseAgent({
    id: "ag_1", name: "Vendas E-commerce", description: "SDR para loja de moda",
    segment: "E-commerce", status: "online", whatsapp: "conectado", whatsappNumber: "+55 11 99999-1234",
    systemPrompt: "Você é um SDR especialista em moda feminina. Seja consultivo, breve e ofereça cupons quando relevante.",
    messages30d: 4820, conversions30d: 312, createdAt: "2026-04-12", knowledgeBaseIds: ["doc_1", "doc_2"],
    triggers: [
      { id: "tr1", type: "mensagem", label: "Mensagem recebida no WhatsApp", config: "qualquer contato", enabled: true },
      { id: "tr2", type: "cron", label: "Reengajar carrinho abandonado", config: "todo dia às 10:00", enabled: true },
    ],
    envVars: [{ id: "e1", key: "SHOP_API_TOKEN", value: "•••••••••••", secret: true }],
  }),
  baseAgent({
    id: "ag_2", name: "Atendimento Clínica", description: "Agendamentos e dúvidas",
    segment: "Saúde", status: "online", whatsapp: "conectado", whatsappNumber: "+55 11 98888-5678",
    temperature: 0.2,
    systemPrompt: "Você é a recepcionista virtual da Clínica Aurora. Tom acolhedor, confirme dados antes de agendar.",
    messages30d: 2150, conversions30d: 187, createdAt: "2026-05-02", knowledgeBaseIds: ["doc_3"],
  }),
  baseAgent({
    id: "ag_3", name: "Qualificação Imobiliária", description: "Captação de leads",
    segment: "Imobiliária", status: "treinando", whatsapp: "aguardando_qr",
    model: "gpt-4o", temperature: 0.6,
    systemPrompt: "Você qualifica leads para corretores. Pergunte sobre orçamento, região e prazo.",
    messages30d: 740, conversions30d: 41, createdAt: "2026-05-28",
  }),
];

const seedDocs: KnowledgeDoc[] = [
  { id: "doc_1", name: "Catálogo Outono 2026.pdf", type: "pdf", sizeKb: 4320, uploadedAt: "2026-04-14", agentId: "ag_1", indexProgress: 100, status: "indexado" },
  { id: "doc_2", name: "Política de Trocas.pdf", type: "pdf", sizeKb: 220, uploadedAt: "2026-04-14", agentId: "ag_1", indexProgress: 100, status: "indexado" },
  { id: "doc_3", name: "Procedimentos e Preços.xlsx", type: "planilha", sizeKb: 88, uploadedAt: "2026-05-02", agentId: "ag_2", indexProgress: 100, status: "indexado" },
  { id: "doc_4", name: "https://clinicaaurora.com.br/faq", type: "site", sizeKb: 0, uploadedAt: "2026-05-03", agentId: "ag_2", indexProgress: 64, status: "processando" },
];

const seedConvs: Conversation[] = [
  { id: "c1", agentId: "ag_1", contactName: "Mariana Costa", contactPhone: "+55 11 97000-1111", lastMessage: "Top, vou finalizar o pedido!", unread: 0, updatedAt: "há 2 min", status: "aberta" },
  { id: "c2", agentId: "ag_1", contactName: "Rafael Lima", contactPhone: "+55 11 97000-2222", lastMessage: "Tem o tamanho M dessa peça?", unread: 2, updatedAt: "há 8 min", status: "aberta" },
  { id: "c3", agentId: "ag_2", contactName: "Helena Souza", contactPhone: "+55 11 97000-3333", lastMessage: "Pode marcar terça às 14h?", unread: 1, updatedAt: "há 14 min", status: "aberta" },
  { id: "c4", agentId: "ag_2", contactName: "João Pedro", contactPhone: "+55 11 97000-4444", lastMessage: "Obrigado pelo atendimento!", unread: 0, updatedAt: "há 1 h", status: "resolvida" },
  { id: "c5", agentId: "ag_3", contactName: "Construtora Vega", contactPhone: "+55 11 97000-5555", lastMessage: "Preciso falar com humano", unread: 1, updatedAt: "há 3 h", status: "handoff" },
];

const seedUsers: TenantUser[] = [
  { id: "u1", name: "Ana Martins", email: "ana@acme.com", role: "owner" },
  { id: "u2", name: "Carlos Pereira", email: "carlos@acme.com", role: "admin" },
  { id: "u3", name: "Júlia Reis", email: "julia@acme.com", role: "editor" },
];

const seedIntegrations: Integration[] = [
  { id: "i1", name: "WhatsApp · Evolution API", kind: "whatsapp", status: "ativo", detail: "2 números conectados" },
  { id: "i2", name: "Webhook de saída", kind: "webhook", status: "ativo", detail: "https://hooks.acme.com/agent" },
  { id: "i3", name: "Telegram Bot", kind: "telegram", status: "inativo", detail: "Não configurado" },
  { id: "i4", name: "Slack", kind: "slack", status: "inativo", detail: "Não configurado" },
  { id: "i5", name: "API REST do agente", kind: "api", status: "ativo", detail: "Token: ah_sk_•••••••••••" },
];

const seedLogs: LogEntry[] = Array.from({ length: 24 }).map((_, i) => {
  const levels: LogEntry["level"][] = ["info", "info", "tool", "info", "warn", "info", "error", "info"];
  const msgs = [
    "Mensagem recebida do contato +55 11 97000-1111",
    "Tool web_search executada com sucesso",
    "Resposta gerada com 412 tokens",
    "RAG: 3 chunks recuperados da base",
    "Latência acima do esperado",
    "Conexão WhatsApp re-estabelecida",
    "Falha na chamada de tool http_request (timeout)",
    "Conversa marcada como resolvida",
  ];
  return {
    id: `lg_${i}`,
    ts: `${String(13 - Math.floor(i / 4)).padStart(2, "0")}:${String((i * 7) % 60).padStart(2, "0")}`,
    agentId: ["ag_1", "ag_2", "ag_3"][i % 3],
    level: levels[i % levels.length],
    message: msgs[i % msgs.length],
    durationMs: 200 + (i * 37) % 1800,
    tokens: 80 + (i * 23) % 600,
  };
});

const seedDeployments: Deployment[] = [
  { id: "d1", agentId: "ag_1", version: "v12", env: "prod", deployedAt: "2026-06-04 14:22", deployedBy: "Ana Martins", status: "ativo" },
  { id: "d2", agentId: "ag_1", version: "v13", env: "dev", deployedAt: "2026-06-06 09:10", deployedBy: "Carlos Pereira", status: "ativo" },
  { id: "d3", agentId: "ag_2", version: "v7", env: "prod", deployedAt: "2026-05-31 11:45", deployedBy: "Ana Martins", status: "ativo" },
  { id: "d4", agentId: "ag_3", version: "v2", env: "dev", deployedAt: "2026-06-05 18:30", deployedBy: "Júlia Reis", status: "ativo" },
];

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
