/**
 * Shared billing helpers used by both asaas-webhook and mp-webhook.
 * Centralizes the logic to avoid duplication.
 */

/**
 * Maps a payment amount (BRL) to a plan ID.
 * Thresholds must match the values in billing-plans.ts.
 */
export function planFromAmount(value: number): string | null {
  if (value >= 297) return "pro";
  if (value >= 97) return "starter";
  return null;
}

/**
 * Parses an external reference string of the form "tenant:<id>|plan:<id>"
 * and returns the individual parts.
 */
export function parseRef(ref: string | null): { tenantId?: string; planId?: string } {
  if (!ref) return {};
  const out: Record<string, string> = {};
  for (const part of ref.split("|")) {
    const [k, v] = part.split(":");
    if (k && v) out[k] = v;
  }
  return { tenantId: out.tenant, planId: out.plan };
}
