import { createServerFn } from "@tanstack/react-start";
import { supabaseAdmin as supabase } from "@/integrations/supabase/client.server";

// ===== Google Auth Helper =====

interface GoogleCredentials {
  client_email: string;
  private_key: string;
  project_id: string;
}

async function getGoogleAccessToken(credentials: GoogleCredentials): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = btoa(
    JSON.stringify({
      iss: credentials.client_email,
      scope:
        "https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/spreadsheets",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    }),
  );

  const signInput = `${header}.${claim}`;

  // Import the private key for signing
  const pemContent = credentials.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const binaryKey = Uint8Array.from(atob(pemContent), (c) => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signInput),
  );

  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const jwt = `${header}.${claim}.${sig}`;

  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!r.ok) {
    const err = await r.text();
    throw new Error(`Google OAuth falhou: ${r.status} — ${err.slice(0, 300)}`);
  }

  const data = (await r.json()) as { access_token: string };
  return data.access_token;
}

// ===== Internal Helpers =====

async function getGoogleIntegration(tenantId: string, serviceType: "calendar" | "sheets") {
  const { data, error } = await supabase
    .from("google_integrations")
    .select("*")
    .eq("tenantId", tenantId)
    .eq("serviceType", serviceType)
    .eq("enabled", true)
    .single();

  if (error || !data) return null;
  return data as {
    id: string;
    tenantId: string;
    serviceType: string;
    credentialsJson: string | null;
    calendarId: string | null;
    spreadsheetId: string | null;
    sheetName: string | null;
    enabled: boolean;
  };
}

function parseCredentials(json: string | null): GoogleCredentials | null {
  if (!json) return null;
  try {
    const parsed = JSON.parse(json);
    if (parsed.client_email && parsed.private_key) return parsed as GoogleCredentials;
    return null;
  } catch {
    return null;
  }
}

// ===== Google Calendar Functions =====

