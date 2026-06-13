import { createFileRoute, useNavigate, useRouterState, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Loader2, Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [{ title: "Entrar — AgentFlow IA" }] }),
  component: AuthPage,
});

function AuthPage() {
  const { user, signInEmail, signUpEmail, signInGoogle, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (user && pathname === "/") navigate({ to: "/app" });
  }, [user, pathname, navigate]);

  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    setBusy(true);
    try {
      if (mode === "login") await signInEmail(email, password);
      else await signUpEmail(email, password, name, company);
      navigate({ to: "/app" });
    } catch (e) {
      const error = e as Error;
      setErr(error?.message ?? "Falha na autenticação");
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
        <div className="w-full max-w-md">
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
                <Label htmlFor="password">Senha</Label>
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
                {busy && <Loader2 className="animate-spin size-4" />}
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
        </div>
      </div>
    </div>
  );
}
