// Catálogo de planos — compartilhado client + server.
export type PlanId = "trial" | "basic" | "starter" | "pro" | "enterprise";

export interface PlanDef {
  id: PlanId;
  name: string;
  priceBRL: number; // 0 = free / sob consulta
  description: string;
  features: string[];
  limits: { agents: number; messages: number; instances: number; members: number };
  cta?: string;
  highlight?: boolean;
}

export const PLANS: PlanDef[] = [
  {
    id: "trial",
    name: "Trial",
    priceBRL: 0,
    description: "14 dias grátis para experimentar tudo.",
    features: ["1 agente ativo", "1 instância WhatsApp", "1.000 mensagens", "Suporte via WhatsApp"],
    limits: { agents: 1, messages: 1000, instances: 1, members: 2 },
  },
  {
    id: "basic",
    name: "Basic",
    priceBRL: 97,
    description: "Ideal para começar.",
    features: [
      "1 agente ativo",
      "1.000 mensagens",
      "1 instância WhatsApp",
      "Suporte via WhatsApp",
      "Grátis · 14 dias para experimentar",
    ],
    limits: { agents: 1, messages: 1000, instances: 1, members: 2 },
    cta: "Assinar Basic",
  },
  {
    id: "starter",
    name: "Starter",
    priceBRL: 197,
    description: "Autônomos e pequenos times.",
    features: [
      "2 agentes ativos",
      "3.000 mensagens/mês",
      "2 instâncias WhatsApp",
      "Campanhas por CSV",
      "Templates ilimitados",
      "Grátis · 14 dias para experimentar",
    ],
    limits: { agents: 2, messages: 3000, instances: 2, members: 5 },
    cta: "Assinar Starter",
  },
  {
    id: "pro",
    name: "Pro",
    priceBRL: 297,
    description: "Operações em crescimento.",
    features: [
      "4 agentes ativos",
      "6.000 mensagens/mês",
      "4 instâncias WhatsApp",
      "Campanhas por CSV",
      "Templates ilimitados",
      "Extrator de contatos (Agenda/Grupos)",
      "Exportação nativa CSV/Excel",
      "Automações avançadas + API",
      "Grátis · 14 dias para experimentar",
    ],
    limits: { agents: 4, messages: 6000, instances: 4, members: 10 },
    cta: "Assinar Pro",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceBRL: 0,
    description: "Customização total e SLA dedicado.",
    features: [
      "Agentes ilimitados",
      "Mensagens ilimitadas",
      "Instâncias ilimitadas",
      "Campanhas por CSV",
      "Templates ilimitados",
      "Extrator de contatos (Agenda/Grupos)",
      "Anti-Ban (Digitação por API)",
      "SLA 99,9% + Onboarding dedicado",
      "Grátis · 14 dias para experimentar",
    ],
    limits: { agents: 9999, messages: 9999999, instances: 9999, members: 9999 },
    cta: "Falar com vendas",
  },
];

export function getPlan(id: string): PlanDef | undefined {
  return PLANS.find((p) => p.id === id);
}

export type BillingProvider = "asaas" | "mercadopago";
