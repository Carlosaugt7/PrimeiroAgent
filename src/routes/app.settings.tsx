import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Save, KeyRound } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/settings")({ component: Settings });

function Settings() {
  const { profile, tenant, signOut } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    if (profile?.displayName) {
      setDisplayName(profile.displayName);
    }
  }, [profile]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("O nome não pode estar vazio");
      return;
    }
    setSavingProfile(true);
    try {
      const { error } = await supabase
        .from("users")
        .update({ displayName: displayName.trim() })
        .eq("uid", profile?.uid);
      if (error) throw error;
      toast.success("Perfil atualizado com sucesso! Recarregando página...");
      setTimeout(() => window.location.reload(), 800);
    } catch (e: any) {
      toast.error(`Falha ao salvar perfil: ${e.message}`);
    } finally {
      setSavingProfile(false);
    }
  };

  const handleSavePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error("Informe a nova senha");
      return;
    }
    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: password.trim() });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(`Falha ao alterar senha: ${e.message}`);
    } finally {
      setSavingPassword(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Configurações</h1>
        <p className="text-muted-foreground mt-1">Dados do workspace e da conta.</p>
      </div>

      <Section title="Workspace">
        <Field label="Nome" value={tenant?.name ?? "—"} />
        <Field label="Plano" value={tenant?.plan ?? "—"} />
        <Field label="Status" value={tenant?.status ?? "—"} />
        <Field label="ID" value={tenant?.id ?? "—"} />
      </Section>

      <div className="grid gap-6 md:grid-cols-2">
        <Section title="Sua Conta">
          <form onSubmit={handleSaveProfile} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-email">E-mail (Login)</Label>
              <Input
                id="s-email"
                value={profile?.email ?? "—"}
                disabled
                className="bg-secondary/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-role">Papel / Acesso</Label>
              <Input
                id="s-role"
                value={profile?.role ?? "—"}
                disabled
                className="bg-secondary/40 capitalize"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-name">Nome de Exibição</Label>
              <Input
                id="s-name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Seu nome"
              />
            </div>
            <Button type="submit" disabled={savingProfile} className="w-full">
              {savingProfile ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Save className="size-4 mr-1.5" />
              )}
              Salvar Alterações
            </Button>
          </form>
        </Section>

        <Section title="Segurança (Senha)">
          <form onSubmit={handleSavePassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="s-pass">Nova Senha</Label>
              <Input
                id="s-pass"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="No mínimo 6 caracteres"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="s-conf">Confirmar Nova Senha</Label>
              <Input
                id="s-conf"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha"
              />
            </div>
            <Button
              type="submit"
              variant="outline"
              disabled={savingPassword}
              className="w-full border-primary/30 text-foreground hover:bg-primary/10"
            >
              {savingPassword ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <KeyRound className="size-4 mr-1.5" />
              )}
              Alterar Senha
            </Button>
          </form>
        </Section>
      </div>

      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
        <p className="font-semibold text-destructive">Encerrar sessão</p>
        <p className="text-xs text-muted-foreground mt-1">Você precisará entrar novamente.</p>
        <Button
          variant="outline"
          className="mt-3 border-destructive/40 text-destructive"
          onClick={signOut}
        >
          Sair
        </Button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-gradient-card border border-border p-6">
      <h2 className="font-display font-semibold mb-4">{title}</h2>
      <div className="space-y-3">{children}</div>
    </div>
  );
}
function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm capitalize truncate">{value}</span>
    </div>
  );
}
