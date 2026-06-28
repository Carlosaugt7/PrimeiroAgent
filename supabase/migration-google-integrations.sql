-- Migration: Google Calendar + Google Sheets integration
-- Tabela para armazenar credenciais e configurações de integrações Google por tenant

CREATE TABLE IF NOT EXISTS google_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "tenantId" TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  "serviceType" TEXT NOT NULL CHECK ("serviceType" IN ('calendar', 'sheets')),
  "credentialsJson" TEXT,
  "calendarId" TEXT DEFAULT 'primary',
  "spreadsheetId" TEXT,
  "sheetName" TEXT DEFAULT 'Sheet1',
  "enabled" BOOLEAN DEFAULT true,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now(),
  UNIQUE("tenantId", "serviceType")
);

-- RLS
ALTER TABLE google_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_google_integrations" ON google_integrations
  FOR ALL USING (true) WITH CHECK (true);

-- Índice
CREATE INDEX IF NOT EXISTS idx_google_integrations_tenant ON google_integrations("tenantId");
