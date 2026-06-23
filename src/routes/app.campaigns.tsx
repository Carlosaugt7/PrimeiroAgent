import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { listInstances, listGroups, sendText, sendMedia, sendPresence } from "@/lib/evolution.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

// Explicit import for Button
import { Button as UIButton } from "@/components/ui/button";

export const Route = createFileRoute("/app/campaigns")({
  head: () => ({ meta: [{ title: "Campanhas em Massa — AgentFlow IA" }] }),
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

interface GroupRecipient {
  groupId: string;
  groupName: string;
  status: "pending" | "sent" | "failed";
  sentAt?: string | null;
  error?: string | null;
}

interface GroupCampaign {
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
  recipients?: GroupRecipient[];
}

function formatDuration(ms: number) {
  if (ms < 0) return "0s";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const parts = [];
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);
  return parts.join(" ");
}

function CampaignsPage() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? "";

  // Navigation state
  const [view, setView] = useState<"list" | "new" | "monitor">("list");
  const [activeTab, setActiveTab] = useState<"contacts" | "groups">("contacts");

  // Instances and Groups
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");

  // History state
  const [history, setHistory] = useState<Campaign[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [groupHistory, setGroupHistory] = useState<GroupCampaign[]>([]);
  const [loadingGroupHistory, setLoadingGroupHistory] = useState(false);

  // Group Monitoring state
  const [activeGroupCampaign, setActiveGroupCampaign] = useState<GroupCampaign | null>(null);
  const [groupRecipients, setGroupRecipients] = useState<GroupRecipient[]>([]);
  const [isSendingGroup, setIsSendingGroup] = useState(false);
  const [pausedGroup, setPausedGroup] = useState(false);
  const [secondsLeftGroup, setSecondsLeftGroup] = useState(0);

  // Simulation parameters for groups
  const [simulateTyping, setSimulateTyping] = useState(true);

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
  const isSendingGroupRef = useRef(false);
  const pausedRef = useRef(false);
  const pausedGroupRef = useRef(false);
  const cancelledRef = useRef(false);
  const cancelledGroupRef = useRef(false);

  // Load instances and history
  useEffect(() => {
    if (tenantId) {
      loadInitialData();
    }
  }, [tenantId]);

  const loadInitialData = async () => {
    setLoadingInstances(true);
    setLoadingHistory(true);
    setLoadingGroupHistory(true);
    try {
      // Load active instances
      const insts = await listInstances({ data: { tenantId } });
      setInstances(insts.filter((i: any) => i.status === "open" || i.status === "CONNECTED"));

      // Load campaign history
      const { data: camps, error } = await supabase
        .from("campaigns")
        .select("*, recipients:campaign_recipients(*)")
        .eq("tenantId", tenantId)
        .order("createdAt", { ascending: false });

      if (error) throw error;
      setHistory(camps as Campaign[]);

      // Load group campaign history
      const { data: groupCamps, error: gcErr } = await supabase
        .from("group_campaigns")
        .select("*, recipients:group_campaign_recipients(*)")
        .eq("tenantId", tenantId)
        .order("createdAt", { ascending: false });

      if (gcErr) throw gcErr;
      setGroupHistory(groupCamps as GroupCampaign[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar dados iniciais");
    } finally {
      setLoadingInstances(false);
      setLoadingHistory(false);
      setLoadingGroupHistory(false);
    }
  };

  const handleDeleteCampaign = async (id: string, type: "contacts" | "groups", e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Deseja realmente excluir esta campanha e todo o seu histórico?")) return;
    try {
      const table = type === "contacts" ? "campaigns" : "group_campaigns";
      const { error } = await supabase.from(table).delete().eq("id", id);
      if (error) throw error;
      toast.success("Campanha excluída com sucesso!");
      loadInitialData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir campanha");
    }
  };

  // Fetch groups when instance changes
  useEffect(() => {
    if (selectedInstance && (targetType === "groups" || activeTab === "groups") && tenantId) {
      fetchInstanceGroups();
    }
  }, [selectedInstance, targetType, activeTab]);

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

  // Replace variable {{nome}} / {{name}} / <nome> / <name> / {nome} / {name} / [nome] / [name]
  const parseVariables = (text: string, contactName?: string): string => {
    let parsed = text;
    const name = contactName?.trim() || "";
    parsed = parsed.replace(/\{\{nome\}\}/gi, name);
    parsed = parsed.replace(/\{\{name\}\}/gi, name);
    parsed = parsed.replace(/<nome>/gi, name);
    parsed = parsed.replace(/<name>/gi, name);
    parsed = parsed.replace(/\{nome\}/gi, name);
    parsed = parsed.replace(/\{name\}/gi, name);
    parsed = parsed.replace(/\[nome\]/gi, name);
    parsed = parsed.replace(/\[name\]/gi, name);
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

      const { data, error } = await supabase.storage.from("campaigns").upload(filePath, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage.from("campaigns").getPublicUrl(data.path);

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

  // Parse inputs (manual textarea / uploaded CSV / XLSX)
  const parseRecipients = (): Recipient[] => {
    const list: Recipient[] = [];

    if (targetType === "csv") {
      const lines = manualContactsText.split("\n");
      for (const line of lines) {
        if (!line.trim()) continue;

        // Split by comma, semicolon or tab
        const parts = line.split(/[;,]/);
        let numberRaw = parts[0]?.trim() || "";
        let nameRaw = parts[1]?.trim() || "";

        // Remove surrounding quotes and formula syntax if any
        if (numberRaw.startsWith("=")) {
          numberRaw = numberRaw.slice(1).trim();
        }
        numberRaw = numberRaw.replace(/^["']|["']$/g, "").trim();
        nameRaw = nameRaw.replace(/^["']|["']$/g, "").trim();

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
    const activeCamp = activeTab === "contacts" ? activeCampaign : activeGroupCampaign;
    if (!activeCamp) return;
    try {
      const table = activeTab === "contacts" ? "campaigns" : "group_campaigns";
      await supabase.from(table).update({ status: "paused" }).eq("id", activeCamp.id);

      if (activeTab === "contacts") {
        setPaused(true);
        pausedRef.current = true;
        setActiveCampaign((prev) => (prev ? { ...prev, status: "paused" } : null));
      } else {
        setPausedGroup(true);
        pausedGroupRef.current = true;
        setActiveGroupCampaign((prev) => (prev ? { ...prev, status: "paused" } : null));
      }
      toast.info("Campanha pausada");
    } catch (e) {
      toast.error("Erro ao pausar campanha");
    }
  };

  // Resume campaign
  const handleResume = async () => {
    const activeCamp = activeTab === "contacts" ? activeCampaign : activeGroupCampaign;
    if (!activeCamp) return;
    try {
      const table = activeTab === "contacts" ? "campaigns" : "group_campaigns";
      await supabase.from(table).update({ status: "sending" }).eq("id", activeCamp.id);

      if (activeTab === "contacts") {
        setPaused(false);
        pausedRef.current = false;
        setActiveCampaign((prev) => (prev ? { ...prev, status: "sending" } : null));
      } else {
        setPausedGroup(false);
        pausedGroupRef.current = false;
        setActiveGroupCampaign((prev) => (prev ? { ...prev, status: "sending" } : null));
      }
      toast.success("Campanha retomada");
    } catch (e) {
      toast.error("Erro ao retomar campanha");
    }
  };

  // Cancel campaign
  const handleCancel = async () => {
    const activeCamp = activeTab === "contacts" ? activeCampaign : activeGroupCampaign;
    if (!activeCamp) return;
    try {
      const table = activeTab === "contacts" ? "campaigns" : "group_campaigns";
      await supabase.from(table).update({ status: "cancelled" }).eq("id", activeCamp.id);

      if (activeTab === "contacts") {
        cancelledRef.current = true;
        setIsSending(false);
        setActiveCampaign((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      } else {
        cancelledGroupRef.current = true;
        setIsSendingGroup(false);
        setActiveGroupCampaign((prev) => (prev ? { ...prev, status: "cancelled" } : null));
      }
      toast.warning("Campanha cancelada pelo usuário");
    } catch (e) {
      toast.error("Erro ao cancelar campanha");
    }
  };

  // Background sending loop
  const startSendingLoop = async (camp: Campaign, list: Recipient[]) => {
    if (isSendingRef.current) return;
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
      setRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "pending" } : r)));

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
            },
          });
        } else {
          // Send Text Message
          await sendText({
            data: {
              tenantId,
              instanceName: camp.instanceName,
              number: recipient.number,
              text: finalMsg,
            },
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
          idx === i ? { ...r, status, sentAt: nowStr, error: success ? null : errMsg } : r,
        ),
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
      await supabase.from("campaigns").update({ status: finalStatus }).eq("id", camp.id);

      setActiveCampaign((prev) => (prev ? { ...prev, status: finalStatus } : null));
      toast.success(
        finalStatus === "completed" ? "Campanha concluída com sucesso!" : "Campanha encerrada.",
      );
      loadInitialData(); // Refresh history
    } catch (e) {
      console.error(e);
    }
  };

  // Start Group Campaign Execution
  const handleStartGroupCampaign = async () => {
    if (!campName.trim()) return toast.error("Insira o nome da campanha");
    if (!selectedInstance) return toast.error("Selecione uma instância WhatsApp");
    if (!messageText.trim()) return toast.error("Escreva a mensagem da campanha");
    if (selectedGroups.length === 0) return toast.error("Selecione pelo menos um grupo de destino");

    const parsedRecipients: GroupRecipient[] = selectedGroups.map((gId) => {
      const group = groups.find((g) => g.id === gId);
      return {
        groupId: gId,
        groupName: group?.name ?? "Grupo",
        status: "pending",
      };
    });

    try {
      const { data: campaign, error: cErr } = await supabase
        .from("group_campaigns")
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

      const recPayload = parsedRecipients.map((r) => ({
        campaignId: campaign.id,
        groupId: r.groupId,
        groupName: r.groupName,
        status: "pending" as const,
      }));

      const { data: savedRecs, error: rErr } = await supabase
        .from("group_campaign_recipients")
        .insert(recPayload)
        .select();

      if (rErr || !savedRecs) throw rErr;

      const updatedCampaign: GroupCampaign = {
        ...campaign,
        status: "sending",
        recipients: savedRecs.map(r => ({
          groupId: r.groupId,
          groupName: r.groupName,
          status: r.status,
        })),
      };

      setActiveGroupCampaign(updatedCampaign);
      setGroupRecipients(savedRecs as GroupRecipient[]);
      setView("monitor");

      startGroupSendingLoop(updatedCampaign, savedRecs as GroupRecipient[]);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao salvar campanha de grupo no banco de dados");
    }
  };

  // Background group sending loop
  const startGroupSendingLoop = async (camp: GroupCampaign, list: GroupRecipient[]) => {
    if (isSendingGroupRef.current) return;
    isSendingGroupRef.current = true;
    pausedGroupRef.current = false;
    cancelledGroupRef.current = false;
    setIsSendingGroup(true);
    setPausedGroup(false);

    let currentList = [...list];

    for (let i = 0; i < currentList.length; i++) {
      if (cancelledGroupRef.current) break;

      while (pausedGroupRef.current) {
        if (cancelledGroupRef.current) break;
        await new Promise((r) => setTimeout(r, 1000));
      }

      if (cancelledGroupRef.current) break;

      const recipient = currentList[i];
      if (recipient.status !== "pending") continue;

      setGroupRecipients((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "pending" } : r)));

      let finalMsg = parseVariables(parseSpintax(camp.messageText), recipient.groupName);
      finalMsg = finalMsg.replace(/\{\{grupo\}\}/gi, recipient.groupName);
      finalMsg = finalMsg.replace(/\{\{group\}\}/gi, recipient.groupName);

      // Simulação de Digitação (Anti-Ban)
      if (simulateTyping) {
        try {
          await sendPresence({
            data: {
              tenantId,
              instanceName: camp.instanceName,
              number: recipient.groupId,
              presence: "composing",
              delay: 5000,
            }
          });
          await new Promise((r) => setTimeout(r, 5000));
        } catch (e) {
          console.warn("Presence status failed", e);
        }
      }

      let success = false;
      let errMsg = "";

      try {
        if (camp.mediaUrl && camp.mediaType) {
          await sendMedia({
            data: {
              tenantId,
              instanceName: camp.instanceName,
              number: recipient.groupId,
              mediaUrl: camp.mediaUrl,
              mediaType: camp.mediaType,
              caption: finalMsg,
            },
          });
        } else {
          await sendText({
            data: {
              tenantId,
              instanceName: camp.instanceName,
              number: recipient.groupId,
              text: finalMsg,
            },
          });
        }
        success = true;
      } catch (err: any) {
        console.error("Failed to send message to group", recipient.groupId, err);
        errMsg = err?.message ?? "Falha no envio";
      }

      const status = success ? ("sent" as const) : ("failed" as const);
      const nowStr = new Date().toISOString();

      try {
        await supabase
          .from("group_campaign_recipients")
          .update({
            status,
            sentAt: nowStr,
            error: success ? null : errMsg,
          })
          .eq("campaignId", camp.id)
          .eq("groupId", recipient.groupId);
      } catch (e) {
        console.warn("DB Recipient log failed", e);
      }

      setGroupRecipients((prev) =>
        prev.map((r, idx) =>
          idx === i ? { ...r, status, sentAt: nowStr, error: success ? null : errMsg } : r,
        ),
      );

      if (i === currentList.length - 1) continue;

      const delay = Math.floor(Math.random() * (camp.maxDelay - camp.minDelay + 1)) + camp.minDelay;

      for (let s = delay; s > 0; s--) {
        if (cancelledGroupRef.current) break;
        while (pausedGroupRef.current) {
          if (cancelledGroupRef.current) break;
          await new Promise((r) => setTimeout(r, 1000));
        }
        setSecondsLeftGroup(s);
        await new Promise((r) => setTimeout(r, 1000));
      }
      setSecondsLeftGroup(0);
    }

    setIsSendingGroup(false);
    isSendingGroupRef.current = false;

    const finalStatus = cancelledGroupRef.current ? "cancelled" : "completed";
    try {
      await supabase.from("group_campaigns").update({ status: finalStatus }).eq("id", camp.id);
      setActiveGroupCampaign((prev) => (prev ? { ...prev, status: finalStatus } : null));
      toast.success(
        finalStatus === "completed" ? "Campanha em grupo concluída!" : "Campanha em grupo encerrada."
      );
      loadInitialData();
    } catch (e) {
      console.error(e);
    }
  };

  // View specific group campaign from history
  const viewGroupCampaignMonitor = async (camp: GroupCampaign) => {
    setActiveGroupCampaign(camp);
    setView("monitor");
    setGroupRecipients([]);
    try {
      const { data: recs, error } = await supabase
        .from("group_campaign_recipients")
        .select("*")
        .eq("campaignId", camp.id);

      if (error) throw error;
      setGroupRecipients(recs as GroupRecipient[]);

      if (camp.status === "sending") {
        startGroupSendingLoop(camp, recs as GroupRecipient[]);
      } else if (camp.status === "paused") {
        setPausedGroup(true);
        pausedGroupRef.current = true;
      }
    } catch (e) {
      toast.error("Erro ao carregar detalhes dos grupos");
    }
  };

  // Helper stats
  const totalRecs = recipients.length;
  const sentCount = recipients.filter((r) => r.status === "sent").length;
  const failedCount = recipients.filter((r) => r.status === "failed").length;
  const pendingCount = recipients.filter((r) => r.status === "pending").length;
  const progressPercent =
    totalRecs > 0 ? Math.round(((sentCount + failedCount) / totalRecs) * 100) : 0;

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

  // Parse a local CSV or Excel file
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const fileExt = file.name.split(".").pop()?.toLowerCase();

    if (fileExt === "xlsx" || fileExt === "xls") {
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const data = new Uint8Array(event.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

          const lines: string[] = [];
          for (const row of rows) {
            const col1 = String(row[0] || "").trim();
            const col2 = String(row[1] || "").trim();
            if (!col1) continue;

            // Ignora cabeçalhos comuns
            if (
              /^(n[uú]mero|number|telefone|phone|id)$/i.test(col1) &&
              /^(nome|name|label)?$/i.test(col2)
            ) {
              continue;
            }

            if (col2) {
              lines.push(`${col1}, ${col2}`);
            } else {
              lines.push(col1);
            }
          }

          setManualContactsText(lines.join("\n"));
          toast.success("Contatos importados do Excel (.xlsx) com sucesso!");
        } catch (err) {
          console.error(err);
          toast.error("Erro ao processar o arquivo Excel.");
        }
      };
      reader.readAsArrayBuffer(file);
    } else {
      // Trata como CSV
      const reader = new FileReader();
      reader.onload = (event) => {
        const text = event.target?.result as string;
        if (text) {
          setManualContactsText(text);
          toast.success("Contatos importados do CSV com sucesso!");
        }
      };
      reader.readAsText(file);
    }
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
            {activeTab === "contacts"
              ? "Envie mensagens personalizadas e mídias sem ser bloqueado pelo robô do WhatsApp."
              : "Dispare comunicados em massa diretamente nos grupos selecionados do WhatsApp com segurança."}
          </p>
        </div>
        <div className="flex gap-2">
          {view !== "list" && (
            <UIButton
              variant="outline"
              size="sm"
              onClick={() => {
                if (isSending || isSendingGroup) {
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
                setTargetType(activeTab === "contacts" ? "csv" : "groups");
                setManualContactsText("");
                setSelectedGroups([]);
                setMessageText("");
                setMediaFile(null);
                setMediaType(null);
                setMediaUrl(null);
                setMinDelay(activeTab === "contacts" ? 15 : 60);
                setMaxDelay(activeTab === "contacts" ? 45 : 180);
                setView("new");
              }}
            >
              <Plus className="size-4 mr-2" /> Nova Campanha
            </UIButton>
          )}
        </div>
      </div>

      {view === "list" && (
        <Tabs
          value={activeTab}
          onValueChange={(v) => {
            if (isSending || isSendingGroup) {
              toast.error("Existe um disparo em segundo plano ativo.");
              return;
            }
            setActiveTab(v as "contacts" | "groups");
          }}
          className="w-full space-y-6"
        >
          <TabsList className="grid w-full max-w-md grid-cols-2 bg-secondary/40 p-1 rounded-xl">
            <TabsTrigger value="contacts" className="rounded-lg">Campanhas p/ Contatos</TabsTrigger>
            <TabsTrigger value="groups" className="rounded-lg">Campanhas p/ Grupos</TabsTrigger>
          </TabsList>

          <TabsContent value="contacts" className="outline-none space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Main Status Column */}
              <div className="md:col-span-2 space-y-6">
                <Card className="border border-border/40 bg-gradient-card">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <History className="size-5 text-accent" />
                      Histórico de Campanhas (Contatos)
                    </CardTitle>
                    <CardDescription>
                      Acompanhe os resultados e o status dos envios individuais passados.
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
                        {history.map((c) => {
                          const success = c.recipients?.filter((r) => r.status === "sent").length ?? 0;
                          const failed = c.recipients?.filter((r) => r.status === "failed").length ?? 0;
                          const times = (c.recipients || []).filter((r) => r.sentAt).map((r) => new Date(r.sentAt!).getTime());
                          let durationStr = "—";
                          if (times.length > 0) {
                            const minTime = Math.min(...times);
                            const maxTime = c.status === "sending" ? Date.now() : Math.max(...times);
                            durationStr = formatDuration(maxTime - minTime);
                          }

                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setActiveTab("contacts");
                                viewCampaignMonitor(c);
                              }}
                              className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <div className="space-y-1.5 min-w-0 flex-1 mr-4">
                                <p className="font-semibold text-sm truncate">{c.name}</p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                  <span>Instância: <strong>{c.instanceName}</strong></span>
                                  <span>·</span>
                                  <span>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                                  <span>·</span>
                                  <span className="text-emerald-500">Sucesso: <strong>{success}</strong></span>
                                  <span>·</span>
                                  <span className="text-rose-500">Falhas: <strong>{failed}</strong></span>
                                  <span>·</span>
                                  <span>Duração: <strong>{durationStr}</strong></span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <Badge
                                  variant={c.status === "sending" ? "default" : c.status === "cancelled" ? "destructive" : "secondary"}
                                  className={c.status === "completed" ? "bg-success/20 text-success border-success/30 capitalize" : c.status === "paused" ? "bg-amber-500/20 text-amber-400 border-amber-500/30 capitalize" : "capitalize"}
                                >
                                  {c.status === "completed" ? "concluída" : c.status === "sending" ? "enviando" : c.status === "paused" ? "pausada" : "cancelada"}
                                </Badge>
                                <UIButton
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => handleDeleteCampaign(c.id, "contacts", e)}
                                >
                                  <Trash2 className="size-4" />
                                </UIButton>
                              </div>
                            </div>
                          );
                        })}
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
                    <p>O WhatsApp monitora disparos repetitivos. Para proteger seu número de bloqueios:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Varie o texto:</strong> Utilize o sistema de Spintax para que cada mensagem seja sorteada com termos sinônimos (ex: {"{Olá|Oi|Bom dia}"}).</li>
                      <li><strong>Use o Delay recomendado:</strong> Deixe o intervalo randômico entre 15 e 45 segundos. Menos de 10 segundos pode acionar o filtro anti-spam.</li>
                      <li><strong>Mídias:</strong> Evite enviar o mesmo vídeo/imagem idêntico para milhares de contatos em poucas horas sem texto explicativo associado.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="groups" className="outline-none space-y-6">
            <div className="grid gap-6 md:grid-cols-3">
              {/* Group Campaigns Column */}
              <div className="md:col-span-2 space-y-6">
                <Card className="border border-border/40 bg-gradient-card">
                  <CardHeader>
                    <CardTitle className="text-lg font-semibold flex items-center gap-2">
                      <Users className="size-5 text-accent" />
                      Histórico de Campanhas em Grupo
                    </CardTitle>
                    <CardDescription>
                      Acompanhe os resultados e o status dos envios para grupos do WhatsApp.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    {loadingGroupHistory ? (
                      <div className="flex items-center justify-center p-12 text-muted-foreground">
                        <RefreshCw className="animate-spin size-6 mr-2" /> Carregando...
                      </div>
                    ) : groupHistory.length === 0 ? (
                      <div className="text-center p-12 text-sm text-muted-foreground">
                        Nenhuma campanha para grupos enviada até o momento. Clique em "Nova Campanha" para começar.
                      </div>
                    ) : (
                      <div className="divide-y divide-border/40">
                        {groupHistory.map((c) => {
                          const success = c.recipients?.filter((r) => r.status === "sent").length ?? 0;
                          const failed = c.recipients?.filter((r) => r.status === "failed").length ?? 0;
                          const times = (c.recipients || []).filter((r) => r.sentAt).map((r) => new Date(r.sentAt!).getTime());
                          let durationStr = "—";
                          if (times.length > 0) {
                            const minTime = Math.min(...times);
                            const maxTime = c.status === "sending" ? Date.now() : Math.max(...times);
                            durationStr = formatDuration(maxTime - minTime);
                          }

                          return (
                            <div
                              key={c.id}
                              onClick={() => {
                                setActiveTab("groups");
                                viewGroupCampaignMonitor(c);
                              }}
                              className="p-4 hover:bg-secondary/20 transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <div className="space-y-1.5 min-w-0 flex-1 mr-4">
                                <p className="font-semibold text-sm truncate">{c.name}</p>
                                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                                  <span>Instância: <strong>{c.instanceName}</strong></span>
                                  <span>·</span>
                                  <span>{new Date(c.createdAt).toLocaleDateString("pt-BR")}</span>
                                  <span>·</span>
                                  <span className="text-emerald-500">Sucesso: <strong>{success}</strong></span>
                                  <span>·</span>
                                  <span className="text-rose-500">Falhas: <strong>{failed}</strong></span>
                                  <span>·</span>
                                  <span>Duração: <strong>{durationStr}</strong></span>
                                </div>
                              </div>
                              <div className="flex items-center gap-3 shrink-0">
                                <Badge
                                  variant={c.status === "sending" ? "default" : c.status === "cancelled" ? "destructive" : "secondary"}
                                  className={c.status === "completed" ? "bg-success/20 text-success border-success/30 capitalize" : c.status === "paused" ? "bg-amber-500/20 text-amber-400 border-amber-500/30 capitalize" : "capitalize"}
                                >
                                  {c.status === "completed" ? "concluída" : c.status === "sending" ? "enviando" : c.status === "paused" ? "pausada" : "cancelada"}
                                </Badge>
                                <UIButton
                                  variant="ghost"
                                  size="icon"
                                  className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={(e) => handleDeleteCampaign(c.id, "groups", e)}
                                >
                                  <Trash2 className="size-4" />
                                </UIButton>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Anti-Ban warnings and suggestions for groups */}
              <div className="space-y-6">
                <Card className="border-amber-500/20 bg-amber-500/5 text-amber-200">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <AlertTriangle className="size-4 text-amber-400" />
                      Prevenção Anti-Ban (Grupos)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-xs space-y-2 leading-relaxed text-amber-200/90">
                    <p>O disparo para grupos exige cautela máxima para evitar o banimento da sua instância:</p>
                    <ul className="list-disc pl-4 space-y-1">
                      <li><strong>Atraso Amplo (Delay Inteligente):</strong> Mantenha o delay padrão de 60 a 180 segundos. Disparos rápidos para múltiplos grupos levam ao bloqueio imediato do número.</li>
                      <li><strong>Simulação de Presença:</strong> Ativa a simulação de digitação antes do disparo para emular o comportamento humano real.</li>
                      <li><strong>Variáveis Dinâmicas:</strong> Use <code>{"{{grupo}}"}</code> no corpo do texto para que o robô do WhatsApp veja cada mensagem como única.</li>
                    </ul>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      )}

      {view === "new" && (
        <Card className="border border-border/40 bg-gradient-card">
          <CardHeader>
            <CardTitle>{activeTab === "contacts" ? "Nova Campanha (Contatos)" : "Nova Campanha (Grupos)"}</CardTitle>
            <CardDescription>
              {activeTab === "contacts"
                ? "Preencha os campos abaixo e selecione sua base de contatos para iniciar o envio inteligente."
                : "Selecione a instância desejada para buscar os grupos e selecione os destinos para o envio seguro."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="camp-name">Nome da Campanha</Label>
                <Input
                  id="camp-name"
                  placeholder="Ex: Comunicado Mensal de Clientes"
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
            {activeTab === "contacts" ? (
              <div className="space-y-3">
                <Label>Base de Destinatários</Label>
                <div className="space-y-4">
                  <div className="flex items-center justify-between border border-dashed border-border rounded-lg p-4 bg-secondary/20">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Importar arquivo de contatos</p>
                      <p className="text-xs text-muted-foreground">
                        Aceita arquivos .CSV ou .XLSX (Excel) contendo número e nome.
                      </p>
                    </div>
                    <UIButton variant="outline" size="sm" className="relative cursor-pointer">
                      <Upload className="size-4 mr-2" /> Importar CSV / Excel
                      <input
                        type="file"
                        accept=".csv,.xlsx,.xls"
                        className="absolute inset-0 opacity-0 cursor-pointer"
                        onChange={handleFileImport}
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
              </div>
            ) : (
              <div className="space-y-3">
                <Label>Grupos do WhatsApp de Destino</Label>
                <div className="border border-border rounded-lg bg-secondary/10 p-4 space-y-4">
                  {!selectedInstance ? (
                    <p className="text-sm text-amber-400">
                      Selecione uma instância WhatsApp primeiro para listar os grupos.
                    </p>
                  ) : loadingGroups ? (
                    <div className="text-sm text-muted-foreground py-8 text-center flex items-center justify-center">
                      <RefreshCw className="animate-spin size-5 mr-2" /> Buscando grupos no celular...
                    </div>
                  ) : groups.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-8 text-center">
                      Nenhum grupo encontrado nesta instância.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            placeholder="Buscar grupos..."
                            className="pl-9"
                            value={groupSearch}
                            onChange={(e) => setGroupSearch(e.target.value)}
                          />
                        </div>
                        <UIButton
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (selectedGroups.length === groups.length) {
                              setSelectedGroups([]);
                            } else {
                              setSelectedGroups(groups.map((g) => g.id));
                            }
                          }}
                        >
                          {selectedGroups.length === groups.length ? "Desmarcar Todos" : "Selecionar Todos"}
                        </UIButton>
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
                        {selectedGroups.length} de {groups.length} grupo(s) selecionado(s).
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Message drafting */}
            <div className="space-y-4 border-t border-border/40 pt-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="message">Texto da Mensagem</Label>
                  <div className="flex gap-2">
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-secondary"
                      onClick={() => setMessageText((p) => p + (activeTab === "contacts" ? " {{nome}}" : " {{grupo}}"))}
                    >
                      {activeTab === "contacts" ? "+ Variável Nome" : "+ Variável Grupo"}
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
                  placeholder={
                    activeTab === "contacts"
                      ? "Digite a mensagem aqui. Ex: {Olá|Oi} {{nome}}, confira as novidades..."
                      : "Digite a mensagem aqui. Ex: {Olá, pessoal|Oi grupo} do {{grupo}}, vejam isso..."
                  }
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                />
                <p className="text-[11px] text-muted-foreground font-mono leading-relaxed bg-secondary/20 p-2 rounded-lg border border-border">
                  Use Spintax com chaves e barras verticais: <code>{"{Olá|Oi}"}</code>. O sistema irá sortear uma das palavras para cada envio.
                  {activeTab === "contacts" ? (
                    <> Para o nome do contato, insira <code>{"{{nome}}"}</code>.</>
                  ) : (
                    <> Para o nome do grupo, insira <code>{"{{grupo}}"}</code>.</>
                  )}
                </p>
              </div>

              {/* Media Upload */}
              <div className="space-y-2">
                <Label>Anexo de Mídia (Opcional)</Label>
                <div className="flex items-center gap-4">
                  <UIButton
                    variant="outline"
                    size="sm"
                    className="relative cursor-pointer"
                    disabled={uploadingMedia}
                  >
                    {uploadingMedia ? (
                      <><RefreshCw className="animate-spin size-4 mr-2" /> Enviando...</>
                    ) : (
                      <><Upload className="size-4 mr-2" /> Escolher Imagem/Vídeo</>
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

            {/* Anti-Ban & Simulation Settings */}
            <div className="space-y-4 border-t border-border/40 pt-4">
              <Label>Configurações de Envio Seguro (Anti-Ban)</Label>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Intervalo de Delay (Em Segundos)</Label>
                  <div className="flex gap-4">
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="min-delay" className="text-xs text-muted-foreground">Mínimo</Label>
                      <Input
                        id="min-delay"
                        type="number"
                        min={5}
                        value={minDelay}
                        onChange={(e) => setMinDelay(Number(e.target.value))}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor="max-delay" className="text-xs text-muted-foreground">Máximo</Label>
                      <Input
                        id="max-delay"
                        type="number"
                        min={minDelay}
                        value={maxDelay}
                        onChange={(e) => setMaxDelay(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 text-amber-400 mt-1">
                    <AlertTriangle className="size-3.5 shrink-0" />
                    {activeTab === "contacts"
                      ? "Recomendamos deixar entre 15 e 45 segundos para envio direto a contatos."
                      : "Atenção: Para grupos, recomendamos atraso mínimo de 60 a 180 segundos!"}
                  </p>
                </div>

                {activeTab === "groups" && (
                  <div className="space-y-2 flex flex-col justify-end pb-1.5">
                    <label className="flex items-center gap-2 cursor-pointer text-sm font-medium bg-secondary/20 p-3 rounded-lg border border-border/40">
                      <input
                        type="checkbox"
                        checked={simulateTyping}
                        onChange={(e) => setSimulateTyping(e.target.checked)}
                      />
                      <div>
                        <p>Simular Digitação no WhatsApp</p>
                        <p className="text-xs font-normal text-muted-foreground">Mostra "Digitando..." por 5 segundos antes de cada envio.</p>
                      </div>
                    </label>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
          <CardFooter className="flex justify-end gap-2 border-t border-border/40 pt-4">
            <UIButton variant="ghost" onClick={() => setView("list")}>
              Cancelar
            </UIButton>
            <UIButton
              className="bg-gradient-primary shadow-glow text-primary-foreground font-semibold"
              onClick={activeTab === "contacts" ? handleStartCampaign : handleStartGroupCampaign}
              disabled={uploadingMedia}
            >
              <Send className="size-4 mr-2" /> Iniciar Disparo
            </UIButton>
          </CardFooter>
        </Card>
      )}

      {view === "monitor" && (
        <div className="space-y-6">
          {activeTab === "contacts" && activeCampaign ? (
            <Card className="border border-border/40 bg-gradient-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{activeCampaign.name} (Contatos)</CardTitle>
                    <CardDescription className="mt-1">
                      Instância de Envio: <strong>{activeCampaign.instanceName}</strong> · Delays:{" "}
                      <strong>
                        {activeCampaign.minDelay}s a {activeCampaign.maxDelay}s
                      </strong>
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
                        className={activeCampaign.status === "completed" ? "bg-success/20 text-success border-success/30 px-3 py-1.5 text-sm" : "px-3 py-1.5 text-sm"}
                      >
                        {activeCampaign.status === "completed" ? "Concluída" : "Encerrada"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Progresso da Campanha</span>
                    <span>
                      {progressPercent}% ({sentCount} / {totalRecs})
                    </span>
                  </div>
                  <Progress value={progressPercent} className="h-3 bg-secondary/80 rounded-full" />
                </div>

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

                {isSending && !paused && secondsLeft > 0 && (
                  <div className="flex items-center justify-center p-3 rounded-lg border border-accent/20 bg-accent/5 animate-pulse text-sm text-accent">
                    <RefreshCw className="animate-spin size-4 mr-2" /> Anti-Ban Ativo: Aguardando{" "}
                    {secondsLeft} segundos antes do próximo número...
                  </div>
                )}

                {isSending && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200 text-xs">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <strong>Atenção:</strong> Como o disparo é controlado pelo navegador (Client-side), <strong>não feche esta aba ou desligue o computador</strong> enquanto a campanha estiver ativa! Se você fechar a aba, o envio será interrompido e ficará pausado.
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Registro de Envios em Tempo Real</Label>
                  <div className="border border-border/40 rounded-xl overflow-hidden bg-secondary/10">
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-border/20 text-xs font-mono">
                      {recipients.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">Carregando contatos da fila...</div>
                      ) : (
                        recipients.map((r, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="font-semibold text-foreground">
                                {r.number}{" "}
                                {r.name && <span className="text-muted-foreground">({r.name})</span>}
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
          ) : activeTab === "groups" && activeGroupCampaign ? (
            <Card className="border border-border/40 bg-gradient-card">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{activeGroupCampaign.name} (Grupos)</CardTitle>
                    <CardDescription className="mt-1">
                      Instância de Envio: <strong>{activeGroupCampaign.instanceName}</strong> · Delays:{" "}
                      <strong>
                        {activeGroupCampaign.minDelay}s a {activeGroupCampaign.maxDelay}s
                      </strong>
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    {isSendingGroup ? (
                      <>
                        {pausedGroup ? (
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
                        variant={activeGroupCampaign.status === "completed" ? "secondary" : "destructive"}
                        className={activeGroupCampaign.status === "completed" ? "bg-success/20 text-success border-success/30 px-3 py-1.5 text-sm" : "px-3 py-1.5 text-sm"}
                      >
                        {activeGroupCampaign.status === "completed" ? "Concluída" : "Encerrada"}
                      </Badge>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm font-medium">
                    <span>Progresso da Campanha nos Grupos</span>
                    <span>
                      {Math.round(((groupRecipients.filter(r => r.status === "sent" || r.status === "failed").length) / (groupRecipients.length || 1)) * 100)}% ({groupRecipients.filter(r => r.status === "sent").length} / {groupRecipients.length})
                    </span>
                  </div>
                  <Progress
                    value={Math.round(((groupRecipients.filter(r => r.status === "sent" || r.status === "failed").length) / (groupRecipients.length || 1)) * 100)}
                    className="h-3 bg-secondary/80 rounded-full"
                  />
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-secondary/40 border border-border/30 rounded-xl p-4 text-center">
                    <p className="text-xs text-muted-foreground">Grupos</p>
                    <p className="text-2xl font-bold mt-1">{groupRecipients.length}</p>
                  </div>
                  <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center text-success">
                    <p className="text-xs text-muted-foreground">Enviados</p>
                    <p className="text-2xl font-bold mt-1">{groupRecipients.filter((r) => r.status === "sent").length}</p>
                  </div>
                  <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4 text-center text-destructive">
                    <p className="text-xs text-muted-foreground">Falhas</p>
                    <p className="text-2xl font-bold mt-1">{groupRecipients.filter((r) => r.status === "failed").length}</p>
                  </div>
                  <div className="bg-amber-500/5 border border-amber-500/20 rounded-xl p-4 text-center text-amber-400">
                    <p className="text-xs text-muted-foreground">Fila</p>
                    <p className="text-2xl font-bold mt-1">{groupRecipients.filter((r) => r.status === "pending").length}</p>
                  </div>
                </div>

                {isSendingGroup && !pausedGroup && secondsLeftGroup > 0 && (
                  <div className="flex items-center justify-center p-3 rounded-lg border border-accent/20 bg-accent/5 animate-pulse text-sm text-accent">
                    <RefreshCw className="animate-spin size-4 mr-2" /> Anti-Ban Ativo: Aguardando{" "}
                    {secondsLeftGroup} segundos antes do próximo grupo...
                  </div>
                )}

                {isSendingGroup && (
                  <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-500/20 bg-amber-500/5 text-amber-200 text-xs">
                    <AlertTriangle className="size-4 shrink-0 text-amber-400 mt-0.5" />
                    <div>
                      <strong>Atenção:</strong> Como o disparo é controlado pelo navegador (Client-side), <strong>não feche esta aba ou desligue o computador</strong> enquanto o envio para grupos estiver ativo! Fechar a aba interrompe o loop.
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <Label>Registro de Envios aos Grupos</Label>
                  <div className="border border-border/40 rounded-xl overflow-hidden bg-secondary/10">
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-border/20 text-xs font-mono">
                      {groupRecipients.length === 0 ? (
                        <div className="p-8 text-center text-muted-foreground">Carregando grupos da fila...</div>
                      ) : (
                        groupRecipients.map((r, idx) => (
                          <div key={idx} className="p-3 flex items-center justify-between hover:bg-secondary/20 transition-colors">
                            <div className="flex-1 min-w-0 space-y-0.5">
                              <p className="font-semibold text-foreground">
                                {r.groupName}{" "}
                                <span className="text-muted-foreground text-[10px]">({r.groupId})</span>
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
          ) : (
            <div className="p-8 text-center text-sm text-muted-foreground bg-secondary/15 rounded-xl border border-border">
              Nenhuma campanha ativa selecionada para monitoramento.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
