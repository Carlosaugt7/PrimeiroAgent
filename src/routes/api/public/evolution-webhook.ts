import { createFileRoute } from "@tanstack/react-router";

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

        // Lazy-load: o módulo só carrega no runtime do handler (evita quebrar SSR de páginas)
        const { getDoc, setDoc, FieldValue } = await import("@/lib/firebase-admin.server");

        const idx = await getDoc(`instance_index/${instanceName}`);
        const tenantId: string | undefined = idx?.tenantId;
        if (!tenantId) return new Response("unknown instance", { status: 200 });

        if (event.includes("CONNECTION")) {
          const state = body?.data?.state ?? body?.state ?? "unknown";
          await setDoc(`tenants/${tenantId}/instances/${instanceName}`, {
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

          const convPath = `tenants/${tenantId}/conversations/${convId}`;
          await setDoc(convPath, {
            id: convId,
            instanceName,
            contactName: pushName,
            contactPhone: remoteJid.split("@")[0],
            remoteJid,
            lastMessage: text.slice(0, 200),
            updatedAt: new Date().toISOString(),
            status: "aberta",
            ...(fromMe ? { unread: 0 } : { unread: FieldValue.increment(1) }),
          }, { merge: true });

          await setDoc(`${convPath}/messages/${messageId}`, {
            id: messageId,
            text,
            fromMe,
            createdAt: new Date().toISOString(),
          }, { merge: true });

          return Response.json({ ok: true });
        }

        return Response.json({ ok: true, ignored: event });
      },
    },
  },
});
