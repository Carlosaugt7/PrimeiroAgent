import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useAppStore, type Product } from "@/lib/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Plus,
  Package,
  Search,
  Trash2,
  Edit,
  Loader2,
  DollarSign,
  Layers,
  Link as LinkIcon,
  Image as ImageIcon,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/app/catalog")({
  head: () => ({ meta: [{ title: "Catálogo de vendas — Primeiro Agent" }] }),
  component: CatalogPage,
});

function CatalogPage() {
  const { tenant } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Dialog State
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchProducts = async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenantId", tenant.id)
        .order("createdAt", { ascending: false });

      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao carregar catálogo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenant?.id]);

  const handleOpenNew = () => {
    setEditingProduct(null);
    setName("");
    setDescription("");
    setPrice("");
    setSku("");
    setLinkUrl("");
    setImageUrl("");
    setIsActive(true);
    setOpen(true);
  };

  const handleOpenEdit = (p: Product) => {
    setEditingProduct(p);
    setName(p.name);
    setDescription(p.description || "");
    setPrice(p.price.toString());
    setSku(p.sku || "");
    setLinkUrl(p.linkUrl || "");
    setImageUrl(p.imageUrl || "");
    setIsActive(p.isActive ?? true);
    setOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error("O nome do produto é obrigatório");
      return;
    }
    const parsedPrice = parseFloat(price);
    if (isNaN(parsedPrice) || parsedPrice < 0) {
      toast.error("Informe um preço válido (ex: 49.90)");
      return;
    }

    setBusy(true);
    try {
      const payload: Omit<Product, "id" | "createdAt"> = {
        tenantId: tenant!.id,
        name: name.trim(),
        description: description.trim() || null,
        price: parsedPrice,
        sku: sku.trim() || null,
        linkUrl: linkUrl.trim() || null,
        imageUrl: imageUrl.trim() || null,
        isActive,
      };

      if (editingProduct) {
        const { error } = await supabase
          .from("products")
          .update(payload)
          .eq("id", editingProduct.id)
          .eq("tenantId", tenant!.id);

        if (error) throw error;
        toast.success("Produto atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("products").insert([payload]);

        if (error) throw error;
        toast.success("Produto adicionado ao catálogo!");
      }

      setOpen(false);
      fetchProducts();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar produto");
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir permanentemente este produto do catálogo?"))
      return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id)
        .eq("tenantId", tenant!.id);

      if (error) throw error;
      toast.success("Produto removido do catálogo!");
      fetchProducts();
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Erro ao excluir produto");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.description && p.description.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold">Catálogo de Vendas</h1>
          <p className="text-muted-foreground mt-1">
            Cadastre os itens da sua loja para que a Inteligência Artificial possa consultá-los e
            vendê-los.
          </p>
        </div>
        <Button variant="hero" onClick={handleOpenNew}>
          <Plus className="size-4 mr-2" /> Novo Produto
        </Button>
      </div>

      {/* Busca */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Pesquisar por nome, SKU ou descrição..."
          className="pl-9"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center p-12 min-h-[40vh]">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-12 text-center">
          <Package className="size-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-semibold">Nenhum produto encontrado</p>
          <p className="text-sm text-muted-foreground mt-1">
            {searchQuery
              ? "Nenhum resultado corresponde à sua pesquisa."
              : "Cadastre produtos para iniciar seu catálogo de vendas da IA."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProducts.map((p) => (
            <div
              key={p.id}
              className={`rounded-2xl border p-5 bg-gradient-card flex flex-col justify-between gap-4 transition-all ${
                p.isActive ? "border-border" : "border-border opacity-60"
              }`}
            >
              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display font-bold text-lg leading-tight line-clamp-1">
                    {p.name}
                  </h3>
                  <Badge variant={p.isActive ? "default" : "outline"} className="shrink-0">
                    {p.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </div>

                {p.sku && (
                  <p className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                    <Layers className="size-3" /> SKU: {p.sku}
                  </p>
                )}

                <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                  {p.description || "Sem descrição disponível."}
                </p>
              </div>

              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground font-medium">Preço de venda</span>
                  <span className="font-display font-bold text-xl text-emerald-400">
                    R$ {p.price.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {p.linkUrl && (
                  <a
                    href={p.linkUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                  >
                    <LinkIcon className="size-3" /> Ver link de pagamento/checkout
                  </a>
                )}

                <div className="flex items-center justify-end gap-2 pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpenEdit(p)}
                    className="h-8 px-3"
                  >
                    <Edit className="size-3.5 mr-1.5" /> Editar
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(p.id)}
                    className="size-8 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Dialog Formulário */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingProduct ? "Editar Produto" : "Novo Produto"}</DialogTitle>
            <DialogDescription>
              Insira os dados do item do catálogo. O assistente de IA usará esses campos exatos para
              informar os clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-name">Nome do Produto *</Label>
                <Input
                  id="prod-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Tênis Air Max"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="prod-price">Preço (R$) *</Label>
                <Input
                  id="prod-price"
                  type="number"
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="Ex: 299.90"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="prod-desc">Descrição Detalhada para a IA</Label>
              <Textarea
                id="prod-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Insira especificações, tamanhos, cores ou indicações importantes para a IA usar durante o chat."
                className="mt-1 min-h-[80px]"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="prod-sku">SKU / Código</Label>
                <Input
                  id="prod-sku"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                  placeholder="Ex: TENIS-41-PRETO"
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="prod-link">Link de Pagamento / Compra</Label>
                <Input
                  id="prod-link"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="Ex: https://checkout.exemplo.com/pagar"
                  className="mt-1"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="prod-img">URL da Imagem do Produto</Label>
              <Input
                id="prod-img"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                placeholder="Ex: https://fotos.exemplo.com/produto.jpg"
                className="mt-1"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/10">
              <div>
                <Label className="text-sm font-semibold">Produto Disponível para Vendas</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Desative para ocultar temporariamente o item da busca do assistente.
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancelar
            </Button>
            <Button onClick={handleSave} disabled={busy} variant="hero">
              {busy ? "Salvando..." : "Salvar Produto"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