export async function googleCalendarListEvents(
  tenantId: string,
  date: string,
): Promise<{ events: Array<{ id: string; summary: string; start: string; end: string }>; error?: string }> {
  try {
    const integration = await getGoogleIntegration(tenantId, "calendar");
    if (!integration?.credentialsJson) return { events: [], error: "Google Calendar não configurado" };

    const creds = parseCredentials(integration.credentialsJson);
    if (!creds) return { events: [], error: "Credenciais inválidas" };

    const token = await getGoogleAccessToken(creds);
    const calendarId = encodeURIComponent(integration.calendarId || "primary");
    const timeMin = `${date}T00:00:00Z`;
    const timeMax = `${date}T23:59:59Z`;

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!r.ok) {
      const err = await r.text();
      return { events: [], error: `Google Calendar API erro: ${r.status} — ${err.slice(0, 200)}` };
    }

    const data = (await r.json()) as {
      items: Array<{
        id: string;
        summary?: string;
        start: { dateTime?: string; date?: string };
        end: { dateTime?: string; date?: string };
      }>;
    };

    const events = (data.items || []).map((e) => ({
      id: e.id,
      summary: e.summary || "Sem título",
      start: e.start.dateTime || e.start.date || "",
      end: e.end.dateTime || e.end.date || "",
    }));

    return { events };
  } catch (e) {
    return { events: [], error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function googleCalendarGetAvailableSlots(
  tenantId: string,
  date: string,
  slotDurationMin = 60,
): Promise<string[]> {
  const WORK_HOURS = ["08:00", "09:00", "10:00", "11:00", "13:00", "14:00", "15:00", "16:00", "17:00"];

  const result = await googleCalendarListEvents(tenantId, date);
  if (result.error || result.events.length === 0) return WORK_HOURS;

  const busyHours = new Set<string>();
  for (const ev of result.events) {
    if (ev.start) {
      const hour = ev.start.includes("T") ? ev.start.split("T")[1].slice(0, 5) : "";
      if (hour) busyHours.add(hour);
    }
  }

  return WORK_HOURS.filter((h) => !busyHours.has(h));
}

export async function googleCalendarCreateEvent(
  tenantId: string,
  title: string,
  date: string,
  time: string,
  durationMin = 60,
  description?: string,
): Promise<{ ok: boolean; eventId?: string; error?: string }> {
  try {
    const integration = await getGoogleIntegration(tenantId, "calendar");
    if (!integration?.credentialsJson) return { ok: false, error: "Google Calendar não configurado" };

    const creds = parseCredentials(integration.credentialsJson);
    if (!creds) return { ok: false, error: "Credenciais inválidas" };

    const token = await getGoogleAccessToken(creds);
    const calendarId = encodeURIComponent(integration.calendarId || "primary");

    const startDateTime = `${date}T${time}:00`;
    const endDate = new Date(`${date}T${time}:00`);
    endDate.setMinutes(endDate.getMinutes() + durationMin);
    const endDateTime = endDate.toISOString().replace("Z", "");

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: title,
          description: description || `Agendamento criado via AgentFlow IA`,
          start: { dateTime: startDateTime, timeZone: "America/Sao_Paulo" },
          end: { dateTime: endDateTime, timeZone: "America/Sao_Paulo" },
        }),
      },
    );

    if (!r.ok) {
      const err = await r.text();
      return { ok: false, error: `Erro ao criar evento: ${r.status} — ${err.slice(0, 200)}` };
    }

    const data = (await r.json()) as { id: string };
    return { ok: true, eventId: data.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function googleCalendarCancelEvent(
  tenantId: string,
  eventId: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const integration = await getGoogleIntegration(tenantId, "calendar");
    if (!integration?.credentialsJson) return { ok: false, error: "Google Calendar não configurado" };

    const creds = parseCredentials(integration.credentialsJson);
    if (!creds) return { ok: false, error: "Credenciais inválidas" };

    const token = await getGoogleAccessToken(creds);
    const calendarId = encodeURIComponent(integration.calendarId || "primary");

    const r = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${encodeURIComponent(eventId)}`,
      {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      },
    );

    if (!r.ok && r.status !== 410) {
      const err = await r.text();
      return { ok: false, error: `Erro ao cancelar: ${r.status} — ${err.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

// ===== Google Sheets Functions =====

export async function googleSheetsSearch(
  tenantId: string,
  query: string,
): Promise<{ rows: string[][]; headers: string[]; error?: string }> {
  try {
    const integration = await getGoogleIntegration(tenantId, "sheets");
    if (!integration?.credentialsJson || !integration?.spreadsheetId) {
      return { rows: [], headers: [], error: "Google Sheets não configurado" };
    }

    const creds = parseCredentials(integration.credentialsJson);
    if (!creds) return { rows: [], headers: [], error: "Credenciais inválidas" };

    const token = await getGoogleAccessToken(creds);
    const sheetName = encodeURIComponent(integration.sheetName || "Sheet1");

    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${integration.spreadsheetId}/values/${sheetName}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!r.ok) {
      const err = await r.text();
      return { rows: [], headers: [], error: `Erro ao ler planilha: ${r.status} — ${err.slice(0, 200)}` };
    }

    const data = (await r.json()) as { values?: string[][] };
    const allRows = data.values || [];
    if (allRows.length === 0) return { rows: [], headers: [] };

    const headers = allRows[0];
    const dataRows = allRows.slice(1);

    if (!query.trim()) return { rows: dataRows.slice(0, 20), headers };

    const lowerQuery = query.toLowerCase();
    const matched = dataRows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(lowerQuery)),
    );

    return { rows: matched.slice(0, 20), headers };
  } catch (e) {
    return { rows: [], headers: [], error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

export async function googleSheetsAppendRow(
  tenantId: string,
  values: string[],
): Promise<{ ok: boolean; error?: string }> {
  try {
    const integration = await getGoogleIntegration(tenantId, "sheets");
    if (!integration?.credentialsJson || !integration?.spreadsheetId) {
      return { ok: false, error: "Google Sheets não configurado" };
    }

    const creds = parseCredentials(integration.credentialsJson);
    if (!creds) return { ok: false, error: "Credenciais inválidas" };

    const token = await getGoogleAccessToken(creds);
    const sheetName = encodeURIComponent(integration.sheetName || "Sheet1");

    const r = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${integration.spreadsheetId}/values/${sheetName}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ values: [values] }),
      },
    );

    if (!r.ok) {
      const err = await r.text();
      return { ok: false, error: `Erro ao adicionar: ${r.status} — ${err.slice(0, 200)}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
  }
}

// ===== Server Functions for UI =====

export const saveGoogleIntegration = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      tenantId: string;
      serviceType: "calendar" | "sheets";
      credentialsJson: string;
      calendarId?: string;
      spreadsheetId?: string;
      sheetName?: string;
    }) => {
      if (!d?.tenantId) throw new Error("tenantId ausente");
      if (!d?.serviceType) throw new Error("serviceType ausente");
      return d;
    },
  )
  .handler(async ({ data }) => {
    // Validate credentials JSON
    if (data.credentialsJson) {
      try {
        const parsed = JSON.parse(data.credentialsJson);
        if (!parsed.client_email || !parsed.private_key) {
          throw new Error("JSON inválido: precisa ter client_email e private_key");
        }
      } catch (e) {
        if (e instanceof SyntaxError) throw new Error("JSON inválido");
        throw e;
      }
    }

    const { error } = await supabase.from("google_integrations").upsert(
      {
        tenantId: data.tenantId,
        serviceType: data.serviceType,
        credentialsJson: data.credentialsJson || null,
        calendarId: data.calendarId || "primary",
        spreadsheetId: data.spreadsheetId || null,
        sheetName: data.sheetName || "Sheet1",
        enabled: true,
        updatedAt: new Date().toISOString(),
      },
      { onConflict: "tenantId,serviceType" },
    );

    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getGoogleIntegrations = createServerFn({ method: "POST" })
  .inputValidator((d: { tenantId: string }) => {
    if (!d?.tenantId) throw new Error("tenantId ausente");
    return d;
  })
  .handler(async ({ data }) => {
    const { data: integrations } = await supabase
      .from("google_integrations")
      .select("*")
      .eq("tenantId", data.tenantId);

    return { integrations: integrations || [] };
  });

export const testGoogleConnection = createServerFn({ method: "POST" })
  .inputValidator(
    (d: {
      credentialsJson: string;
      serviceType: "calendar" | "sheets";
      calendarId?: string;
      spreadsheetId?: string;
    }) => {
      if (!d?.credentialsJson) throw new Error("Credenciais ausentes");
      return d;
    },
  )
  .handler(async ({ data }) => {
    try {
      const creds = parseCredentials(data.credentialsJson);
      if (!creds) return { ok: false, error: "JSON de credenciais inválido" };

      const token = await getGoogleAccessToken(creds);

      if (data.serviceType === "calendar") {
        const calId = encodeURIComponent(data.calendarId || "primary");
        const r = await fetch(
          `https://www.googleapis.com/calendar/v3/calendars/${calId}`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!r.ok) {
          const err = await r.text();
          return { ok: false, error: `Erro no Calendar: ${r.status} — ${err.slice(0, 200)}` };
        }
        const cal = (await r.json()) as { summary?: string };
        return { ok: true, info: `Calendário: ${cal.summary || "OK"}` };
      }

      if (data.serviceType === "sheets" && data.spreadsheetId) {
        const r = await fetch(
          `https://sheets.googleapis.com/v4/spreadsheets/${data.spreadsheetId}?fields=properties.title`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!r.ok) {
          const err = await r.text();
          return { ok: false, error: `Erro no Sheets: ${r.status} — ${err.slice(0, 200)}` };
        }
        const sheet = (await r.json()) as { properties?: { title?: string } };
        return { ok: true, info: `Planilha: ${sheet.properties?.title || "OK"}` };
      }

      return { ok: true, info: "Credenciais válidas" };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "Erro desconhecido" };
    }
  });
