// Helpers de notificações & auditoria — client-side (Firestore).
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/integrations/firebase/client";

export type NotificationSeverity = "info" | "success" | "warning" | "error";
export type NotificationType =
  | "handoff" | "ai_failure" | "instance_down" | "limit_reached"
  | "billing" | "system" | "team" | "automation";

export interface NotificationInput {
  type: NotificationType;
  title: string;
  body?: string;
  severity?: NotificationSeverity;
  link?: string;
  meta?: Record<string, unknown>;
}

export async function notify(tenantId: string, n: NotificationInput) {
  try {
    await addDoc(collection(db, "tenants", tenantId, "notifications"), {
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      severity: n.severity ?? "info",
      link: n.link ?? null,
      meta: n.meta ?? null,
      read: false,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.warn("[notify] falhou:", e); }
}

export interface AuditEntry {
  action: string;            // ex: "agent.update", "member.invite", "role.change"
  target?: string;           // id ou path do recurso
  targetLabel?: string;      // nome humano
  actorId?: string;
  actorEmail?: string;
  actorName?: string;
  meta?: Record<string, unknown>;
}

export async function logAudit(tenantId: string, entry: AuditEntry) {
  try {
    await addDoc(collection(db, "tenants", tenantId, "audit"), {
      action: entry.action,
      target: entry.target ?? null,
      targetLabel: entry.targetLabel ?? null,
      actorId: entry.actorId ?? null,
      actorEmail: entry.actorEmail ?? null,
      actorName: entry.actorName ?? null,
      meta: entry.meta ?? null,
      createdAt: serverTimestamp(),
    });
  } catch (e) { console.warn("[logAudit] falhou:", e); }
}
