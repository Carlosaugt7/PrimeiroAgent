-- 1. Coluna de Notas de Perfil na Conversa
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS "profileNotes" text;

-- 2. Colunas de Tokens no log de IA
ALTER TABLE public.ai_logs ADD COLUMN IF NOT EXISTS "inputTokens" integer DEFAULT 0;
ALTER TABLE public.ai_logs ADD COLUMN IF NOT EXISTS "outputTokens" integer DEFAULT 0;

-- 3. Tabela de Cache de Voz (ElevenLabs)
CREATE TABLE IF NOT EXISTS public.voice_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "voiceId" TEXT NOT NULL,
  "textHash" TEXT NOT NULL,
  "audioUrl" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  UNIQUE("tenantId", "voiceId", "textHash")
);

-- RLS
ALTER TABLE public.voice_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_voice_cache" ON public.voice_cache FOR ALL USING (true) WITH CHECK (true);
