import { createFileRoute, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Entrar — AgentFlow IA" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, signInEmail, signUpEmail, signInGoogle, loading, resetPassword } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const [mode, setMode] = useState<"login" | "signup" | "forgot_password" | "reset_password">(
    "login",
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [phone, setPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user && pathname === "/" && mode !== "reset_password") {
      navigate({ to: "/app" });
    }
  }, [user, pathname, navigate, mode]);

  useEffect(() => {
    // Detecta se o usuário veio de um link de recuperação
    if (typeof window !== "undefined") {
      const hash = window.location.hash;
      if (hash.includes("type=recovery") || hash.includes("access_token=")) {
        setMode("reset_password");
      }
    }
  }, []);

  const formatPhone = (value: string) => {
    if (!value) return "";
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 2) return `(${numbers}`;
    if (numbers.length <= 6) return `(${numbers.substring(0, 2)}) ${numbers.substring(2)}`;
    return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7, 11)}`;
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") {
        await signInEmail(email, password);
        navigate({ to: "/app" });
      } else if (mode === "signup") {
        await signUpEmail(email, password, name, company, phone);
        navigate({ to: "/app" });
      } else if (mode === "forgot_password") {
        await resetPassword(email);
        setResetSent(true);
        toast.success("E-mail de recuperação enviado!");
      } else if (mode === "reset_password") {
        const { error } = await supabase.auth.updateUser({ password: newPassword });
        if (error) throw error;
        toast.success("Senha atualizada com sucesso!");
        navigate({ to: "/app" });
      }
    } catch (e) {
      const error = e as Error;
      setErr(error?.message ?? "Falha na operação");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    setErr(null);
    setBusy(true);
    try {
      await signInGoogle();
      navigate({ to: "/app" });
    } catch (e) {
      const error = e as Error;
      setErr(error?.message ?? "Falha no Google");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="animate-spin size-6 text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="hidden lg:flex flex-col justify-between p-12 bg-gradient-to-br from-primary/10 via-background to-accent/10 border-r border-border">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-gradient-primary grid place-items-center shadow-glow">
            <Sparkles className="size-4 text-primary-foreground" />
          </div>
          <span className="font-display font-bold text-xl">
            AgentFlow<span className="text-gradient"> IA</span>
          </span>
        </Link>
        <div>
          <h1 className="font-display text-4xl font-bold leading-tight">
            Agentes de IA
            <br />
            para WhatsApp em minutos.
          </h1>
          <p className="text-muted-foreground mt-4 max-w-md">
            Multi-tenant, multi-LLM, integração nativa com Evolution API. Sem código, sem terminal.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">© AgentFlow IA — RS Consultoria</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-card/20 border border-border/60 p-8 rounded-2xl shadow-glow backdrop-blur-xl">
          {mode === "forgot_password" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Recuperar Senha</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Digite o seu e-mail cadastrado. Nós enviaremos um link de redefinição de senha
                  para você.
                </p>
              </div>

              {resetSent ? (
                <div className="space-y-4">
                  <div className="p-4 rounded-xl border border-success/30 bg-success/10 text-success text-sm space-y-2">
                    <p className="font-semibold">E-mail enviado!</p>
                    <p>
                      Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMode("login");
                      setResetSent(false);
                    }}
                    className="w-full"
                  >
                    Voltar para o Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={submit} className="space-y-4">
                  <div>
                    <Label htmlFor="forgot-email">E-mail</Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="exemplo@empresa.com"
                      className="mt-1"
                    />
                  </div>

                  {err && <p className="text-xs text-destructive">{err}</p>}

                  <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                    {busy && <Loader2 className="animate-spin size-4 mr-2" />}
                    Enviar Link de Recuperação
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setMode("login");
                      setErr(null);
                    }}
                    className="w-full"
                  >
                    Voltar para o Login
                  </Button>
                </form>
              )}
            </div>
          ) : mode === "reset_password" ? (
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-2xl font-bold mb-1">Definir Nova Senha</h2>
                <p className="text-sm text-muted-foreground mb-4">
                  Escolha uma nova senha forte com pelo menos 6 caracteres.
                </p>
              </div>

              <form onSubmit={submit} className="space-y-4">
                <div>
                  <Label htmlFor="new-password">Nova Senha</Label>
                  <div className="relative mt-1">
                    <Input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      minLength={6}
                      placeholder="Digite sua nova senha"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {err && <p className="text-xs text-destructive">{err}</p>}

                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin size-4 mr-2" />}
                  Atualizar Senha
                </Button>
              </form>
            </div>
          ) : (
            <Tabs value={mode} onValueChange={(v) => setMode(v as "login" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <h2 className="font-display text-2xl font-bold mb-1">Bem-vindo de volta</h2>
                <p className="text-sm text-muted-foreground mb-6">Acesse sua workspace.</p>
              </TabsContent>
              <TabsContent value="signup">
                <h2 className="font-display text-2xl font-bold mb-1">Crie sua workspace</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Você terá 14 dias grátis no plano Trial.
                </p>
              </TabsContent>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <>
                    <div>
                      <Label htmlFor="name">Seu nome</Label>
                      <Input
                        id="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="company">Empresa</Label>
                      <Input
                        id="company"
                        value={company}
                        onChange={(e) => setCompany(e.target.value)}
                        required
                        className="mt-1"
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone">Celular</Label>
                      <Input
                        id="phone"
                        value={phone}
                        onChange={(e) => setPhone(formatPhone(e.target.value))}
                        placeholder="(11) 99999-9999"
                        required
                        className="mt-1"
                        maxLength={15}
                      />
                    </div>
                  </>
                )}
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="mt-1"
                    autoComplete="off"
                    data-1p-ignore
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Senha</Label>
                    {mode === "login" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode("forgot_password");
                          setErr(null);
                        }}
                        className="text-xs text-accent hover:underline bg-transparent border-0 cursor-pointer"
                      >
                        Esqueci a senha
                      </button>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      minLength={6}
                      className="pr-10"
                      autoComplete="new-password"
                      data-1p-ignore
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus:outline-none"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                    </button>
                  </div>
                </div>

                {err && <p className="text-xs text-destructive">{err}</p>}

                <Button type="submit" variant="hero" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="animate-spin size-4 mr-2" />}
                  {mode === "login" ? "Entrar" : "Criar conta"}
                </Button>
              </form>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">ou</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={google}
                disabled={busy}
              >
                Continuar com Google
              </Button>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
}
