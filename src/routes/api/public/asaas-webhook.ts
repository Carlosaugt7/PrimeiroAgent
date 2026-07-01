import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";
import { planFromAmount, parseRef } from "@/lib/billing-helpers";

// Asaas envia o token configurado no painel via header `asaas-access-token`.
// Configure `ASAAS_WEBHOOK_TOKEN` igual ao token usado lá.

export const Route = createFileRoute("/api/public/asaas-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          let expected = process.env.ASAAS_WEBHOOK_TOKEN;
          try {
            const { data: gs } = await supabase
              .from("global_settings")
              .select("value")
              .eq("key", "asaasWebhookToken")
              .maybeSingle();
            if (gs?.value) expected = gs.value;
          } catch (e) {
            console.error("[asaas-webhook] erro ao obter token no global_settings:", e);
          }

          if (expected) {
            const got = request.headers.get("asaas-access-token");
            if (got !== expected) return new Response("unauthorized", { status: 401 });
          }

          const body = (await request.json()) as {
            event?: string;
            payment?: {
              id: string;
              status: string;
              value: number;
              netValue?: number;
              billingType?: string;
              externalReference?: string;
              customer?: string;
              invoiceUrl?: string;
              dueDate?: string;
              paymentDate?: string;
            };
          };

          const ev = body.event ?? "";
          const p = body.payment;
          if (!p) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

          const { tenantId, planId } = parseRef(p.externalReference ?? null);
          if (!tenantId) {
            console.warn("[asaas-webhook] sem tenantId em externalReference:", p.externalReference);
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }

          const paid =
            ev === "PAYMENT_CONFIRMED" ||
            ev === "PAYMENT_RECEIVED" ||
            p.status === "CONFIRMED" ||
            p.status === "RECEIVED";
          const status = paid ? "paid" : (p.status?.toLowerCase() ?? "pending");

          // Registra fatura
          await supabase.from("invoices").upsert({
            id: p.id,
            tenantId,
            provider: "asaas",
            externalId: p.id,
            planId: planId ?? null,
            amount: p.value,
            netValue: p.netValue ?? null,
            status,
            billingType: p.billingType ?? null,
            invoiceUrl: p.invoiceUrl ?? null,
            dueDate: p.dueDate ?? null,
            paidAt: p.paymentDate ?? null,
            event: ev,
            updatedAt: new Date().toISOString(),
          });

          // Atualiza intent
          try {
            await supabase.from("billing_intents").upsert({
              id: p.id,
              tenantId,
              status,
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {}

          // Promove plano do tenant se pago
          if (paid) {
            const finalPlan = planId ?? planFromAmount(p.value);
            if (finalPlan) {
              await supabase
                .from("tenants")
                .update({
                  plan: finalPlan,
                  status: "active",
                  lastPaymentAt: new Date().toISOString(),
                  billingProvider: "asaas",
                })
                .eq("id", tenantId);
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("[asaas-webhook] erro:", e);
          return new Response(JSON.stringify({ ok: false, error: String(e) }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});
