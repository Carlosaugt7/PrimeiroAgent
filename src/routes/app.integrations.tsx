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
import {
  saveGoogleIntegration,
  getGoogleIntegrations,
  testGoogleConnection,
  deleteGoogleIntegration,
} from "@/lib/google-integrations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getGlobalBillingSettings, updateGlobalBillingSettings } from "@/lib/master.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, Wifi, WifiOff, Crown, Mic, Calendar, Table } from "lucide-react";
import { toast } from "sonner";

interface GoogleIntegration {
  id: string;
  tenantId: string;
  serviceType: string;
  credentialsJson: string | null;
  calendarId: string | null;
  spreadsheetId: string | null;
  sheetName: string | null;
  title: string | null;
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const Route = createFileRoute("/app/integrations")({ component: Page });

function Page() {
  const { isMaster, tenant } = useAuth();
  const testConn = useServerFn(testEvolutionConnection);
  const getGlobal = useServerFn(getGlobalEvolutionSettings);
  const updateGlobal = useServerFn(updateGlobalEvolutionSettings);
  const saveGoogle = useServerFn(saveGoogleIntegration);
  const getGoogle = useServerFn(getGoogleIntegrations);
  const testGoogle = useServerFn(testGoogleConnection);
  const deleteGoogle = useServerFn(deleteGoogleIntegration);
  const getBillingSettings = useServerFn(getGlobalBillingSettings);
  const updateBillingSettings = useServerFn(updateGlobalBillingSettings);

  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");
  const [status, setStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Billing (Asaas / Mercado Pago)
  const [asaasApiKey, setAsaasApiKey] = useState("");
  const [asaasEnv, setAsaasEnv] = useState("sandbox");
  const [asaasWebhookToken, setAsaasWebhookToken] = useState("");
  const [mercadoPagoAccessToken, setMercadoPagoAccessToken] = useState("");
  const [savingBilling, setSavingBilling] = useState(false);

  // ElevenLabs
  const [elevenlabsKey, setElevenlabsKey] = useState("");
  const [savingElevenlabs, setSavingElevenlabs] = useState(false);

  // Google Calendar
  const [calCredentials, setCalCredentials] = useState("");
  const [calendarId, setCalendarId] = useState("primary");
  const [savingCal, setSavingCal] = useState(false);
  const [testingCal, setTestingCal] = useState(false);
  const [calStatus, setCalStatus] = useState<"unknown" | "connected" | "disconnected">("unknown");

  // Google Sheets (Múltiplas planilhas)
  const [sheetsList, setSheetsList] = useState<GoogleIntegration[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetCreds, setSheetCreds] = useState("");
  const [sheetSpreadId, setSheetSpreadId] = useState("");
  const [sheetTabName, setSheetTabName] = useState("Sheet1");
  const [savingSheets, setSavingSheets] = useState(false);
  const [testingSheets, setTestingSheets] = useState(false);
  const [testingSheetSingleId, setTestingSheetSingleId] = useState<string | null>(null);

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

          try {
            const session = (await supabase.auth.getSession()).data.session;
            if (session) {
              const bSettings = await getBillingSettings({
                data: { idToken: session.access_token },
              });
              setAsaasApiKey(bSettings.asaasApiKey);
              setAsaasEnv(bSettings.asaasEnv);
              setAsaasWebhookToken(bSettings.asaasWebhookToken);
              setMercadoPagoAccessToken(bSettings.mercadoPagoAccessToken);
            }
          } catch (billingErr) {
            console.error("Erro ao carregar configurações de pagamento:", billingErr);
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

          // Carrega integrações Google
          try {
            const { integrations } = await getGoogle({ data: { tenantId: tenant.id } });
            const sheets = [];
            for (const integ of integrations) {
              if (integ.serviceType === "calendar") {
                setCalCredentials(integ.credentialsJson || "");
                setCalendarId(integ.calendarId || "primary");
                if (integ.credentialsJson) setCalStatus("connected");
              }
              if (integ.serviceType === "sheets") {
                sheets.push(integ);
              }
            }
            setSheetsList(sheets);
          } catch {
            /* ignore */
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
        toast.success("Conexão estabelecida!");
      } else {
        setStatus("disconnected");
        toast.error(`Falha: ${res.error}`);
      }
    } catch {
      setStatus("disconnected");
      toast.error("Erro ao testar conexão.");
    } finally {
      setTesting(false);
    }
  };

  const handleSave = async () => {
    if (!url.trim() || !key.trim()) {
      toast.error("URL e API Key são obrigatórios.");
      return;
    }
    setSaving(true);
    try {
      await updateGlobal({ data: { url: url.trim(), key: key.trim() } });
      toast.success(
        "Configuração global salva! Todos os clientes passarão a usar automaticamente.",
      );
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

  // Google Calendar handlers
  const handleTestCal = async () => {
    if (!calCredentials.trim()) {
      toast.error("Cole o JSON da Service Account.");
      return;
    }
    setTestingCal(true);
    try {
      const res = await testGoogle({
        data: { credentialsJson: calCredentials, serviceType: "calendar", calendarId },
      });
      if (res.ok) {
        setCalStatus("connected");
        toast.success(`Conexão OK! ${res.info}`);
      } else {
        setCalStatus("disconnected");
        toast.error(res.error || "Falha na conexão");
      }
    } catch (e: unknown) {
      setCalStatus("disconnected");
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTestingCal(false);
    }
  };

  const handleSaveCal = async () => {
    if (!tenant?.id) return;
    setSavingCal(true);
    try {
      await saveGoogle({
        data: {
          tenantId: tenant.id,
          serviceType: "calendar",
          credentialsJson: calCredentials,
          calendarId,
        },
      });
      toast.success("Google Calendar configurado com sucesso!");
      setCalStatus("connected");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingCal(false);
    }
  };

  // Google Sheets handlers
  const refreshIntegrations = async () => {
    if (!tenant?.id) return;
    try {
      const { integrations } = await getGoogle({ data: { tenantId: tenant.id } });
      const sheets = [];
      for (const integ of integrations) {
        if (integ.serviceType === "calendar") {
          setCalCredentials(integ.credentialsJson || "");
          setCalendarId(integ.calendarId || "primary");
          if (integ.credentialsJson) setCalStatus("connected");
        }
        if (integ.serviceType === "sheets") {
          sheets.push(integ);
        }
      }
      setSheetsList(sheets);
    } catch {
      /* ignore */
    }
  };

  const handleOpenAddSheet = () => {
    setEditingSheetId(null);
    setSheetTitle("");
    setSheetCreds(calCredentials || "");
    setSheetSpreadId("");
    setSheetTabName("Sheet1");
    setDialogOpen(true);
  };

  const handleOpenEditSheet = (sheet: GoogleIntegration) => {
    setEditingSheetId(sheet.id);
    setSheetTitle(sheet.title || "");
    setSheetCreds(sheet.credentialsJson || "");
    setSheetSpreadId(sheet.spreadsheetId || "");
    setSheetTabName(sheet.sheetName || "Sheet1");
    setDialogOpen(true);
  };

  const handleTestSheetSingle = async (creds: string, spreadId: string, id: string | null) => {
    if (!creds.trim()) {
      toast.error("Cole o JSON da Service Account.");
      return;
    }
    if (!spreadId.trim()) {
      toast.error("Informe o ID da planilha.");
      return;
    }
    if (id) {
      setTestingSheetSingleId(id);
    } else {
      setTestingSheets(true);
    }
    try {
      const res = await testGoogle({
        data: { credentialsJson: creds, serviceType: "sheets", spreadsheetId: spreadId },
      });
      if (res.ok) {
        toast.success(`Conexão OK! ${res.info}`);
      } else {
        toast.error(res.error || "Falha na conexão");
      }
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro");
    } finally {
      setTestingSheetSingleId(null);
      setTestingSheets(false);
    }
  };

  const handleSaveSheetSingle = async () => {
    if (!tenant?.id) return;
    if (!sheetTitle.trim()) {
      toast.error("Informe o apelido/título da planilha.");
      return;
    }
    if (!sheetCreds.trim()) {
      toast.error("Cole o JSON da Service Account.");
      return;
    }
    if (!sheetSpreadId.trim()) {
      toast.error("Informe o ID da planilha.");
      return;
    }
    setSavingSheets(true);
    try {
      await saveGoogle({
        data: {
          id: editingSheetId || undefined,
          tenantId: tenant.id,
          serviceType: "sheets",
          credentialsJson: sheetCreds,
          title: sheetTitle,
          spreadsheetId: sheetSpreadId,
          sheetName: sheetTabName,
        },
      });
      toast.success("Planilha configurada com sucesso!");
      setDialogOpen(false);
      await refreshIntegrations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSavingSheets(false);
    }
  };

  const handleDeleteSheet = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta planilha?")) return;
    try {
      await deleteGoogle({ data: { id } });
      toast.success("Planilha excluída com sucesso.");
      await refreshIntegrations();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir planilha");
    }
  };

  const handleSaveBilling = async () => {
    setSavingBilling(true);
    try {
      const session = (await supabase.auth.getSession()).data.session;
      if (!session) throw new Error("Usuário não autenticado");
      await updateBillingSettings({
        data: {
          idToken: session.access_token,
          asaasApiKey,
          asaasEnv,
          asaasWebhookToken,
          mercadoPagoAccessToken,
        },
      });
      toast.success("Configurações globais de pagamento salvas!");
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar configurações de pagamento");
    } finally {
      setSavingBilling(false);
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

      {/* CARD EVOLUTION API (WHATSAPP) - Visível apenas no Painel Master */}
      {isMaster && (
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
                {saving ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="size-4 mr-1.5" />
                )}
                Salvar para todos os clientes
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
            <p className="text-xs text-muted-foreground pt-1">
              Clientes com configuração própria continuam usando a deles. Os demais herdam esta
              configuração automaticamente.
            </p>
          </CardContent>
        </Card>
      )}

      {isMaster && (
        <Card className="bg-gradient-card border-border">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Crown className="size-4 text-amber-400" />
              Configuração Global de Pagamentos (Asaas / Mercado Pago)
            </CardTitle>
            <CardDescription>
              Insira as credenciais de pagamento que serão usadas por todas as assinaturas
              automáticas da plataforma.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Seção Asaas */}
            <div className="space-y-4 border-b border-border/50 pb-4">
              <h3 className="text-sm font-semibold text-foreground">Integração Asaas</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="asaasEnv">Ambiente Asaas</Label>
                  <select
                    id="asaasEnv"
                    value={asaasEnv}
                    onChange={(e) => setAsaasEnv(e.target.value)}
                    className="w-full h-10 rounded-lg bg-secondary border border-border text-sm px-3 focus:outline-none focus:ring-1 focus:ring-ring"
                  >
                    <option value="sandbox">Homologação (Sandbox)</option>
                    <option value="production">Produção</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asaasApiKey">Asaas API Key</Label>
                  <Input
                    id="asaasApiKey"
                    type="password"
                    placeholder="Sua API Key do Asaas"
                    value={asaasApiKey}
                    onChange={(e) => setAsaasApiKey(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="asaasWebhookToken">Asaas Webhook Token</Label>
                <Input
                  id="asaasWebhookToken"
                  type="password"
                  placeholder="Token configurado na fila de webhooks do Asaas"
                  value={asaasWebhookToken}
                  onChange={(e) => setAsaasWebhookToken(e.target.value)}
                />
              </div>
            </div>

            {/* Seção Mercado Pago */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-foreground">Integração Mercado Pago</h3>
              <div className="space-y-2">
                <Label htmlFor="mpToken">Mercado Pago Access Token</Label>
                <Input
                  id="mpToken"
                  type="password"
                  placeholder="Seu Access Token do Mercado Pago (prod ou sandbox)"
                  value={mercadoPagoAccessToken}
                  onChange={(e) => setMercadoPagoAccessToken(e.target.value)}
                />
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <Button onClick={handleSaveBilling} disabled={savingBilling}>
                {savingBilling ? (
                  <Loader2 className="size-4 animate-spin mr-1.5" />
                ) : (
                  <Save className="size-4 mr-1.5" />
                )}
                Salvar Configurações de Pagamento
              </Button>
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
                Configure sua chave de API do ElevenLabs para permitir respostas em áudio gravado
                nos agentes.
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
              Você pode encontrar a sua chave no painel da sua conta do ElevenLabs (My Account &gt;
              API Key).
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSaveElevenlabs} disabled={savingElevenlabs}>
              {savingElevenlabs ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Save className="size-4 mr-1.5" />
              )}
              Salvar Configuração de Voz
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CARD GOOGLE CALENDAR */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-orange-500/10 grid place-items-center">
                <Calendar className="size-5 text-orange-400" />
              </div>
              <div>
                <CardTitle>Google Calendar (Agenda)</CardTitle>
                <CardDescription>
                  Permite que os agentes agendem, consultem e cancelem eventos diretamente no Google
                  Calendar.
                </CardDescription>
              </div>
            </div>
            {calStatus === "connected" && (
              <Badge className="bg-emerald-500/15 text-emerald-400 border-emerald-500/30 gap-1.5 py-1">
                <Wifi className="size-3.5" /> Conectado
              </Badge>
            )}
            {calStatus === "disconnected" && (
              <Badge className="bg-destructive/15 text-destructive border-destructive/30 gap-1.5 py-1">
                <WifiOff className="size-3.5" /> Falha
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Service Account JSON</Label>
            <Textarea
              rows={4}
              placeholder="Cole aqui o conteúdo do arquivo JSON da Service Account do Google Cloud..."
              value={calCredentials}
              onChange={(e) => setCalCredentials(e.target.value)}
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Crie uma Service Account no Google Cloud Console, gere uma chave JSON e cole aqui.
              Depois, compartilhe o calendário com o email da Service Account.
            </p>
          </div>
          <div className="space-y-2">
            <Label>Calendar ID</Label>
            <Input
              placeholder="primary (ou email@gmail.com)"
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              Use "primary" para o calendário principal ou o email do calendário específico.
            </p>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <Button onClick={handleSaveCal} disabled={savingCal}>
              {savingCal ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Save className="size-4 mr-1.5" />
              )}
              Salvar Calendar
            </Button>
            <Button
              variant="outline"
              onClick={handleTestCal}
              disabled={testingCal || !calCredentials}
            >
              {testingCal ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Wifi className="size-4 mr-1.5" />
              )}
              Testar Conexão
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* CARD GOOGLE SHEETS */}
      <Card className="bg-gradient-card border-border">
        <CardHeader>
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-xl bg-green-500/10 grid place-items-center">
                <Table className="size-5 text-green-400" />
              </div>
              <div>
                <CardTitle>Google Sheets (Planilhas do Google)</CardTitle>
                <CardDescription>
                  Permite que os agentes consultem e adicionem dados em planilhas configuradas via
                  WhatsApp.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Configure as planilhas que o agente pode ler ou editar.
            </p>
            <Button size="sm" onClick={handleOpenAddSheet}>
              Adicionar Planilha
            </Button>
          </div>

          {sheetsList.length === 0 ? (
            <div className="text-center p-8 border border-dashed border-border rounded-xl bg-secondary/10">
              <Table className="size-8 text-muted-foreground mx-auto mb-2 opacity-50" />
              <p className="text-sm font-medium text-foreground">Nenhuma planilha configurada</p>
              <p className="text-xs text-muted-foreground mt-1">
                Adicione sua primeira planilha para o agente consultar ou editar dados.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {sheetsList.map((sheet) => (
                <div
                  key={sheet.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border border-border bg-card/25 hover:bg-card/45 transition-colors gap-3"
                >
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-sm truncate">
                        {sheet.title || "Planilha Sem Nome"}
                      </span>
                      <span className="text-[10px] bg-secondary px-2 py-0.5 rounded text-muted-foreground font-mono">
                        {sheet.sheetName || "Sheet1"}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">
                      ID: {sheet.spreadsheetId}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={testingSheetSingleId === sheet.id}
                      onClick={() =>
                        handleTestSheetSingle(
                          sheet.credentialsJson || "",
                          sheet.spreadsheetId || "",
                          sheet.id,
                        )
                      }
                    >
                      {testingSheetSingleId === sheet.id ? (
                        <Loader2 className="size-3 animate-spin mr-1" />
                      ) : null}
                      Testar
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleOpenEditSheet(sheet)}
                    >
                      Editar
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => handleDeleteSheet(sheet.id)}
                    >
                      Excluir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* DIALOG ADICIONAR / EDITAR PLANILHA */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg bg-card border-border text-foreground">
          <DialogHeader>
            <DialogTitle>
              {editingSheetId
                ? "Editar Planilha Google Sheets"
                : "Adicionar Planilha Google Sheets"}
            </DialogTitle>
            <DialogDescription>
              Insira as informações de acesso da planilha para que o agente possa interagir com ela.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="sheet-title">Apelido / Título da Planilha</Label>
              <Input
                id="sheet-title"
                placeholder="Ex: Planilha de Leads, Agendamentos"
                value={sheetTitle}
                onChange={(e) => setSheetTitle(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Um nome amigável para identificar esta planilha no sistema e no prompt do agente.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sheet-creds">Service Account JSON</Label>
              <Textarea
                id="sheet-creds"
                rows={4}
                placeholder="Cole aqui o conteúdo do arquivo JSON da Service Account..."
                value={sheetCreds}
                onChange={(e) => setSheetCreds(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Compartilhe a planilha com o e-mail da Service Account (client_email).
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sheet-spread-id">Spreadsheet ID</Label>
                <Input
                  id="sheet-spread-id"
                  placeholder="ID da planilha (da URL)"
                  value={sheetSpreadId}
                  onChange={(e) => setSheetSpreadId(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  Disponível na URL: docs.google.com/spreadsheets/d/<strong>ID_AQUI</strong>/edit
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="sheet-tab-name">Nome da Aba</Label>
                <Input
                  id="sheet-tab-name"
                  placeholder="Sheet1"
                  value={sheetTabName}
                  onChange={(e) => setSheetTabName(e.target.value)}
                />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  A aba que contém os dados (padrão: Sheet1).
                </p>
              </div>
            </div>
          </div>
          <DialogFooter className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => handleTestSheetSingle(sheetCreds, sheetSpreadId, null)}
              disabled={testingSheets || !sheetCreds || !sheetSpreadId}
            >
              {testingSheets ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Wifi className="size-4 mr-1.5" />
              )}
              Testar Conexão
            </Button>
            <Button onClick={handleSaveSheetSingle} disabled={savingSheets}>
              {savingSheets ? (
                <Loader2 className="size-4 animate-spin mr-1.5" />
              ) : (
                <Save className="size-4 mr-1.5" />
              )}
              Salvar Planilha
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
