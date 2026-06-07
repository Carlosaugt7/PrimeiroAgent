import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth, type Role } from "@/lib/auth";
import { logAudit, notify } from "@/lib/notifications";
import { db } from "@/integrations/firebase/client";
import {
  collection, deleteDoc, doc, onSnapshot, orderBy, query, setDoc, updateDoc, where,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Crown, Mail, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/team")({
  head: () => ({ meta: [{ title: "Equipe — AgentHub AI" }] }),
  component: Team,
});

interface Member {
  uid: string;
  email: string;
  displayName: string;
  role: Role;
  joinedAt?: string;
}
interface Invite {
  id: string;
  email: string;
  role: Role;
  invitedBy?: string;
  invitedAt?: string;
}

const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  admin: "Admin",
  editor: "Editor",
  viewer: "Viewer",
  agent: "Agente",
};

function Team() {
  const { tenant, profile, isMaster } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>("agent");
  const [busy, setBusy] = useState(false);

  const canManage = profile?.role === "owner" || profile?.role === "admin";
  const isOwner = profile?.role === "owner";

  useEffect(() => {
    if (!tenant) return;
    const u1 = onSnapshot(
      query(collection(db, "tenants", tenant.id, "members"), orderBy("joinedAt", "asc")),
      (s) => setMembers(s.docs.map((d) => ({ uid: d.id, ...(d.data() as object) })) as Member[]),
    );
    const u2 = onSnapshot(
      query(collection(db, "invites"), where("tenantId", "==", tenant.id)),
      (s) => setInvites(s.docs.map((d) => ({ id: d.id, ...(d.data() as object) })) as Invite[]),
    );
    return () => { u1(); u2(); };
  }, [tenant]);

  const invite = async () => {
    if (!tenant || !canManage) return;
    const e = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)) return toast.error("E-mail inválido");
    if (members.some((m) => m.email.toLowerCase() === e)) return toast.error("Já é membro");
    if (invites.some((i) => i.email === e)) return toast.error("Convite já enviado");
    const { ensureLimit } = await import("@/lib/limits");
    const lim = ensureLimit(tenant.id, tenant.plan, "members", members.length + invites.length);
    if (!lim.ok) return toast.error(lim.message!);


    setBusy(true);
    try {
      const id = encodeURIComponent(e);
      await setDoc(doc(db, "invites", id), {
        email: e,
        tenantId: tenant.id,
        tenantName: tenant.name,
        role,
        invitedBy: profile?.email ?? null,
        invitedAt: new Date().toISOString(),
      });
      toast.success(`Convite criado para ${e}. Peça que faça login com esse e-mail.`);
      const actor = { actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName };
      logAudit(tenant.id, { action: "member.invite", target: id, targetLabel: e, ...actor, meta: { role } });
      notify(tenant.id, { type: "team", severity: "info", title: "Novo convite enviado", body: `${e} foi convidado como ${role}.`, link: "/app/team" });
      setEmail("");
    } catch (err: any) {
      toast.error(err?.message ?? "Falha ao convidar");
    } finally { setBusy(false); }
  };

  const cancelInvite = async (id: string) => {
    await deleteDoc(doc(db, "invites", id));
    if (tenant) logAudit(tenant.id, { action: "member.invite_cancel", target: id, actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName });
  };

  const changeRole = async (m: Member, newRole: Role) => {
    if (!tenant || !isOwner) return;
    if (m.role === "owner") return toast.error("Owner não pode ser alterado");
    await updateDoc(doc(db, "tenants", tenant.id, "members", m.uid), { role: newRole });
    try { await updateDoc(doc(db, "users", m.uid), { role: newRole }); } catch {}
    toast.success("Papel atualizado");
    logAudit(tenant.id, { action: "member.role_change", target: m.uid, targetLabel: m.email, actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName, meta: { from: m.role, to: newRole } });
    notify(tenant.id, { type: "team", severity: "warning", title: "Papel alterado", body: `${m.email}: ${m.role} → ${newRole}`, link: "/app/team" });
  };

  const removeMember = async (m: Member) => {
    if (!tenant || !isOwner) return;
    if (m.uid === profile?.uid) return toast.error("Você não pode remover a si mesmo");
    if (m.role === "owner") return toast.error("Owner não pode ser removido");
    if (!confirm(`Remover ${m.displayName || m.email}?`)) return;
    await deleteDoc(doc(db, "tenants", tenant.id, "members", m.uid));
    toast.success("Membro removido. Ele perderá acesso ao reentrar.");
    logAudit(tenant.id, { action: "member.remove", target: m.uid, targetLabel: m.email, actorId: profile?.uid, actorEmail: profile?.email, actorName: profile?.displayName });
    notify(tenant.id, { type: "team", severity: "warning", title: "Membro removido", body: m.email, link: "/app/team" });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold flex items-center gap-2">
          <Users className="size-7 text-primary" /> Equipe
        </h1>
        <p className="text-muted-foreground mt-1">Convide membros e gerencie papéis no workspace.</p>
      </div>

      {/* Convite */}
      <div className="rounded-2xl border border-border bg-card/30 p-5">
        <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
          <UserPlus className="size-4" /> Convidar membro
        </h2>
        {!canManage ? (
          <p className="text-sm text-muted-foreground">Apenas owner/admin pode convidar.</p>
        ) : (
          <div className="grid sm:grid-cols-[1fr_180px_auto] gap-2">
            <div>
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </div>
            <div>
              <Label className="text-xs">Papel</Label>
              <Select value={role} onValueChange={(v) => setRole(v as Role)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="editor">Editor</SelectItem>
                  <SelectItem value="agent">Agente</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={invite} disabled={busy}>
                <UserPlus className="size-4" /> Convidar
              </Button>
            </div>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground mt-2">
          O convidado entra ao fazer login com esse mesmo e-mail (qualquer método). O convite é consumido automaticamente.
        </p>
      </div>

      {/* Convites pendentes */}
      {invites.length > 0 && (
        <div className="rounded-2xl border border-border bg-card/30 p-5">
          <h2 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <Mail className="size-4" /> Pendentes ({invites.length})
          </h2>
          <ul className="divide-y divide-border">
            {invites.map((i) => (
              <li key={i.id} className="py-2 flex items-center gap-3">
                <span className="flex-1 text-sm">{i.email}</span>
                <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[i.role]}</Badge>
                {canManage && (
                  <Button size="icon" variant="ghost" onClick={() => cancelInvite(i.id)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Membros */}
      <div className="rounded-2xl border border-border bg-card/30 p-5">
        <h2 className="font-semibold text-sm mb-3">Membros ({members.length})</h2>
        {members.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum membro carregado ainda.</p>
        ) : (
          <ul className="divide-y divide-border">
            {members.map((m) => (
              <li key={m.uid} className="py-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm flex items-center gap-2">
                    {m.role === "owner" && <Crown className="size-3.5 text-amber-500" />}
                    {m.displayName || m.email}
                    {m.uid === profile?.uid && <Badge variant="secondary" className="text-[10px]">você</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground">{m.email}</div>
                </div>
                {isOwner && m.role !== "owner" ? (
                  <Select value={m.role} onValueChange={(v) => changeRole(m, v as Role)}>
                    <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="editor">Editor</SelectItem>
                      <SelectItem value="agent">Agente</SelectItem>
                      <SelectItem value="viewer">Viewer</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <Badge variant="outline" className="text-[10px]">{ROLE_LABEL[m.role]}</Badge>
                )}
                {isOwner && m.role !== "owner" && m.uid !== profile?.uid && (
                  <Button size="icon" variant="ghost" onClick={() => removeMember(m)}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
