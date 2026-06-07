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

export function checkLimit(kind: LimitKind, current: number, planId?: string): LimitCheck {
  const limits = planLimits(planId);
  const limit = limits[kind];
  const ok = current < limit;
  return {
    ok,
    limit,
    current,
    remaining: Math.max(0, limit - current),
    message: ok ? undefined : `Limite do plano ${planName(planId)} atingido: ${limit} ${LABELS[kind]}.`,
  };
}

/** Garante que a ação cabe no plano. Retorna true se ok, false (e notifica) se atingido. */
export function ensureLimit(
  tenantId: string,
  planId: string | undefined,
  kind: LimitKind,
  current: number,
): LimitCheck {
  const r = checkLimit(kind, current, planId);
  if (!r.ok) {
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
