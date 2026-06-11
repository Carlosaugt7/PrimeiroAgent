import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { testEvolutionConnection } from "@/lib/evolution.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Wifi, WifiOff } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/app/integrations")({ component: Page });

function Page() {
  const { tenant } = useAuth();
  const testConn = useServerFn(testEvolutionConnection);

  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    if (!tenant?.id) return;
    const fetchConfig = async () => {
      const { data } = await supabase
        .from("tenants")
        .select("evolutionApiUrl, evolutionApiKey")
        .eq("id", tenant.id)
        .single();

      if (data) {
        const dbUrl = data.evolutionApiUrl || "";
        const dbKey = data.evolutionApiKey || "";
        setUrl(dbUrl);
        setKey(dbKey);
        if (dbUrl && dbKey) {
          try {
            const res = await testConn({ data: { url: dbUrl, key: dbKey } });
            if (res.ok) {
              setStatus("connected");
            } else {
              setStatus("disconnected");
            }
          } catch {
            setStatus("disconnected");
          }
        }
      }
      setLoading(false);
    };
    fetchConfig();
  }, [tenant?.id]);

  const handleTest = async () => {
    if (!url || !key) {
      toast.error("Preencha a URL e a API Key antes de testar.");
      return;
    }
    setTesting(true);
    setStatus("unknown");
    try {
      const res = await testConn({ data: { url, key } });
      if (res.ok) {
        setStatus("connected");
        toast.success("Conexão estabelecida com sucesso!");
      } else {
        setStatus("disconnected");
        toast.error(`Falha na conexão: ${res.error}`);
      }
    } catch (e) {
      setStatus("disconnected");
      toast.error("Erro ao testar conexão.");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          evolutionApiUrl: url.trim(),
          evolutionApiKey: key.trim(),
        })
        .eq("id", tenant.id);

      if (error) throw error;
      toast.success("Configurações salvas com sucesso!");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar configurações.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="font-display text-3xl font-bold">Integrações</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure suas integrações externas e webhooks.
        </p>
      </div>

      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <CardTitle>Evolution API (WhatsApp)</CardTitle>
              <CardDescription>
                Configure as credenciais do seu servidor Evolution API para conectar o WhatsApp de
                forma Multi-Tenant.
              </CardDescription>
            </div>
            {status === "connected" && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 py-1">
                <Wifi className="size-3.5" /> Conectado
              </Badge>
            )}
            {status === "disconnected" && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1.5 py-1">
                <WifiOff className="size-3.5" /> Falha na Conexão
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL da Evolution API</Label>
            <Input
              id="apiUrl"
              placeholder="https://evo.seudominio.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apiKey">Global API Key</Label>
            <Input
              id="apiKey"
              type="password"
              placeholder="Sua Global API Key"
              value={key}
              onChange={(e) => setKey(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Save className="size-4 mr-1.5" />
              )}
              Salvar Configuração
            </Button>
            <Button variant="outline" onClick={handleTest} disabled={testing || !url || !key}>
              {testing ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Wifi className="size-4 mr-1.5" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
