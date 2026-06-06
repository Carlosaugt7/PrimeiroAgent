import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type AgentStatus = "online" | "offline" | "treinando";
export type WhatsAppStatus = "conectado" | "desconectado" | "aguardando_qr";

export interface Agent {
  id: string;
  name: string;
  description: string;
  segment: string;
  status: AgentStatus;
  whatsapp: WhatsAppStatus;
  whatsappNumber?: string;
  model: string;
  temperature: number;
  systemPrompt: string;
  messages30d: number;
  conversions30d: number;
  createdAt: string;
  knowledgeBaseIds: string[];
}

export interface KnowledgeDoc {
  id: string;
  name: string;
  type: "pdf" | "site" | "planilha" | "texto";
  sizeKb: number;
  uploadedAt: string;
  agentId?: string;
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

interface AppState {
  agents: Agent[];
  docs: KnowledgeDoc[];
  conversations: Conversation[];
  users: TenantUser[];
  plan: { name: string; price: string; renewsAt: string; messagesUsed: number; messagesLimit: number };
  createAgent: (a: Omit<Agent, "id" | "createdAt" | "messages30d" | "conversions30d" | "status" | "whatsapp" | "knowledgeBaseIds">) => string;
  updateAgent: (id: string, patch: Partial<Agent>) => void;
  deleteAgent: (id: string) => void;
  connectWhatsapp: (agentId: string, number: string) => void;
  addDoc: (d: Omit<KnowledgeDoc, "id" | "uploadedAt">) => void;
  removeDoc: (id: string) => void;
}

const seedAgents: Agent[] = [
  {
    id: "ag_1", name: "Vendas E-commerce", description: "SDR para loja de moda",
    segment: "E-commerce", status: "online", whatsapp: "conectado", whatsappNumber: "+55 11 99999-1234",
    model: "gpt-4o-mini", temperature: 0.4,
    systemPrompt: "Você é um SDR especialista em moda feminina. Seja consultivo, breve e ofereça cupons quando relevante.",
    messages30d: 4820, conversions30d: 312, createdAt: "2026-04-12", knowledgeBaseIds: ["doc_1", "doc_2"],
  },
  {
    id: "ag_2", name: "Atendimento Clínica", description: "Agendamentos e dúvidas",
    segment: "Saúde", status: "online", whatsapp: "conectado", whatsappNumber: "+55 11 98888-5678",
    model: "gpt-4o-mini", temperature: 0.2,
    systemPrompt: "Você é a recepcionista virtual da Clínica Aurora. Tom acolhedor, confirme dados antes de agendar.",
    messages30d: 2150, conversions30d: 187, createdAt: "2026-05-02", knowledgeBaseIds: ["doc_3"],
  },
  {
    id: "ag_3", name: "Qualificação Imobiliária", description: "Captação de leads",
    segment: "Imobiliária", status: "treinando", whatsapp: "aguardando_qr",
    model: "gpt-4o", temperature: 0.6,
    systemPrompt: "Você qualifica leads para corretores. Pergunte sobre orçamento, região e prazo.",
    messages30d: 740, conversions30d: 41, createdAt: "2026-05-28", knowledgeBaseIds: [],
  },
];

const seedDocs: KnowledgeDoc[] = [
  { id: "doc_1", name: "Catálogo Outono 2026.pdf", type: "pdf", sizeKb: 4320, uploadedAt: "2026-04-14", agentId: "ag_1" },
  { id: "doc_2", name: "Política de Trocas.pdf", type: "pdf", sizeKb: 220, uploadedAt: "2026-04-14", agentId: "ag_1" },
  { id: "doc_3", name: "Procedimentos e Preços.xlsx", type: "planilha", sizeKb: 88, uploadedAt: "2026-05-02", agentId: "ag_2" },
  { id: "doc_4", name: "https://clinicaaurora.com.br/faq", type: "site", sizeKb: 0, uploadedAt: "2026-05-03", agentId: "ag_2" },
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

const AppCtx = createContext<AppState | null>(null);

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const [agents, setAgents] = useState<Agent[]>(seedAgents);
  const [docs, setDocs] = useState<KnowledgeDoc[]>(seedDocs);
  const [conversations] = useState<Conversation[]>(seedConvs);
  const [users] = useState<TenantUser[]>(seedUsers);

  const value = useMemo<AppState>(() => ({
    agents, docs, conversations, users,
    plan: { name: "Pro", price: "R$ 597", renewsAt: "30/06/2026", messagesUsed: 7710, messagesLimit: 10000 },
    createAgent: (a) => {
      const id = `ag_${Date.now()}`;
      setAgents((prev) => [
        ...prev,
        { ...a, id, status: "offline", whatsapp: "desconectado", knowledgeBaseIds: [], messages30d: 0, conversions30d: 0, createdAt: new Date().toISOString().slice(0, 10) },
      ]);
      return id;
    },
    updateAgent: (id, patch) => setAgents((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a))),
    deleteAgent: (id) => setAgents((prev) => prev.filter((a) => a.id !== id)),
    connectWhatsapp: (agentId, number) => setAgents((prev) => prev.map((a) => a.id === agentId ? { ...a, whatsapp: "conectado", whatsappNumber: number, status: "online" } : a)),
    addDoc: (d) => setDocs((prev) => [...prev, { ...d, id: `doc_${Date.now()}`, uploadedAt: new Date().toISOString().slice(0, 10) }]),
    removeDoc: (id) => setDocs((prev) => prev.filter((d) => d.id !== id)),
  }), [agents, docs, conversations, users]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useAppStore() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppStore must be used inside AppStoreProvider");
  return ctx;
}
