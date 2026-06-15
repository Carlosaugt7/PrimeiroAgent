// Aplicação de limites por plano (client-side guard).
import { getPlan, type PlanDef } from "@/lib/billing-plans";
import { notify } from "@/lib/notifications";

export type LimitKind = "agents" | "instances" | "members" | "messages";

const LABELS: Record<LimitKind, string> = {
  agents: "agentes",
  instances: "instâncias WhatsApp",
  members: "membros da equipe",
  messages: "mensagens no período",
};

// Features padrão mapeadas por plano
const PLAN_FEATURES: Record<string, string[]> = {
  trial: ["support_whatsapp"],
  basic: ["support_whatsapp"],
  starter: ["campaigns_csv", "templates_unlimited"],
  pro: [
    "campaigns_csv",
    "templates_unlimited",
    "contact_extractor",
    "export_csv_excel",
    "advanced_automations_api",
  ],
  enterprise: [
    "campaigns_csv",
    "templates_unlimited",
    "contact_extractor",
    "export_csv_excel",
    "advanced_automations_api",
    "anti_ban",
  ],
};

export function planLimits(planId?: string): PlanDef["limits"] {
  return (getPlan(planId ?? "trial") ?? getPlan("trial")!).limits;
}

export function planName(planId?: string): string {
  return (getPlan(planId ?? "trial") ?? getPlan("trial")!).name;
}

export interface LimitCheck {
  ok: boolean;
  limit: number;
  current: number;
  remaining: number;
  message?: string;
}

/** Verifica se um recurso (feature) está habilitado para o tenant. */
export function checkFeature(tenant: any, feature: string): boolean {
  if (!tenant) return false;
  
  // Verifica se a feature foi habilitada manualmente e individualmente nas configurações customizadas
  if (Array.isArray(tenant.enabledFeatures)) {
    if (tenant.enabledFeatures.includes(feature)) return true;
  }

  // Senão, recorre ao padrão do plano
  const planId = tenant.plan ?? "trial";
  const features = PLAN_FEATURES[planId] || [];
  return features.includes(feature);
}

export function checkLimit(
  kind: LimitKind,
  current: number,
  planIdOrTenant?: string | any,
  bypass?: boolean,
): LimitCheck {
  if (bypass) {
    return { ok: true, limit: Infinity, current, remaining: Infinity };
  }

  let planId = typeof planIdOrTenant === "string" ? planIdOrTenant : planIdOrTenant?.plan;
  const limits = planLimits(planId);
  let limit = limits[kind];

  // Aplica override se o tenant possuir limite customizado
  if (planIdOrTenant && typeof planIdOrTenant === "object") {
    if (kind === "agents" && typeof planIdOrTenant.maxAgents === "number") {
      limit = planIdOrTenant.maxAgents;
    } else if (kind === "messages" && typeof planIdOrTenant.maxMessages === "number") {
      limit = planIdOrTenant.maxMessages;
    } else if (kind === "instances" && typeof planIdOrTenant.maxInstances === "number") {
      limit = planIdOrTenant.maxInstances;
    }
  }

  const ok = current < limit;
  return {
    ok,
    limit,
    current,
    remaining: Math.max(0, limit - current),
    message: ok
      ? undefined
      : `Limite do plano ${planName(planId)} atingido: ${limit} ${LABELS[kind]}.`,
  };
}

/** Garante que a ação cabe no plano. Retorna true se ok, false (e notifica) se atingido.
 *  Use `bypass` (ex.: Master Admin) para ignorar limites. */
export function ensureLimit(
  tenantId: string,
  planIdOrTenant: string | any | undefined,
  kind: LimitKind,
  current: number,
  bypass?: boolean,
): LimitCheck {
  const r = checkLimit(kind, current, planIdOrTenant, bypass);
  if (!r.ok) {
    const planId = typeof planIdOrTenant === "string" ? planIdOrTenant : planIdOrTenant?.plan;
    notify(tenantId, {
      type: "limit_reached",
      severity: "warning",
      title: `Limite de ${LABELS[kind]} atingido`,
      body: `${r.message} Faça upgrade para continuar.`,
      link: "/app/billing",
      meta: { kind, current, limit: r.limit, plan: planId },
    });
  }
  return r;
}
