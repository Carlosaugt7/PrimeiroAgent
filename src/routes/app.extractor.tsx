import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import {
  listInstances,
  listGroups,
  fetchInstanceContacts,
  fetchGroupParticipants,
} from "@/lib/evolution.functions";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button as UIButton } from "@/components/ui/button";
import {
  Download,
  RefreshCw,
  FileSpreadsheet,
  AlertTriangle,
  Search,
  Users,
  CheckCircle,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/app/extractor")({
  head: () => ({ meta: [{ title: "Extrator de Contatos — AgentFlow IA" }] }),
  component: ExtractorPage,
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

interface ContactItem {
  id: string;
  name: string;
  number: string;
  origin: string;
  selected: boolean;
}

function ExtractorPage() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id ?? "";

  // Instâncias e grupos
  const [instances, setInstances] = useState<InstanceItem[]>([]);
  const [loadingInstances, setLoadingInstances] = useState(false);
  const [selectedInstance, setSelectedInstance] = useState("");

  const [groups, setGroups] = useState<GroupItem[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState("");

  // Abas e listagens
  const [activeTab, setActiveTab] = useState<"agenda" | "grupos">("agenda");
  const [contacts, setContacts] = useState<ContactItem[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Carrega instâncias ao iniciar
  useEffect(() => {
    if (tenantId) {
      loadInstances();
    }
  }, [tenantId]);

  // Carrega grupos quando muda a instância na aba grupos
  useEffect(() => {
    if (tenantId && selectedInstance && activeTab === "grupos") {
      loadGroups();
    }
  }, [selectedInstance, activeTab, tenantId]);

  const loadInstances = async () => {
    setLoadingInstances(true);
    try {
      const insts = await listInstances({ data: { tenantId } });
      const connected = insts.filter((i: any) => i.status === "open" || i.status === "CONNECTED");
      setInstances(connected);
      if (connected.length > 0 && !selectedInstance) {
        setSelectedInstance(connected[0].instanceName);
      }
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar as instâncias.");
    } finally {
      setLoadingInstances(false);
    }
  };

  const loadGroups = async () => {
    setLoadingGroups(true);
    setGroups([]);
    setSelectedGroup("");
    try {
      const res = await listGroups({ data: { tenantId, instanceName: selectedInstance } });
      setGroups(res as GroupItem[]);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar os grupos da instância.");
    } finally {
      setLoadingGroups(false);
    }
  };

  // Limpa o número de JID para formato internacional puro (ex: 5511999999999)
  const cleanNumber = (jid: string): string => {
    if (!jid) return "";
    const prefix = jid.split("@")[0].split(":")[0];
    return prefix.replace(/\D/g, "");
  };

  // Validação automática de contatos de sistema e broadcasts
  const isValidContact = (jid: string): boolean => {
    if (!jid) return false;
    const numberPart = jid.split("@")[0].split(":")[0];
    
    // Deve conter apenas dígitos e ter um tamanho razoável (DDI + DDD + Número)
    if (!/^\d+$/.test(numberPart)) return false;
    if (numberPart.length < 8) return false;
    
    // Evitar broadcasts, JID '0' ou contatos oficiais de sistema
    if (numberPart === "0" || jid.includes("broadcast") || jid.includes("status")) return false;
    
    return true;
  };

  // Resolução inteligente dos nomes de contatos para evitar JID/Código
  const resolveName = (c: any, num: string): string => {
    let resolved = (c.name || c.pushName || c.verifiedName || "").trim();
    
    // Se o nome contiver @, for igual ao ID ou for estritamente numérico igual ao número, limpamos
    if (!resolved || resolved.includes("@") || resolved === c.id || resolved.replace(/\D/g, "") === num) {
      return "";
    }
    
    return resolved;
  };

  // Busca contatos da agenda (findContacts)
  const handleFetchContacts = async () => {
    if (!selectedInstance) {
      toast.error("Por favor, selecione uma instância WhatsApp ativa.");
      return;
    }
    setLoadingContacts(true);
    setContacts([]);
    try {
      const res = await fetchInstanceContacts({ data: { tenantId, instanceName: selectedInstance } });
      
      // Mapeia, filtra automaticamente e limpa
      const filtered = (res as any[])
        .filter((c) => isValidContact(c.id))
        .map((c) => {
          const num = cleanNumber(c.id);
          return {
            id: c.id,
            name: resolveName(c, num),
            number: num,
            origin: "Agenda",
            selected: true,
          };
        });

      setContacts(filtered);
      toast.success(`${filtered.length} contatos válidos importados com sucesso!`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao buscar contatos da agenda.");
    } finally {
      setLoadingContacts(false);
    }
  };

  // Busca participantes do grupo selecionado
  const handleFetchGroupParticipants = async () => {
    if (!selectedInstance) {
      toast.error("Por favor, selecione uma instância.");
      return;
    }
    if (!selectedGroup) {
      toast.error("Por favor, selecione um grupo.");
      return;
    }
    setLoadingContacts(true);
    setContacts([]);
    try {
      // 1. Busca todos os contatos da agenda primeiro para servir como um dicionário de nomes salvos
      const agendaRes = await fetchInstanceContacts({
        data: { tenantId, instanceName: selectedInstance },
      });
      const namesMap = new Map<string, string>();
      if (Array.isArray(agendaRes)) {
        agendaRes.forEach((c) => {
          const num = cleanNumber(c.id);
          const resolvedName = resolveName(c, num);
          if (resolvedName) {
            namesMap.set(num, resolvedName);
          }
        });
      }

      // 2. Busca participantes do grupo
      const res = await fetchGroupParticipants({
        data: { tenantId, instanceName: selectedInstance, groupJid: selectedGroup },
      });

      const filtered = (res as any[])
        .filter((c) => isValidContact(c.id))
        .map((c) => {
          const num = cleanNumber(c.id);
          let name = resolveName(c, num);
          if (!name && namesMap.has(num)) {
            name = namesMap.get(num)!;
          }

          return {
            id: c.id,
            name,
            number: num,
            origin: "Grupo",
            selected: true,
          };
        });

      setContacts(filtered);
      toast.success(`${filtered.length} participantes válidos importados do grupo!`);
    } catch (e) {
      console.error(e);
      toast.error("Falha ao buscar participantes do grupo.");
    } finally {
      setLoadingContacts(false);
    }
  };

  // Controle de checkboxes
  const handleToggleSelectAll = (checked: boolean) => {
    setContacts((prev) => prev.map((c) => ({ ...c, selected: checked })));
  };

  const handleToggleSelectOne = (id: string, checked: boolean) => {
    setContacts((prev) => prev.map((c) => (c.id === id ? { ...c, selected: checked } : c)));
  };

  const selectedCount = contacts.filter((c) => c.selected).length;

  // Filtro de pesquisa local
  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.number.includes(searchQuery)
  );

  // Geração de CSV
  const handleExportCSV = () => {
    const targets = contacts.filter((c) => c.selected);
    if (targets.length === 0) {
      toast.error("Nenhum contato selecionado para exportação.");
      return;
    }

    // Formato amigável pro Excel (UTF-8 com BOM e delimitador ;)
    const headers = "Número;Nome\n";
    const rows = targets
      .map((c) => `="${c.number}";"${c.name.replace(/"/g, '""')}"`)
      .join("\n");
    
    const blob = new Blob(["\ufeff" + headers + rows], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const label = activeTab === "agenda" ? "contatos_agenda" : "participantes_grupo";
    
    link.setAttribute("href", url);
    link.setAttribute("download", `${label}_${selectedInstance}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success("CSV exportado com sucesso!");
  };

  // Geração de XLSX (Excel)
  const handleExportXLSX = () => {
    const targets = contacts.filter((c) => c.selected);
    if (targets.length === 0) {
      toast.error("Nenhum contato selecionado para exportação.");
      return;
    }

    const worksheetData = targets.map((c) => ({
      "Número": c.number,
      "Nome": c.name,
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData, { raw: true } as any);

    // Forçar coluna A (Número) a ser tratada como texto para evitar notação científica no Excel
    Object.keys(worksheet).forEach((key) => {
      if (/^A\d+$/.test(key) && key !== "A1") {
        if (worksheet[key]) {
          worksheet[key].t = "s"; // Tipo: String
          worksheet[key].v = String(worksheet[key].v); // Garante que o valor é string
          worksheet[key].z = "@"; // Formato no Excel: Texto
        }
      }
    });

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Contatos");
    
    const label = activeTab === "agenda" ? "contatos_agenda" : "participantes_grupo";
    XLSX.writeFile(workbook, `${label}_${selectedInstance}_${Date.now()}.xlsx`);
    
    toast.success("Excel (.xlsx) exportado com sucesso!");
  };

  return (
    <div className="space-y-6 max-w-6xl pb-10">
      <div className="flex items-center justify-between border-b border-border/40 pb-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
            Extrator de Contatos
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Extraia contatos reais da sua agenda ou de grupos da instância em formato internacional limpo e pronto para envio.
          </p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Lado Esquerdo: Configurações de Origem */}
        <div className="space-y-6">
          <Card className="border border-border/40 bg-gradient-card">
            <CardHeader>
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Smartphone className="size-4 text-accent" />
                Origem da Extração
              </CardTitle>
              <CardDescription>
                Selecione a instância do WhatsApp e o tipo de extração desejada.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="instance">Instância WhatsApp ativa</Label>
                {loadingInstances ? (
                  <div className="text-sm text-muted-foreground py-2 flex items-center">
                    <RefreshCw className="animate-spin size-4 mr-2" /> Carregando conexões...
                  </div>
                ) : instances.length === 0 ? (
                  <div className="text-xs text-red-400 py-1 bg-red-950/20 border border-red-500/20 rounded-md p-2 flex items-start gap-2">
                    <AlertTriangle className="size-4 shrink-0 mt-0.5" />
                    <span>Nenhuma instância conectada no momento. Conecte no menu WhatsApp primeiro.</span>
                  </div>
                ) : (
                  <select
                    id="instance"
                    className="w-full h-10 px-3 rounded-lg bg-secondary/60 border border-border text-sm focus:outline-none"
                    value={selectedInstance}
                    onChange={(e) => {
                      setSelectedInstance(e.target.value);
                      setContacts([]);
                    }}
                  >
                    {instances.map((i) => (
                      <option key={i.instanceName} value={i.instanceName}>
                        {i.instanceName}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {activeTab === "grupos" && selectedInstance && (
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <Label htmlFor="group">Selecione o Grupo</Label>
                  {loadingGroups ? (
                    <div className="text-sm text-muted-foreground py-2 flex items-center">
                      <RefreshCw className="animate-spin size-4 mr-2" /> Buscando grupos...
                    </div>
                  ) : groups.length === 0 ? (
                    <p className="text-xs text-muted-foreground py-2 text-center border border-dashed border-border rounded-lg">
                      Nenhum grupo encontrado nesta instância.
                    </p>
                  ) : (
                    <select
                      id="group"
                      className="w-full h-10 px-3 rounded-lg bg-secondary/60 border border-border text-sm focus:outline-none"
                      value={selectedGroup}
                      onChange={(e) => {
                        setSelectedGroup(e.target.value);
                        setContacts([]);
                      }}
                    >
                      <option value="">Selecione um grupo...</option>
                      {groups.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name} ({g.size ?? "N/A"} partic.)
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="pt-4">
                {activeTab === "agenda" ? (
                  <UIButton
                    className="w-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                    onClick={handleFetchContacts}
                    disabled={loadingContacts || !selectedInstance}
                  >
                    {loadingContacts ? (
                      <><RefreshCw className="animate-spin size-4 mr-2" /> Extraindo...</>
                    ) : (
                      <><Download className="size-4 mr-2" /> Extrair Toda Agenda</>
                    )}
                  </UIButton>
                ) : (
                  <UIButton
                    className="w-full bg-gradient-primary text-primary-foreground font-semibold shadow-glow"
                    onClick={handleFetchGroupParticipants}
                    disabled={loadingContacts || !selectedInstance || !selectedGroup}
                  >
                    {loadingContacts ? (
                      <><RefreshCw className="animate-spin size-4 mr-2" /> Extraindo...</>
                    ) : (
                      <><Download className="size-4 mr-2" /> Extrair Participantes</>
                    )}
                  </UIButton>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-500/20 bg-amber-500/5 text-amber-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold flex items-center gap-2">
                <AlertTriangle className="size-4 text-amber-400" />
                Higienização Automática
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-2 leading-relaxed text-amber-200/90">
              <p>Para evitar erros de envio nas campanhas, o sistema processa os contatos automaticamente:</p>
              <ul className="list-disc pl-4 space-y-1">
                <li><strong>Números Reais:</strong> Remove sufixos como <code>@s.whatsapp.net</code> e IDs de multidevice (ex: <code>:2</code>).</li>
                <li><strong>DDI+DDD+Número:</strong> Formata mantendo apenas dígitos numéricos puros.</li>
                <li><strong>Prevenção de Códigos:</strong> Filtra contatos de sistema (broadcasts/status) e zera nomes que venham salvos como códigos JID numéricos na agenda.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Lado Direito: Resultados e Tabela de Ações */}
        <div className="md:col-span-2 space-y-6">
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              setActiveTab(v as "agenda" | "grupos");
              setContacts([]);
              setSearchQuery("");
            }}
            className="w-full"
          >
            <TabsList className="grid w-full max-w-sm grid-cols-2 bg-secondary/40 p-1 rounded-xl">
              <TabsTrigger value="agenda" className="rounded-lg">Extrair da Agenda</TabsTrigger>
              <TabsTrigger value="grupos" className="rounded-lg flex items-center gap-1">
                <Users className="size-3.5" /> Extrair de Grupos
              </TabsTrigger>
            </TabsList>

            <TabsContent value="agenda" className="outline-none pt-4">
              {/* Resultados da Agenda */}
            </TabsContent>
            <TabsContent value="grupos" className="outline-none pt-4">
              {/* Resultados de Grupos */}
            </TabsContent>
          </Tabs>

          <Card className="border border-border/40 bg-gradient-card">
            <CardHeader className="pb-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-semibold">Fila de Contatos Extraídos</CardTitle>
                <CardDescription>
                  Selecione os contatos e faça o download da base limpa.
                </CardDescription>
              </div>
              {contacts.length > 0 && (
                <div className="flex items-center gap-2">
                  <UIButton
                    variant="outline"
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={selectedCount === 0}
                  >
                    <FileSpreadsheet className="size-4 mr-1.5 text-accent" /> Exportar CSV
                  </UIButton>
                  <UIButton
                    className="bg-accent text-accent-foreground font-semibold shadow-glow hover:opacity-90"
                    size="sm"
                    onClick={handleExportXLSX}
                    disabled={selectedCount === 0}
                  >
                    <Download className="size-4 mr-1.5" /> Exportar Excel
                  </UIButton>
                </div>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {contacts.length > 0 ? (
                <>
                  {/* Busca e informações */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-secondary/20 p-3 rounded-lg border border-border/40">
                    <div className="relative flex-1 max-w-xs">
                      <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder="Buscar contatos locais..."
                        className="pl-9 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <UIButton
                        variant="outline"
                        size="sm"
                        className="h-8 text-[11px] font-medium"
                        onClick={() => {
                          const allSelected = selectedCount === contacts.length;
                          handleToggleSelectAll(!allSelected);
                        }}
                      >
                        {selectedCount === contacts.length ? "Desmarcar Todos" : "Selecionar Todos"}
                      </UIButton>
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <CheckCircle className="size-4 text-success" />
                        <span>
                          <strong>{selectedCount}</strong> contatos selecionados de{" "}
                          <strong>{contacts.length}</strong> encontrados
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Tabela de Contatos */}
                  <div className="border border-border/40 rounded-xl overflow-hidden bg-secondary/5">
                    <div className="max-h-[350px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead>
                          <tr className="border-b border-border/40 bg-secondary/20">
                            <th className="p-3 w-12 text-center">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={contacts.length > 0 && selectedCount === contacts.length}
                                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                              />
                            </th>
                            <th className="p-3 font-semibold text-muted-foreground">Nome Resolvido</th>
                            <th className="p-3 font-semibold text-muted-foreground">Número de Telefone</th>
                            <th className="p-3 font-semibold text-muted-foreground">Origem</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/20 font-mono">
                          {filteredContacts.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="p-8 text-center text-muted-foreground font-sans">
                                Nenhum contato corresponde à busca local.
                              </td>
                            </tr>
                          ) : (
                            filteredContacts.map((c) => (
                              <tr
                                key={c.id}
                                className="hover:bg-secondary/20 transition-colors cursor-pointer"
                                onClick={() => handleToggleSelectOne(c.id, !c.selected)}
                              >
                                <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                  <input
                                    type="checkbox"
                                    className="cursor-pointer"
                                    checked={c.selected}
                                    onChange={(e) => handleToggleSelectOne(c.id, e.target.checked)}
                                  />
                                </td>
                                <td className="p-3 font-sans font-medium text-foreground">
                                  {c.name ? (
                                    c.name
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground italic font-sans">
                                      Sem nome (Salvo apenas número)
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-foreground font-semibold">{c.number}</td>
                                <td className="p-3">
                                  <Badge variant="outline" className="bg-secondary/40 text-[10px] uppercase font-sans">
                                    {c.origin}
                                  </Badge>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-center py-16 text-sm text-muted-foreground border border-dashed border-border/40 rounded-xl bg-secondary/5">
                  <Download className="size-8 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="font-semibold">Nenhum contato extraído ainda</p>
                  <p className="text-xs text-muted-foreground/80 mt-1 max-w-xs mx-auto">
                    Selecione a instância ao lado e clique em extrair para carregar a base de contatos.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
