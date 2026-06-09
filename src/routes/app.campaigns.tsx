import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import {
  listInstances,
  listGroups,
  sendText,
  sendMedia,
} from "@/lib/evolution.functions";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Play,
  Pause,
  XCircle,
  Upload,
  UserPlus,
  Users,
  Image as ImageIcon,
  Video,
  FileSpreadsheet,
  AlertTriangle,
  History,
  Send,
  Plus,
  RefreshCw,
  Search,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";

// Explicit import for Button
import { Button as UIButton } from "@/components/ui/button";

export const Route = createFileRoute("/app/campaigns")({
  head: () => ({ meta: [{ title: "Campanhas em Massa — AgentHub AI" }] }),
  component: CampaignsPage,
});

interface InstanceItem {
  instanceName: string;
  status: string;
}

interface GroupItem {
  id: string;
  name: string;
  size?: number | null;
}

interface Recipient {
  number: string;
  name: string;
  status: "pending" | "sent" | "failed";
  sentAt?: string | null;
  error?: string | null;
}

interface Campaign {
  id: string;
  name: string;
  instanceName: string;
  messageText: string;
  mediaUrl?: string | null;
  mediaType?: string | null;
  status: "draft" | "sending" | "paused" | "completed" | "cancelled";
  minDelay: number;
  maxDelay: number;
  createdAt: string;
  recipients?: Recipient[];
}

