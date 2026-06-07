import { createFileRoute } from "@tanstack/react-router";
import { adminDb, FieldValue } from "@/lib/firebase-admin.server";

export const Route = createFileRoute("/api/public/evolution-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let body: any;
        try { body = await request.json(); } catch { return new Response("invalid json", { status: 400 }); }

        const instanceName: string | undefined =
          body?.instance ?? body?.instanceName ?? body?.data?.instance ?? body?.sender;
        const event: string = (body?.event ?? body?.type ?? "").toString().toUpperCase();

        if (!instanceName) return new Response("missing instance", { status: 200 });

        const db = adminDb();

        // Lookup tenant via global index
        const idxSnap = await db.collection("instance_index").doc(instanceName).get();
        const tenantId = (idxSnap.data() as { tenantId?: string } | undefined)?.tenantId;
        if (!tenantId) return new Response("unknown instance", { status: 200 });

        const tenantRef = db.collection("tenants").doc(tenantId);

        if (event.includes("CONNECTION")) {
          const state = body?.data?.state ?? body?.state ?? "unknown";
          await tenantRef.collection("instances").doc(instanceName).set({
            name: instanceName,
            status: state === "open" ? "online" : state === "connecting" ? "conectando" : "offline",
            updatedAt: new Date().toISOString(),
          }, { merge: true });
          return Response.json({ ok: true });
        }

        if (event.includes("MESSAGES_UPSERT") || event.includes("MESSAGE")) {
          const m = body?.data ?? body?.message ?? body;
          const key = m?.key ?? {};
          const remoteJid: string | undefined = key.remoteJid ?? m?.remoteJid;
          if (!remoteJid) return new Response("no remoteJid", { status: 200 });

          const fromMe: boolean = !!key.fromMe;
          const messageId: string = key.id ?? `${Date.now()}`;
          const text: string =
            m?.message?.conversation ??
            m?.message?.extendedTextMessage?.text ??
            m?.text ??
            "[mídia]";
          const pushName: string = m?.pushName ?? remoteJid.split("@")[0];
          const convId = remoteJid.replace(/[^a-zA-Z0-9_-]/g, "_");

          const convRef = tenantRef.collection("conversations").doc(convId);
          await convRef.set({
            id: convId,
            instanceName,
            contactName: pushName,
            contactPhone: remoteJid.split("@")[0],
            remoteJid,
            lastMessage: text.slice(0, 200),
            updatedAt: new Date().toISOString(),
            status: "aberta",
            unread: fromMe ? 0 : FieldValue.increment(1),
          }, { merge: true });

          await convRef.collection("messages").doc(messageId).set({
            id: messageId,
            text,
            fromMe,
            createdAt: new Date().toISOString(),
            raw: m ?? null,
          }, { merge: true });

          return Response.json({ ok: true });
        }

        return Response.json({ ok: true, ignored: event });
      },
    },
  },
});
