// Catálogo de planos — compartilhado client + server.
export type PlanId = "trial" | "starter" | "pro" | "enterprise";

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
    description: "14 dias para experimentar tudo.",
    features: ["1 agente", "1 instância WhatsApp", "500 mensagens", "Suporte por e-mail"],
    limits: { agents: 1, messages: 500, instances: 1, members: 2 },
  },
  {
    id: "starter",
    name: "Starter",
    priceBRL: 97,
    description: "Para autônomos e pequenos times.",
    features: [
      "3 agentes",
      "2 instâncias",
      "5.000 mensagens/mês",
      "Templates ilimitados",
      "Suporte prioritário",
    ],
    limits: { agents: 3, messages: 5000, instances: 2, members: 5 },
    cta: "Assinar Starter",
  },
  {
    id: "pro",
    name: "Pro",
    priceBRL: 297,
    description: "Operações crescendo e múltiplos canais.",
    features: [
      "10 agentes",
      "5 instâncias",
      "30.000 mensagens/mês",
      "Automações avançadas",
      "Integrações + API",
    ],
    limits: { agents: 10, messages: 30000, instances: 5, members: 15 },
    cta: "Assinar Pro",
    highlight: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    priceBRL: 0,
    description: "Customização total, SLA e onboarding dedicado.",
    features: [
      "Agentes ilimitados",
      "Instâncias ilimitadas",
      "Mensagens sob consulta",
      "SSO/SAML",
      "SLA 99,9%",
    ],
    limits: { agents: 9999, messages: 9999999, instances: 9999, members: 9999 },
    cta: "Falar com vendas",
  },
];

export function getPlan(id: string): PlanDef | undefined {
  return PLANS.find((p) => p.id === id);
}

export type BillingProvider = "asaas" | "mercadopago";