export function CampaignsPage() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? "";

  // Navigation state
  const [view, setView] = useState<"list" | "new" | "monitor">("list");

  // Instances and Groups
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  // History state
  const [history, setHistory] = useState<Campaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // New Campaign Form
  const [campName, setCampName] = useState("");
  const [selectedInstance, setSelectedInstance] = useState("");
  const [targetType, setTargetType] = useState<"csv" | "groups">("csv");
  const [manualContactsText, setManualContactsText] = useState("");
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  
  const [messageText, setMessageText] = useState("");
  const [minDelay, setMinDelay] = useState(15);
  const [maxDelay, setMaxDelay] = useState(45);

  // Media upload state
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaType, setMediaType] = useState<"image" | "video" | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Active Campaign/Monitoring state
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null);
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [paused, setPaused] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  // References for sending loop control
  const isSendingRef = useRef(false);
  const pausedRef = useRef(false);
  const cancelledRef = useRef(false);

  // Load instances and history
  useEffect(() => {
    if (tenantId) {
      loadInitialData();
    }
  }, [tenantId]);

  const loadInitialData = async () => {
    setLoadingInstances(true);
    setLoadingHistory(true);
    try {
      // Load active instances
      const insts = await listInstances({ data: { tenantId } });
      setInstances(insts.filter((i: any) => i.status === "open" || i.status === "CONNECTED"));
      
      // Load campaign history
      const { data: camps, error } = await supabase
        .from("campaigns")
        .select("*")
        .eq("tenantId", tenantId)
        .order("createdAt", { ascending: false });

      if (error) throw error;
      setHistory(camps as Campaign[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados iniciais");
    } finally {
      setLoadingInstances(false);
      setLoadingHistory(false);
    }
  };

  // Fetch groups when instance changes
  useEffect(() => {
    if (selectedInstance && targetType === "groups" && tenantId) {
      fetchInstanceGroups();
    }
  }, [selectedInstance, targetType]);

  const fetchInstanceGroups = async () => {
    setLoadingGroups(true);
    try {
      const res = await listGroups({ data: { tenantId, instanceName: selectedInstance } });
      setGroups(res as GroupItem[]);
      setSelectedGroups([]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar os grupos desta instância");
    } finally {
      setLoadingGroups(false);
    }
  };

  // Parse spintax logic {Olá|Oi|Bom dia}
  const parseSpintax = (text: string): string => {
    let matches;
    const spintaxRegex = /\{([^{}]+)\}/g;
    let parsed = text;
    while ((matches = spintaxRegex.exec(parsed)) !== null) {
      const options = matches[1].split("|");
      const choice = options[Math.floor(Math.random() * options.length)];
      parsed = parsed.replace(matches[0], choice);
      spintaxRegex.lastIndex = 0; // reset
    }
    return parsed;
  };

  // Replace variable {{nome}} / {{name}}
  const parseVariables = (text: string, contactName?: string): string => {
    let parsed = text;
    parsed = parsed.replace(/\{\{nome\}\}/gi, contactName || "");
    parsed = parsed.replace(/\{\{name\}\}/gi, contactName || "");
    return parsed;
  };

  // Handle media file upload
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const type = file.type.startsWith("image/")
      ? "image"
      : file.type.startsWith("video/")
        ? "video"
        : null;

    if (!type) {
      toast.error("Formato não suportado. Use imagens ou vídeos.");
      return;
    }

    setMediaFile(file);
    setMediaType(type);
    setUploadingMedia(true);

    try {
      const fileExt = file.name.split(".").pop();
      const filePath = `${tenantId}/${Date.now()}_campaign.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("campaigns")
        .upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("campaigns")
        .getPublicUrl(data.path);

      setMediaUrl(urlData.publicUrl);
      toast.success("Mídia enviada com sucesso!");
    } catch (err: any) {
      console.error("Upload error", err);
      toast.error("Falha no upload do arquivo");
      setMediaFile(null);
      setMediaType(null);
    } finally {
      setUploadingMedia(false);
    }
  };

  // Parse inputs (manual textarea / uploaded CSV)
  const parseRecipients = (): Recipient[] => {
    const list: Recipient[] = [];
    
    if (targetType === "csv") {
      const lines = manualContactsText.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Split by comma, semicolon or tab
        const parts = line.split(/[;,]/);
        const numberRaw = parts[0]?.trim();
        const nameRaw = parts[1]?.trim() || "";

        if (numberRaw) {
          // Clean number to keep only digits
          let cleanedNum = numberRaw.replace(/\D/g, "");
          if (cleanedNum.length > 0) {
            // Basic WhatsApp JID format check
            list.push({
              number: cleanedNum,
              name: nameRaw,
              status: "pending",
            });
          }
        }
      }
    } else {
      // Selected groups
      selectedGroups.forEach((gId) => {
        const group = groups.find((g) => g.id === gId);
        list.push({
          number: gId, // The group JID
          name: group?.name ?? "Grupo",
          status: "pending",
        });
      });
    }

    return list;
  };

  // Start Campaign Execution
  const handleStartCampaign = async () => {
    if (!campName.trim()) return toast.error("Insira o nome da campanha");
    if (!selectedInstance) return toast.error("Selecione uma instância WhatsApp");
    if (!messageText.trim()) return toast.error("Escreva a mensagem da campanha");
    
    const parsedRecipients = parseRecipients();
    if (parsedRecipients.length === 0) {
      return toast.error("Nenhum destinatário válido encontrado. Verifique seus contatos/grupos.");
    }

    // Save campaign in DB
    try {
      const { data: campaign, error: cErr } = await supabase
        .from("campaigns")
        .insert({
          tenantId,
          name: campName,
          instanceName: selectedInstance,
          messageText,
          mediaUrl,
          mediaType,
          minDelay,
          maxDelay,
          status: "sending",
        })
        .select()
        .single();

      if (cErr || !campaign) throw cErr;

      // Bulk insert recipients
      const recPayload = parsedRecipients.map((r) => ({
        campaignId: campaign.id,
        number: r.number,
        name: r.name,
        status: "pending" as const,
      }));

      const { data: savedRecs, error: rErr } = await supabase
        .from("campaign_recipients")
        .insert(recPayload)
        .select();

      if (rErr || !savedRecs) throw rErr;

      // Set state and route to monitor
      const updatedCampaign: Campaign = {
        ...campaign,
        status: "sending",
        recipients: savedRecs as Recipient[],
      };

      setActiveCampaign(updatedCampaign);
      setRecipients(savedRecs as Recipient[]);
      setView("monitor");
      
      // Start sending loop
      startSendingLoop(updatedCampaign, savedRecs as Recipient[]);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar campanha no banco de dados");
    }
  };

  // Pause campaign
  const handlePause = async () => {
    if (!activeCampaign) return;
    try {
      await supabase
        .from("campaigns")
        .update({ status: "paused" })
        .eq("id", activeCampaign.id);
      
      setPaused(true);
      pausedRef.current = true;
      setActiveCampaign((prev) => prev ? { ...prev, status: "paused" } : null);
      toast.info("Campanha pausada");
    } catch (e) {
      toast.error("Erro ao pausar campanha");
    }
  };

  // Resume campaign
  const handleResume = async () => {
    if (!activeCampaign) return;
    try {
      await supabase
        .from("campaigns")
        .update({ status: "sending" })
        .eq("id", activeCampaign.id);
      
      setPaused(false);
      pausedRef.current = false;
      setActiveCampaign((prev) => prev ? { ...prev, status: "sending" } : null);
      toast.success("Campanha retomada");
    } catch (e) {
      toast.error("Erro ao retomar campanha");
    }
  };

  // Cancel campaign
  const handleCancel = async () => {
    if (!activeCampaign) return;
    try {
      await supabase
        .from("campaigns")
        .update({ status: "cancelled" })
        .eq("id", activeCampaign.id);
      
      cancelledRef.current = true;
      setIsSending(false);
      setActiveCampaign((prev) => prev ? { ...prev, status: "cancelled" } : null);
      toast.warning("Campanha cancelada pelo usuário");
    } catch (e) {
      toast.error("Erro ao cancelar campanha");
    }
  };

  // Background sending loop
  const startSendingLoop = async (camp: Campaign, list: Recipient[]) => {
    isSendingRef.current = true;
    pausedRef.current = false;
    cancelledRef.current = false;
    setIsSending(true);
    setPaused(false);

    let currentList = [...list];

    for (let i = 0; i < currentList.length; i++) {
      // Check cancellation
      if (cancelledRef.current) break;

      // Check pause
      while (pausedRef.current) {
        if (cancelledRef.current) break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (cancelledRef.current) break;

      const recipient = currentList[i];
      if (recipient.status !== "pending") continue;

      // Update UI: processing recipient
      setRecipients((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status: "pending" } : r
        )
      );

      // Parse spintax & variables
      const finalMsg = parseVariables(parseSpintax(camp.messageText), recipient.name);

      let success = false;
      let errMsg = "";

      try {
        if (camp.mediaUrl && camp.mediaType) {
          // Send Media Message
          await sendMedia({
            data: {
              tenantId,
              instanceName: camp.instanceName,
              number: recipient.number,
              mediaUrl: camp.mediaUrl,
              mediaType: camp.mediaType,
              caption: finalMsg,
            }
          });
        } else {
          // Send Text Message
          await sendText({
            data: {
              tenantId,
              instanceName: camp.instanceName,
              number: recipient.number,
              text: finalMsg,
            }
          });
        }
        success = true;
      } catch (err: any) {
        console.error("Failed to send message to", recipient.number, err);
        errMsg = err?.message ?? "Falha no envio";
      }

      const status = success ? ("sent" as const) : ("failed" as const);
      const nowStr = new Date().toISOString();

      // Update recipient in DB
      try {
        await supabase
          .from("campaign_recipients")
          .update({
            status,
            sentAt: nowStr,
            error: success ? null : errMsg,
          })
          .eq("campaignId", camp.id)
          .eq("number", recipient.number);
      } catch (e) {
        console.warn("DB Recipient log failed", e);
      }

      // Update local recipient state
      setRecipients((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status, sentAt: nowStr, error: success ? null : errMsg } : r
        )
      );

      // If it is the last item, skip delay
      if (i === currentList.length - 1) continue;

      // Apply random delay (anti-ban)
      const delay = Math.floor(Math.random() * (camp.maxDelay - camp.minDelay + 1)) + camp.minDelay;
      
      // Visual countdown countdown
      for (let s = delay; s > 0; s--) {
        if (cancelledRef.current) break;
        while (pausedRef.current) {
          if (cancelledRef.current) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        setSecondsLeft(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setSecondsLeft(0);
    }

    // Finished
    setIsSending(false);
    isSendingRef.current = false;
    
    // Final update of campaign status in DB
    const finalStatus = cancelledRef.current ? "cancelled" : "completed";
    try {
      await supabase
        .from("campaigns")
        .update({ status: finalStatus })
        .eq("id", camp.id);
      
      setActiveCampaign((prev) => prev ? { ...prev, status: finalStatus } : null);
      toast.success(finalStatus === "completed" ? "Campanha concluída com sucesso!" : "Campanha encerrada.");
      loadInitialData(); // Refresh history
    } catch (e) {
      console.error(e);
    }
  };

  // Helper stats
  const totalRecs = recipients.length;
  const sentCount = recipients.filter((r) => r.status === "sent").length;
  const failedCount = recipients.filter((r) => r.status === "failed").length;
  const pendingCount = recipients.filter((r) => r.status === "pending").length;
  const progressPercent = totalRecs > 0 ? Math.round(((sentCount + failedCount) / totalRecs) * 100) : 0;

  // View specific campaign from history
  const viewCampaignMonitor = async (camp: Campaign) => {
    setActiveCampaign(camp);
    setView("monitor");
    setRecipients([]);
    try {
      const { data: recs, error } = await supabase
        .from("campaign_recipients")
        .select("*")
        .eq("campaignId", camp.id);

      if (error) throw error;
      setRecipients(recs as Recipient[]);
      
      // If campaign is still sending or paused, allow resuming/controlling it
      if (camp.status === "sending") {
        startSendingLoop(camp, recs as Recipient[]);
      } else if (camp.status === "paused") {
        setPaused(true);
        pausedRef.current = true;
      }
    } catch (e) {
      toast.error("Erro ao carregar detalhes dos contatos");
    }
  };

  // Parse a local CSV file
  const handleCsvImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        setManualContactsText(text);
        toast.success("Contatos importados do CSV para a área de texto abaixo!");
      }
    };
    reader.readAsText(file);
  };

  // Filter groups search
  const filteredGroups = groups.filter((g) =>
    g.name.toLowerCase().includes(groupSearch.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Campanhas em Massa
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Envie mensagens personalizadas e mídias sem ser bloqueado pelo robô do WhatsApp.
          </p>
        </div>
        <div className="flex gap-2">
          {view !== "list" && (
            <UIButton
              variant="outline"
              size="sm"
              onClick={() => {
                if (isSending) {
                  toast.error("Finalize ou cancele o envio ativo antes de voltar.");
                  return;
                }
                setView("list");
                loadInitialData();
              }}
            >
              Voltar ao Início
            </UIButton>
          )}
          {view === "list" && (
            <UIButton
              className="bg-gradient-primary shadow-glow text-primary-foreground font-medium hover:opacity-90 transition-opacity"
              size="sm"
              onClick={() => {
                // Reset form states
                setCampName("");
                setSelectedInstance("");
                setTargetType("csv");
                setManualContactsText("");
                setSelectedGroups([]);
                setMessageText("");
                setMediaFile(null);
                setMediaType(null);
                setMediaUrl(null);
                setView("new");
              }}
            >
              <Plus className="size-4 mr-2" /> Nova Campanha
            </UIButton>
          )}
        </div>
      </div>

      {view === "list" && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Main Status Column */}
          <div className="md:col-span-2 space-y-6">
            <Card className="border border-border/40 bg-gradient-card">
              <CardHeader>
                <CardTitle className="text-lg font-semibold flex items-center gap-2">
                  <History className="size-5 text-accent" />
                  Histórico de Campanhas
                </CardTitle>
                <CardDescription>
                  Acompanhe os resultados e o status dos envios passados.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingHistory ? (
                  <div className="flex items-center justify-center p-12 text-muted-foreground">
                    <RefreshCw className="animate-spin size-6 mr-2" /> Carregando...
                  </div>
                ) : history.length === 0 ? (
                  <div className="text-center p-12 text-sm text-muted-foreground">
                    Nenhuma campanha enviada até o momento. Clique em "Nova Campanha" para começar.
                  </div>
                ) : (
                  <div className="divide-y divide-border/40">
                    {history.map((c) => (
                      <div
                        key={c.id}
                        onClick={() => viewCampaignMonitor(c)}
                        className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer flex items-center justify-between"
                      >
                        <div className="space-y-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{c.name}</p>
                          <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                            <span>Instância: <strong>{c.instanceName}</strong></span>
                            <span>·</span>
                            <span>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge
                            variant={
                              c.status === "sending"
                                ? "default"
                                : c.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                            }
                            className={
                              c.status === "completed"
                                ? "bg-success/20 text-success border-success/30 capitalize"
                                : c.status === "paused"
                                  ? "bg-amber-500/20 text-amber-400 border-amber-500/30 capitalize"
                                  : "capitalize"
                            }
                          >
                            {c.status === "completed"
                              ? "concluída"
                              : c.status === "sending"
                                ? "enviando"
                                : c.status === "paused"
                                  ? "pausada"
                                  : "cancelada"}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick tips & guidelines */}
          <div className="space-y-6">
            <Card className="border-amber-500/20 bg-amber-500/5 text-amber-200">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-amber-400" />
                  Boas Práticas Anti-Ban
                </CardTitle>
              </CardHeader>
              <CardContent className="text-xs space-y-2 leading-relaxed text-amber-200/90">
                <p>
                  O WhatsApp monitora disparos repetitivos. Para proteger seu número de bloqueios:
                </p>
                <ul className="list-disc pl-4 space-y-1">
                  <li>
                    <strong>Varie o texto:</strong> Utilize o sistema de Spintax para que cada mensagem seja sorteada com termos sinônimos (ex: {"{Olá|Oi|Bom dia}"}).
                  </li>
                  <li>
                    <strong>Use o Delay recomendado:</strong> Deixe o intervalo randômico entre 15 e 45 segundos. Menos de 10 segundos pode acionar o filtro anti-spam.
                  </li>
                  <li>
                    <strong>Mídias:</strong> Evite enviar o mesmo vídeo/imagem idêntico para milhares de contatos em poucas horas sem texto explicativo associado.
                  </li>
                  <li>
                    <strong>Higienize sua base:</strong> Disparar para números inativos ou que reportam sua mensagem como spam acelera o banimento.
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {view === "new" && (
        <Card className="border border-border/40 bg-gradient-card">
          <CardHeader>
            <CardTitle>Nova Campanha</CardTitle>
            <CardDescription>
              Preencha os campos abaixo e selecione sua base para iniciar o envio inteligente.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="camp-name">Nome da Campanha</Label>
                <Input
                  id="camp-name"
                  placeholder="Ex: Campanha Dia das Mães"
                  value={campName}
                  onChange={(e) => setCampName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="instance">Instância de Envio (WhatsApp)</Label>
                {loadingInstances ? (
                  <div className="text-sm text-muted-foreground py-2 flex items-center">
                    <RefreshCw className="animate-spin size-4 mr-2" /> Buscando conexões...
                  </div>
                ) : instances.length === 0 ? (
                  <div className="text-sm text-red-400 py-2">
                    Nenhuma instância do WhatsApp conectada. Conecte no menu WhatsApp primeiro.
                  </div>
                ) : (
                  <select
                    id="instance"
                    className="w-full h-10 px-3 rounded-lg bg-secondary/60 border border-border text-sm focus:outline-none"
                    value={selectedInstance}
                    onChange={(e) => setSelectedInstance(e.target.value)}
                  >
                    <option value="">Selecione uma instância...</option>
                    {instances.map((i) => (
                      <option key={i.instanceName} value={i.instanceName}>
                        {i.instanceName}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            {/* Target Settings */}
            <div className="space-y-3">
              <Label>Base de Destinatários</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="target-type"
                    checked={targetType === "csv"}
                    onChange={() => setTargetType("csv")}
                  />
                  <span>Contatos (.CSV ou Manual)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="radio"
                    name="target-type"
                    checked={targetType === "groups"}
                    onChange={() => setTargetType("groups")}
                  />
                  <span>Grupos do WhatsApp</span>
                </label>
              </div>

              {targetType === "csv" ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border border-dashed border-border rounded-lg p-4 bg-secondary/20">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Importar arquivo de contatos</p>
                      <p className="text-xs text-muted-foreground">
                        Aceita arquivos .CSV com separação por vírgula ou ponto-e-vírgula (ex: número, nome).
                      </p>
                    </div>
                    <UIButton variant="outline" size="sm" className="relative cursor-pointer">
                      <Upload className="size-4 mr-2" /> Importar CSV
                      <input
                        type="file"
                        accept=".csv"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleCsvImport}
                      />
                    </UIButton>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="contacts-area">Lista de Contatos (Um por linha)</Label>
                    <Textarea
                      id="contacts-area"
                      rows={5}
                      placeholder="5511999999999, João Silva&#10;5511988888888, Maria Oliveira"
                      value={manualContactsText}
                      onChange={(e) => setManualContactsText(e.target.value)}
                      className="font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Insira o número completo com DDD (Ex: 5511999999999).
                    </p>
                  </div>
                </div>
              ) : (
                <div className="border border-border rounded-lg bg-secondary/10 p-4 space-y-4">
                  {!selectedInstance ? (
                    <p className="text-sm text-amber-400">
                      Selecione uma instância WhatsApp primeiro para listar os grupos.
                    </p>
                  ) : loadingGroups ? (
                    <div className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center">
                      <RefreshCw className="animate-spin size-5 mr-2" /> Buscando grupos do celular...
                    </div>
                  ) : groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nenhum grupo encontrado nesta instância.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="relative">
                        <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder="Buscar grupos..."
                          className="pl-9"
                          value={groupSearch}
                          onChange={(e) => setGroupSearch(e.target.value)}
                        />
                      </div>
                      <div className="max-h-60 overflow-y-auto border border-border/40 rounded-md divide-y divide-border/20">
                        {filteredGroups.map((g) => (
                          <label
                            key={g.id}
                            className="flex items-center gap-3 p-3 hover:bg-secondary/40 cursor-pointer text-sm"
                          >
                            <input
                              type="checkbox"
                              checked={selectedGroups.includes(g.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedGroups((prev) => [...prev, g.id]);
                                } else {
                                  setSelectedGroups((prev) => prev.filter((id) => id !== g.id));
                                }
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium truncate">{g.name}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{g.id}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {selectedGroups.length} grupo(s) selecionado(s).
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Message drafting */}
            <div className="space-y-4 border-t border-border/40 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message">Texto da Mensagem</Label>
                  <div className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary"
                      onClick={() => setMessageText((p) => p + " {{nome}}")}
                    >
                      + Variável Nome
                    </Badge>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary"
                      onClick={() => setMessageText((p) => p + " {Olá|Oi|Tudo bem?}")}
                    >
                      + Spintax
                    </Badge>
                  </div>
                </div>
                <Textarea
                  id="message"
                  rows={6}
                  placeholder="Digite a mensagem aqui. Ex: {Olá|Oi} {{nome}}, confira as novidades..."
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground">
                  Use colchetes e barras para Spintax: <code>{"{Olá|Oi}"}</code>. O sistema irá sortear uma opção de saudação para cada contato.
                </p>
              </div>

              {/* Media Upload */}
              <div className="space-y-2">
                <Label>Anexo de Mídia (Opcional)</Label>
                <div className="flex items-center gap-4">
                  <UIButton variant="outline" size="sm" className="relative cursor-pointer" disabled={uploadingMedia}>
                    {uploadingMedia ? (
                      <>
                        <RefreshCw className="animate-spin size-4 mr-2" /> Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="size-4 mr-2" /> Escolher Imagem/Vídeo
                      </>
                    )}
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      onChange={handleMediaUpload}
                      disabled={uploadingMedia}
                    />
                  </UIButton>
                  {mediaFile && (
                    <div className="flex items-center gap-2 text-xs bg-secondary/80 p-2 rounded-lg border border-border">
                      {mediaType === "image" ? (
                        <ImageIcon className="size-4 text-accent" />
                      ) : (
                        <Video className="size-4 text-accent" />
                      )}
                      <span className="font-medium truncate max-w-[180px]">{mediaFile.name}</span>
                      <UIButton
                        variant="ghost"
                        size="icon"
                        className="size-5 text-red-400 hover:text-red-300"
                        onClick={() => {
                          setMediaFile(null);
                          setMediaType(null);
                          setMediaUrl(null);
                        }}
                      >
                        <XCircle className="size-3" />
                      </UIButton>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Anti-Ban Settings */}
            <div className="space-y-3 border-t border-border/40 pt-4">
              <Label>Intervalo de Delay Anti-Ban (Em Segundos)</Label>
              <div className="flex gap-4 max-w-sm">
                <div className="flex-1 space-y-1">
                  <Label htmlFor="min-delay" className="text-xs text-muted-foreground">Delay Mínimo</Label>
                  <Input
                    id="min-delay"
                    type="number"
                    min={5}
                    value={minDelay}
                    onChange={(e) => setMinDelay(Number(e.target.value))}
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <Label htmlFor="max-delay" className="text-xs text-muted-foreground">Delay Máximo</Label>
                  <Input
                    id="max-delay"
                    type="number"
                    min={minDelay}
                    value={maxDelay}
                    onChange={(e) => setMaxDelay(Number(e.target.value))}
                  />
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 text-amber-400">
                <AlertTriangle className="size-3.5 shrink-0" /> Recomendamos deixar entre 15 e 45 segundos para sua segurança.
              </p>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t border-border/40 pt-4">
            <UIButton variant="ghost" onClick={() => setView("list")}>
              Cancelar
            </UIButton>
            <UIButton
              className="bg-gradient-primary shadow-glow text-primary-foreground font-semibold"
              onClick={handleStartCampaign}
              disabled={uploadingMedia}
            >
              <Send className="size-4 mr-2" /> Iniciar Disparo
            </UIButton>
          </CardFooter>
        </Card>
      )}

      {view === "monitor" && activeCampaign && (
        <div className="space-y-6">
          {/* Main stats card */}
          <Card className="border border-border/40 bg-gradient-card">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{activeCampaign.name}</CardTitle>
                  <CardDescription className="mt-1">
                    Instância de Envio: <strong>{activeCampaign.instanceName}</strong> · Delays: <strong>{activeCampaign.minDelay}s a {activeCampaign.maxDelay}s</strong>
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {isSending ? (
                    <>
                      {paused ? (
                        <UIButton variant="outline" size="sm" onClick={handleResume}>
                          <Play className="size-4 mr-2 text-success" /> Retomar
                        </UIButton>
                      ) : (
                        <UIButton variant="outline" size="sm" onClick={handlePause}>
                          <Pause className="size-4 mr-2 text-warning" /> Pausar
                        </UIButton>
                      )}
                      <UIButton variant="destructive" size="sm" onClick={handleCancel}>
                        <XCircle className="size-4 mr-2" /> Cancelar Campanha
                      </UIButton>
                    </>
                  ) : (
                    <Badge
                      variant={activeCampaign.status === "completed" ? "secondary" : "destructive"}
                      className={
                        activeCampaign.status === "completed"
                          ? "bg-success/20 text-success border-success/30 px-3 py-1.5 text-sm"
                          : "px-3 py-1.5 text-sm"
                      }
                    >
                      {activeCampaign.status === "completed" ? "Concluída" : "Encerrada"}
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Progress and status blocks */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm font-medium">
                  <span>Progresso da Campanha</span>
                  <span>{progressPercent}% ({sentCount + failedCount} / {totalRecs})</span>
                </div>
                <Progress value={progressPercent} className="h-3 bg-secondary/80 rounded-full" />
              </div>

              {/* Counters cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-secondary/40 border border-border/30 rounded-xl p-4 text-center">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold mt-1">{totalRecs}</p>
                </div>
                <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center text-success">
                  <p className="text-xs text-muted-foreground">Enviados</p>
                  <p className="text-2xl font-bold mt-1">{sentCount}</p>
                </div>
                <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center text-destructive">
                  <p className="text-xs text-muted-foreground">Falhas</p>
                  <p className="text-2xl font-bold mt-1">{failedCount}</p>
                </div>
                <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center text-amber-400">
                  <p className="text-xs text-muted-foreground">Fila</p>
                  <p className="text-2xl font-bold mt-1">{pendingCount}</p>
                </div>
              </div>

              {/* Real-time anti-ban status banner */}
              {isSending && !paused && secondsLeft > 0 && (
                <div className="flex items-center justify-center p-3 rounded-lg border border-accent/20 bg-accent/5 animate-pulse text-sm text-accent">
                  <RefreshCw className="animate-spin size-4 mr-2" /> Anti-Ban Ativo: Aguardando {secondsLeft} segundos antes do próximo número...
                </div>
              )}

              {/* Tab warning browser */}
              {isSending && (
                <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200 text-xs">
                  <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                  <div>
                    <strong>Atenção:</strong> Como o disparo é controlado pelo navegador (Client-side), <strong>não feche esta aba ou desligue o computador</strong> enquanto a campanha estiver ativa! Se você fechar a aba, o envio será interrompido e ficará pausado.
                  </div>
                </div>
              )}

              {/* Recipients list log */}
              <div className="space-y-3">
                <Label>Registro de Envios em Tempo Real</Label>
                <div className="border border-border/40 rounded-xl overflow-hidden bg-secondary/10">
                  <div className="max-h-[300px] overflow-y-auto divide-y divide-border/20 text-xs font-mono">
                    {recipients.length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground">
                        Carregando contatos da fila...
                      </div>
                    ) : (
                      recipients.map((r, idx) => (
                        <div key={idx} className="p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                          <div className="flex-1 min-w-0 space-y-0.5">
                            <p className="font-semibold text-foreground">
                              {r.number} {r.name && <span className="text-muted-foreground">({r.name})</span>}
                            </p>
                            {r.error && <p className="text-[10px] text-destructive">{r.error}</p>}
                          </div>
                          <div>
                            {r.status === "sent" ? (
                              <Badge className="bg-success/20 text-success border-success/40">Sucesso</Badge>
                            ) : r.status === "failed" ? (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/40">Falhou</Badge>
                            ) : (
                              <Badge className="bg-secondary/40 text-muted-foreground border-border/40">Na Fila</Badge>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
