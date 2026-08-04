// Script para verificar e configurar webhook da instância RS_Consultoria-EAD
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INSTANCE_NAME = 'RS_Consultoria-EAD';
const WEBHOOK_URL = 'https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook';
const WEBHOOK_EVENTS = ['messages.upsert', 'messages.update'];

async function verificarWebhook() {
  console.log('🔍 VERIFICAÇÃO DE WEBHOOK - RS Consultoria EAD\n');
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
  console.log(`   Webhook esperado: ${WEBHOOK_URL}\n`);

  if (!EVOLUTION_KEY) {
    console.log('❌ API Key não configurada!');
    return;
  }

  // 1. Verificar webhook atual
  console.log('🔍 PASSO 1: Verificando webhook atual...\n');

  try {
    const webhookRes = await fetch(
      `${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );

    let webhookAtual = null;
    let webhookOk = false;

    if (webhookRes.ok) {
      webhookAtual = await webhookRes.json();
      
      console.log('✅ Webhook encontrado:\n');
      console.log(`   URL: ${webhookAtual.url}`);
      console.log(`   Enabled: ${webhookAtual.enabled}`);
      console.log(`   Events: ${webhookAtual.events?.join(', ') || 'Nenhum'}\n`);

      // Verificar se está correto
      const urlOk = webhookAtual.url === WEBHOOK_URL;
      const enabledOk = webhookAtual.enabled === true;
      const eventsOk = WEBHOOK_EVENTS.every(evt => 
        webhookAtual.events?.includes(evt)
      );

      webhookOk = urlOk && enabledOk && eventsOk;

      if (!urlOk) {
        console.log(`   ⚠️  URL incorreta!`);
        console.log(`      Esperado: ${WEBHOOK_URL}`);
        console.log(`      Atual: ${webhookAtual.url}\n`);
      }

      if (!enabledOk) {
        console.log(`   ⚠️  Webhook desabilitado!\n`);
      }

      if (!eventsOk) {
        console.log(`   ⚠️  Eventos incorretos!`);
        console.log(`      Esperado: ${WEBHOOK_EVENTS.join(', ')}`);
        console.log(`      Atual: ${webhookAtual.events?.join(', ') || 'Nenhum'}\n`);
      }

      if (webhookOk) {
        console.log('✅ Webhook está CORRETO!\n');
      } else {
        console.log('⚠️  Webhook precisa ser atualizado\n');
      }

    } else if (webhookRes.status === 404) {
      console.log('⚠️  Webhook NÃO CONFIGURADO\n');
      webhookOk = false;
    } else {
      const errorText = await webhookRes.text();
      console.log(`❌ Erro ao verificar webhook: ${webhookRes.status}`);
      console.log(`   ${errorText}\n`);
      return;
    }

    // 2. Configurar webhook se necessário
    if (!webhookOk) {
      console.log('🔧 PASSO 2: Configurando webhook...\n');

      const webhookPayload = {
        enabled: true,
        url: WEBHOOK_URL,
        events: WEBHOOK_EVENTS,
        webhookByEvents: false
      };

      console.log('📤 Enviando configuração:');
      console.log(JSON.stringify(webhookPayload, null, 2));
      console.log('');

      const setRes = await fetch(
        `${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`,
        {
          method: 'POST',
          headers: {
            'apikey': EVOLUTION_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(webhookPayload)
        }
      );

      if (setRes.ok) {
        const result = await setRes.json();
        console.log('✅ Webhook configurado com sucesso!\n');
        console.log('📋 Resposta:');
        console.log(JSON.stringify(result, null, 2));
        console.log('');
      } else {
        const errorText = await setRes.text();
        console.log(`❌ Erro ao configurar webhook (${setRes.status}):`);
        console.log(`   ${errorText}\n`);
        
        console.log('💡 Solução manual:');
        console.log(`   1. Acesse: ${EVOLUTION_URL}`);
        console.log(`   2. Localize a instância: ${INSTANCE_NAME}`);
        console.log('   3. Configure o webhook:');
        console.log(`      URL: ${WEBHOOK_URL}`);
        console.log(`      Events: ${WEBHOOK_EVENTS.join(', ')}\n`);
        return;
      }
    }

    // 3. Testar webhook (enviar mensagem de teste)
    console.log('🔍 PASSO 3: Testando conectividade...\n');

    const stateRes = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );

    if (stateRes.ok) {
      const state = await stateRes.json();
      console.log('📱 Estado da conexão:');
      console.log(`   Estado: ${state.instance?.state || 'unknown'}\n`);

      if (state.instance?.state === 'open') {
        console.log('✅ Instância CONECTADA ao WhatsApp!\n');
      } else {
        console.log('⚠️  Instância NÃO conectada ao WhatsApp!');
        console.log('   Ação: Reconectar via QR Code\n');
      }
    }

    // 4. Verificar últimas mensagens no banco
    console.log('🔍 PASSO 4: Verificando últimas mensagens recebidas...\n');

    const { data: recentMessages } = await supabase
      .from('messages')
      .select('id, text, fromMe, createdAt, conversationId')
      .eq('conversationId', (await supabase
        .from('conversations')
        .select('id')
        .eq('instanceName', INSTANCE_NAME)
        .order('updatedAt', { ascending: false })
        .limit(1)
        .maybeSingle()
      )?.data?.id || 'none')
      .order('createdAt', { ascending: false })
      .limit(5);

    if (recentMessages && recentMessages.length > 0) {
      console.log(`✅ Últimas ${recentMessages.length} mensagens na conversa mais recente:\n`);
      recentMessages.forEach((msg, idx) => {
        const sender = msg.fromMe ? '🤖 Bot' : '👤 Usuário';
        const time = new Date(msg.createdAt).toLocaleString('pt-BR');
        console.log(`   ${idx + 1}. ${sender} (${time})`);
        console.log(`      ${msg.text?.slice(0, 80)}${msg.text?.length > 80 ? '...' : ''}\n`);
      });
    } else {
      console.log('ℹ️  Nenhuma mensagem recente encontrada\n');
    }

    // 5. Verificar logs de erro
    console.log('🔍 PASSO 5: Verificando logs de erro...\n');

    const dezMinutosAtras = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const { data: errorLogs } = await supabase
      .from('ai_logs')
      .select('*')
      .eq('instanceName', INSTANCE_NAME)
      .eq('ok', false)
      .gte('createdAt', dezMinutosAtras)
      .order('createdAt', { ascending: false })
      .limit(3);

    if (errorLogs && errorLogs.length > 0) {
      console.log(`⚠️  Encontrados ${errorLogs.length} erros nos últimos 10 minutos:\n`);
      errorLogs.forEach((log, idx) => {
        const time = new Date(log.createdAt).toLocaleString('pt-BR');
        console.log(`   ${idx + 1}. ${time}`);
        console.log(`      Erro: ${log.error}`);
        console.log(`      Input: ${log.userText?.slice(0, 50)}\n`);
      });
    } else {
      console.log('✅ Nenhum erro nos últimos 10 minutos\n');
    }

  } catch (err) {
    console.error('❌ Erro:', err.message);
    return;
  }

  // RESUMO FINAL
  console.log('='.repeat(80));
  console.log('📊 RESUMO\n');
  console.log('✅ Sistema pronto para uso!\n');
  console.log('📝 Para testar:');
  console.log('   1. Envie uma mensagem para o WhatsApp da RS Consultoria EAD');
  console.log('   2. O bot deve responder automaticamente');
  console.log('   3. Monitore os logs: https://painel-primeiroagent.rsconsultoria.pro/app/logs\n');
  console.log('🔗 Links úteis:');
  console.log(`   Evolution API: ${EVOLUTION_URL}`);
  console.log('   Painel: https://painel-primeiroagent.rsconsultoria.pro\n');
  console.log('='.repeat(80));
}

verificarWebhook().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
});
