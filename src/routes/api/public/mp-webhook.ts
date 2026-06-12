import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";
import { planFromAmount, parseRef } from "@/lib/billing-helpers";

// Mercado Pago envia notificações (topic=payment) com o paymentId em data.id.
// Buscamos o pagamento na API com MERCADOPAGO_ACCESS_TOKEN para validar o status real.

export const Route = createFileRoute("/api/public/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const url = new URL(request.url);
          let topic = url.searchParams.get("type") ?? url.searchParams.get("topic") ?? "";
          let id = url.searchParams.get("data.id") ?? url.searchParams.get("id") ?? "";

          let body: any = {};
          try {
            body = await request.json();
          } catch {}
          topic = topic || body?.type || body?.topic || "";
          id = id || body?.data?.id || body?.resource?.toString().split("/").pop() || "";

          if (!id || !topic.includes("payment")) {
            return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });
          }

          const token = process.env.MERCADOPAGO_ACCESS_TOKEN;
          if (!token) {
            console.error("[mp-webhook] MERCADOPAGO_ACCESS_TOKEN ausente");
            return new Response(JSON.stringify({ ok: false }), { status: 200 });
          }

          const r = await fetch(`https://api.mercadopago.com/v1/payments/${id}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!r.ok) {
            console.error("[mp-webhook] busca pagamento falhou:", r.status, await r.text());
            return new Response(JSON.stringify({ ok: false }), { status: 200 });
          }
          const pay = (await r.json()) as {
            id: number;
            status: string;
            transaction_amount: number;
            external_reference?: string;
            payment_method_id?: string;
            date_approved?: string;
            metadata?: { tenantId?: string; planId?: string };
          };

          const ref = parseRef(pay.external_reference ?? null);
          const tenantId = ref.tenantId ?? pay.metadata?.tenantId;
          const planId = ref.planId ?? pay.metadata?.planId;
          if (!tenantId) {
            console.warn("[mp-webhook] sem tenantId", pay);
            return new Response(JSON.stringify({ ok: true }), { status: 200 });
          }

          const paid = pay.status === "approved";
          const status = paid ? "paid" : pay.status;

          await supabase.from("invoices").upsert({
            id: String(pay.id),
            tenantId,
            provider: "mercadopago",
            externalId: String(pay.id),
            planId: planId ?? null,
            amount: pay.transaction_amount,
            status,
            billingType: pay.payment_method_id ?? null,
            paidAt: pay.date_approved ?? null,
            updatedAt: new Date().toISOString(),
          });

          if (paid) {
            const finalPlan = planId ?? planFromAmount(pay.transaction_amount);
            if (finalPlan) {
              await supabase
                .from("tenants")
                .update({
                  plan: finalPlan,
                  status: "active",
                  lastPaymentAt: new Date().toISOString(),
                  billingProvider: "mercadopago",
                })
                .eq("id", tenantId);
            }
          }

          return new Response(JSON.stringify({ ok: true }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        } catch (e) {
          console.error("[mp-webhook] erro:", e);
          return new Response(JSON.stringify({ ok: false }), { status: 200 });
        }
      },
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
