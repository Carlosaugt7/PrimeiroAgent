// Script para configurar webhook corretamente no Evolution API
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INSTANCE_NAME = 'RS_Consultoria-EAD';
const WEBHOOK_URL = 'https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook';

async function configurarWebhook() {
  console.log('🔧 CONFIGURAR WEBHOOK - RS Consultoria EAD\n');
  console.log('='.repeat(80));

  // Buscar credenciais
  const { data: globalSettings } = await supabase
    .from('global_settings')
    .select('*')
    .in('key', ['evolutionApiUrl', 'evolutionApiKey']);

  const config = {};
  globalSettings?.forEach(s => {
    config[s.key] = s.value;
  });

  const EVOLUTION_URL = config.evolutionApiUrl || 'https://evolution-api.rsconsultoria.pro';
  const EVOLUTION_KEY = config.evolutionApiKey;

  console.log('📋 Configuração:');
  console.log(`   Evolution URL: ${EVOLUTION_URL}`);
  console.log(`   Instância: ${INSTANCE_NAME}`);
  console.log(`   Webhook URL: ${WEBHOOK_URL}\n`);

  if (!EVOLUTION_KEY) {
    console.log('❌ API Key não configurada!');
    return;
  }

  console.log('='.repeat(80));

  // Testar diferentes payloads
  const payloads = [
    {
      nome: 'Payload 1 - Estrutura com webhook object',
      data: {
        webhook: {
          enabled: true,
          url: WEBHOOK_URL,
          events: [
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'MESSAGES_DELETE',
            'CONNECTION_UPDATE'
          ],
          webhookByEvents: false
        }
      }
    },
    {
      nome: 'Payload 2 - Estrutura direta',
      data: {
        enabled: true,
        url: WEBHOOK_URL,
        events: [
          'MESSAGES_UPSERT',
          'MESSAGES_UPDATE',
          'CONNECTION_UPDATE'
        ]
      }
    },
    {
      nome: 'Payload 3 - Webhook object simplificado',
      data: {
        webhook: {
          url: WEBHOOK_URL,
          enabled: true,
          events: ['MESSAGES_UPSERT', 'MESSAGES_UPDATE']
        }
      }
    }
  ];

  for (const payload of payloads) {
    console.log(`\n🔧 Tentando: ${payload.nome}\n`);
    console.log('📤 Payload:');
    console.log(JSON.stringify(payload.data, null, 2));
    console.log('');

    try {
      const res = await fetch(
        `${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`,
        {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload.data)
        }
      );

      console.log(`📊 Status: ${res.status}`);

      if (res.ok) {
        const result = await res.json();
        console.log('✅ SUCESSO! Webhook configurado\n');
        console.log('📋 Resposta:');
        console.log(JSON.stringify(result, null, 2));
        console.log('\n' + '='.repeat(80));
        
        // Verificar configuração
        console.log('\n🔍 Verificando configuração aplicada...\n');
        
        const verifyRes = await fetch(
          `${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`,
          { headers: { apikey: EVOLUTION_KEY } }
        );

        if (verifyRes.ok) {
          const webhook = await verifyRes.json();
          console.log('✅ Webhook ativo:');
          console.log(`   URL: ${webhook.url}`);
          console.log(`   Enabled: ${webhook.enabled}`);
          console.log(`   Events: ${webhook.events?.join(', ')}\n`);
        }

        break; // Sucesso, não precisa testar outros payloads

      } else {
        const errorText = await res.text();
        console.log(`❌ Falhou:`);
        console.log(`   ${errorText}\n`);
      }

    } catch (err) {
      console.log(`❌ Erro: ${err.message}\n`);
    }

    console.log('-'.repeat(80));
  }

  // Estado final
  console.log('\n\n📊 ESTADO FINAL\n');
  console.log('='.repeat(80));

  try {
    // Webhook
    const webhookRes = await fetch(
      `${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );

    if (webhookRes.ok) {
      const webhook = await webhookRes.json();
      console.log('✅ Webhook configurado:');
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Enabled: ${webhook.enabled}`);
      console.log(`   Events: ${webhook.events?.join(', ')}\n`);

      const urlCorreta = webhook.url === WEBHOOK_URL;
      const habilitado = webhook.enabled === true;
      const temEventos = webhook.events && webhook.events.length > 0;

      if (urlCorreta && habilitado && temEventos) {
        console.log('✅ Webhook está PRONTO!\n');
      } else {
        console.log('⚠️  Webhook precisa de ajustes:\n');
        if (!urlCorreta) console.log(`   - URL incorreta: ${webhook.url}`);
        if (!habilitado) console.log('   - Webhook desabilitado');
        if (!temEventos) console.log('   - Nenhum evento configurado');
        console.log('');
      }
    } else {
      console.log('⚠️  Webhook não configurado\n');
    }

    // Conexão
    const stateRes = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );

    if (stateRes.ok) {
      const state = await stateRes.json();
      const isOpen = state.instance?.state === 'open';
      console.log(`📱 Conexão: ${isOpen ? '✅ CONECTADA' : '⚠️  DESCONECTADA'}`);
      console.log(`   Estado: ${state.instance?.state || 'unknown'}\n`);
    }

  } catch (err) {
    console.log(`❌ Erro na verificação final: ${err.message}\n`);
  }

  console.log('='.repeat(80));
  console.log('\n💡 INSTRUÇÕES FINAIS:\n');
  console.log('Se a configuração automática falhou:');
  console.log(`   1. Acesse: ${EVOLUTION_URL}`);
  console.log(`   2. Localize: ${INSTANCE_NAME}`);
  console.log('   3. Configure o webhook manualmente:');
  console.log(`      URL: ${WEBHOOK_URL}`);
  console.log('      Events: MESSAGES_UPSERT, MESSAGES_UPDATE');
  console.log('\nPara testar:');
  console.log('   1. Envie uma mensagem para o WhatsApp da RS Consultoria EAD');
  console.log('   2. Verifique se o bot responde');
  console.log('   3. Monitore: https://painel-primeiroagent.rsconsultoria.pro/app/logs\n');
}

configurarWebhook().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
});
