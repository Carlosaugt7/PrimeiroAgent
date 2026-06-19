-- Adicionar chave ElevenLabs no Tenant
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS "elevenlabsApiKey" text;

-- Adicionar configurações de voz no Agente
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "elevenlabsVoiceId" text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "elevenlabsVoiceGender" text;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS "voiceResponseMode" text DEFAULT 'audio_only_on_audio'; -- 'text_only', 'audio_only_on_audio', 'always_audio'

-- Recarregar cache do schema
NOTIFY pgrst, 'reload schema';
