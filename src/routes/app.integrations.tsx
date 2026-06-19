import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  testEvolutionConnection,
  getGlobalEvolutionSettings,
  updateGlobalEvolutionSettings,
} from "@/lib/evolution.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Lock, Save, Wifi, WifiOff, Crown, Mic } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/integrations")({ component: Page });

function Page() {
  const { isMaster, tenant } = useAuth();
  const testConn = useServerFn(testEvolutionConnection);
  const getGlobal = useServerFn(getGlobalEvolutionSettings);
  const updateGlobal = useServerFn(updateGlobalEvolutionSettings);

  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // ElevenLabs
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [savingElevenlabs, setSavingElevenlabs] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (isMaster) {
          const cfg = await getGlobal({});
          setUrl(cfg.url);
          setKey(cfg.key);
          if (cfg.url && cfg.key) {
            const res = await testConn({ data: { url: cfg.url, key: cfg.key } });
            setStatus(res.ok ? "connected" : "disconnected");
          }
        }
        
        // Carrega a chave ElevenLabs do tenant atual
        if (tenant?.id) {
          const { data, error } = await supabase
            .from("tenants")
            .select("elevenlabsApiKey")
            .eq("id", tenant.id)
            .single();
          if (data && !error) {
            setElevenlabsKey((data.elevenlabsApiKey as string) ?? "");
          }
        }
      } catch {
        setStatus("disconnected");
      } finally {
        setLoading(false);
      }
    })();
  }, [isMaster, tenant?.id]);

  const handleTest = async () => {
    if (!url || !key) { toast.error("Preencha a URL e a API Key antes de testar."); return; }
    setTesting(true);
    setStatus("unknown");
    try {
      const res = await testConn({ data: { url, key } });
      if (res.ok) { setStatus("connected"); toast.success("Conexão estabelecida!"); }
      else { setStatus("disconnected"); toast.error(`Falha: ${res.error}`); }
    } catch { setStatus("disconnected"); toast.error("Erro ao testar conexão."); }
    finally { setTesting(false); }
  };

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) { toast.error("URL e API Key são obrigatórios."); return; }
    setSaving(true);
    try {
      await updateGlobal({ data: { url: url.trim(), key: key.trim() } });
      toast.success("Configuração global salva! Todos os clientes passarão a usar automaticamente.");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveElevenlabs = async () => {
    if (!tenant?.id) return;
    setSavingElevenlabs(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ elevenlabsApiKey: elevenlabsKey.trim() })
        .eq("id", tenant.id);
      
      if (error) throw error;
      toast.success("Chave do ElevenLabs salva com sucesso!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar chave.");
    } finally {
      setSavingElevenlabs(false);
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
          {isMaster 
            ? "Configuração global da plataforma — aplicada automaticamente a todos os clientes."
            : "Integrações externas do seu workspace."}
        </p>
      </div>

      {/* CARD EVOLUTION API (WHATSAPP) */}
      {isMaster ? (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="size-4 text-amber-400" />
                  Evolution API (WhatsApp) — Config Global
                </CardTitle>
                <CardDescription>
                  Esta configuração é compartilhada com todos os tenants da plataforma. Nenhum
                  cliente precisa configurar individualmente.
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
                placeholder="https://evolution-api.seudominio.com"
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
                {saving ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
                Salvar para todos os clientes
              </Button>
              <Button variant="outline" onClick={handleTest} disabled={testing || !url || !key}>
                {testing ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Wifi className="size-4 mr-1.5" />}
                Testar Conexão
              </Button>
            </div>
            <p className="text-xs text-muted-foreground pt-1">
              Clientes com configuração própria continuam usando a deles. Os demais herdam esta configuração automaticamente.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-emerald-500/10 grid place-items-center">
                <Wifi className="size-5 text-emerald-400" />
              </div>
              <div>
                <CardTitle>Evolution API (WhatsApp)</CardTitle>
                <CardDescription>Integração gerenciada pela plataforma.</CardDescription>
              </div>
              <Badge className="ml-auto bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 py-1">
                <Wifi className="size-3.5" /> Ativo
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 rounded-xl border border-border bg-secondary/30 p-4">
              <Lock className="size-4 mt-0.5 text-muted-foreground shrink-0" />
              <p className="text-sm text-muted-foreground">
                A integração com o Evolution API é configurada globalmente pelo administrador da
                plataforma. Você não precisa fazer nada — basta criar suas instâncias WhatsApp
                normalmente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CARD ELEVENLABS (VOZ DE IA) */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-blue-500/10 grid place-items-center">
              <Mic className="size-5 text-blue-400" />
            </div>
            <div>
              <CardTitle>ElevenLabs (Voz de IA)</CardTitle>
              <CardDescription>
                Configure sua chave de API do ElevenLabs para permitir respostas em áudio gravado nos agentes.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="elevenlabsKey">ElevenLabs API Key</Label>
            <Input
              id="elevenlabsKey"
              type="password"
              placeholder="Insira sua ElevenLabs API Key"
              value={elevenlabsKey}
              onChange={(e) => setElevenlabsKey(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Você pode encontrar a sua chave no painel da sua conta do ElevenLabs (My Account &gt; API Key).
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSaveElevenlabs} disabled={savingElevenlabs}>
              {savingElevenlabs ? <Loader2 className="size-4 animate-spin mr-1.5" /> : <Save className="size-4 mr-1.5" />}
              Salvar Configuração de Voz
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
