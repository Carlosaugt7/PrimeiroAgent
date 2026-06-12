import { createServerFn } from "@tanstack/react-start";
import { getPlan, type BillingProvider, type PlanId } from "@/lib/billing-plans";
import { supabase } from "@/integrations/supabase/client";

// ---------- Asaas ----------

function asaasBase() {
  return process.env.ASAAS_ENV === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}
function asaasKey() {
  const k = process.env.ASAAS_API_KEY;
  if (!k) throw new Error("ASAAS_API_KEY ausente");
  return k;
}

async function asaas<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`${asaasBase()}${path}`, {
    ...init,
    headers: {
      access_token: asaasKey(),
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`Asaas ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

// ---------- Mercado Pago ----------

function mpToken() {
  const t = process.env.MERCADOPAGO_ACCESS_TOKEN;
  if (!t) throw new Error("MERCADOPAGO_ACCESS_TOKEN ausente");
  return t;
}

async function mp<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch(`https://api.mercadopago.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${mpToken()}`,
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    },
  });
  const text = await r.text();
  if (!r.ok) throw new Error(`MercadoPago ${r.status}: ${text.slice(0, 400)}`);
  return JSON.parse(text) as T;
}

// ---------- Server functions ----------

interface CheckoutInput {
  provider: BillingProvider;
  planId: PlanId;
  tenantId: string;
  customer: { name: string; email: string; phone?: string; cpfCnpj?: string };
  successUrl?: string;
}

interface CheckoutResult {
  url: string;
  externalId: string;
}

export const createCheckout = createServerFn({ method: "POST" })
  .inputValidator((d: CheckoutInput) => {
    if (!d?.provider || (d.provider !== "asaas" && d.provider !== "mercadopago"))
      throw new Error("provider inválido");
    if (!d?.planId) throw new Error("planId obrigatório");
    if (!d?.tenantId) throw new Error("tenantId obrigatório");
    if (!d?.customer?.email) throw new Error("email do cliente obrigatório");
    if (!d?.customer?.name) throw new Error("nome do cliente obrigatório");
    return d;
  })
  .handler(async ({ data }): Promise<CheckoutResult> => {
    const plan = getPlan(data.planId);
    if (!plan) throw new Error("Plano não encontrado");
    if (plan.priceBRL <= 0) throw new Error("Este plano não usa checkout automático");

    const ref = `tenant:${data.tenantId}|plan:${data.planId}|t:${Date.now()}`;

    if (data.provider === "asaas") {
      // 1) Cria/identifica cliente
      const cust = await asaas<{ id: string }>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: data.customer.name,
          email: data.customer.email,
          mobilePhone: data.customer.phone,
          cpfCnpj: data.customer.cpfCnpj,
          externalReference: data.tenantId,
        }),
      });
      // 2) Cria payment com checkout link
      const due = new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10);
      const pay = await asaas<{ id: string; invoiceUrl: string }>("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer: cust.id,
          billingType: "UNDEFINED", // deixa o cliente escolher PIX/Boleto/Cartão
          value: plan.priceBRL,
          dueDate: due,
          description: `AgentFlow IA — Plano ${plan.name}`,
          externalReference: ref,
        }),
      });
      // 3) Registra intent em Supabase
      try {
        await supabase.from("billing_intents").upsert({
          id: pay.id,
          tenantId: data.tenantId,
          provider: "asaas",
          planId: data.planId,
          externalId: pay.id,
          status: "pending",
          amount: plan.priceBRL,
          createdAt: new Date().toISOString(),
          url: pay.invoiceUrl,
        });
      } catch (e) {
        console.warn("[billing] supabase intent skip:", e);
      }
      return { url: pay.invoiceUrl, externalId: pay.id };
    }

    // Mercado Pago
    const pref = await mp<{ id: string; init_point: string; sandbox_init_point: string }>(
      "/checkout/preferences",
      {
        method: "POST",
        body: JSON.stringify({
          items: [
            {
              title: `AgentFlow IA — Plano ${plan.name}`,
              quantity: 1,
              unit_price: plan.priceBRL,
              currency_id: "BRL",
            },
          ],
          payer: { name: data.customer.name, email: data.customer.email },
          external_reference: ref,
          metadata: { tenantId: data.tenantId, planId: data.planId },
          back_urls: data.successUrl
            ? { success: data.successUrl, failure: data.successUrl, pending: data.successUrl }
            : undefined,
        }),
      },
    );
    const useSandbox = process.env.MERCADOPAGO_ENV !== "production";
    const url = useSandbox ? pref.sandbox_init_point : pref.init_point;
    try {
      await supabase.from("billing_intents").upsert({
        id: pref.id,
        tenantId: data.tenantId,
        provider: "mercadopago",
        planId: data.planId,
        externalId: pref.id,
        status: "pending",
        amount: plan.priceBRL,
        createdAt: new Date().toISOString(),
        url,
      });
    } catch (e) {
      console.warn("[billing] supabase intent skip:", e);
    }
    return { url, externalId: pref.id };
  });
