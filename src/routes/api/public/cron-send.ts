import { createFileRoute } from "@tanstack/react-router";

const EVO_BASE = "https://evolution-api.rsconsultoria.pro";

async function evoSendText(instanceName: string, number: string, text: string) {
  const key = process.env.EVOLUTION_API_KEY;
  if (!key) throw new Error("EVOLUTION_API_KEY ausente");
  const r = await fetch(`${EVO_BASE}/message/sendText/${encodeURIComponent(instanceName)}`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ number, text }),
  });
  if (!r.ok) throw new Error(`sendText ${r.status}: ${(await r.text()).slice(0, 200)}`);
}

async function run() {
  const fb = await import("@/lib/firebase-admin.server");
  const nowIso = new Date().toISOString();

  const tenants = await fb.listCollection("tenants", { pageSize: 500 });
  const results: any[] = [];

  for (const t of tenants) {
    const path = `tenants/${t.id}/scheduled_messages`;
    const items = await fb.listCollection(path, { pageSize: 200 });
    const due = items.filter(
      (m) => m.status === "pending" && typeof m.scheduledAt === "string" && m.scheduledAt <= nowIso,
    );

    for (const m of due) {
      try {
        if (!m.instanceName || !m.number || !m.text) throw new Error("dados incompletos");
        await evoSendText(m.instanceName, m.number, m.text);
        await fb.setDoc(`${path}/${m.id}`, { status: "sent", sentAt: new Date().toISOString() }, { merge: true });
        results.push({ tenant: t.id, id: m.id, ok: true });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await fb.setDoc(`${path}/${m.id}`, { status: "failed", error: msg, sentAt: new Date().toISOString() }, { merge: true });
        results.push({ tenant: t.id, id: m.id, ok: false, error: msg });
      }
    }
  }

  return { ranAt: nowIso, processed: results.length, results };
}

export const Route = createFileRoute("/api/public/cron-send")({
  server: {
    handlers: {
      GET: async ({ request }) => handle(request),
      POST: async ({ request }) => handle(request),
    },
  },
});

async function handle(request: Request) {
  const secret = process.env.CRON_SECRET;
  const provided = new URL(request.url).searchParams.get("key") ?? request.headers.get("x-cron-secret");
  if (!secret || provided !== secret) {
    return new Response("Unauthorized", { status: 401 });
  }
  try {
    const out = await run();
    return Response.json(out);
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
