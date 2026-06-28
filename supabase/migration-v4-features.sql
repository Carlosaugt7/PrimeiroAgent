-- 1. Coluna de Frustração e Receita Gerada no CRM/Inbox
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "isFrustrated" boolean DEFAULT false;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "convertedValue" numeric DEFAULT 0;

-- 2. Colunas de Triagem nos Agentes e Conversas
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "triageEnabled" boolean DEFAULT false;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "triageQuestions" text[] DEFAULT '{}';

ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "triageAnswers" jsonb DEFAULT '{}';
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "triageCurrentIndex" integer DEFAULT 0;

-- 3. Tabela de Catálogo de Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  price numeric NOT NULL,
  "imageUrl" TEXT,
  "linkUrl" TEXT,
  "sku" TEXT,
  "isActive" boolean DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_products" ON public.products FOR ALL USING (true) WITH CHECK (true);
