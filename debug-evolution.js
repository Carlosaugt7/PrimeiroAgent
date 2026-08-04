// Debug completo da comunicação com Evolution API
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INSTANCE_NAME = 'RS_Consultoria_EAD';

async function debug() {
  console.log('🔍 DEBUG EVOLUTION API - RS Consultoria EAD\n');
  console.log('='.repeat(80));

  // Buscar credenciais corretas
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

  console.log('🔗 Configuração:');
  console.log(`   URL: ${EVOLUTION_URL}`);
  console.log(`   Key: ${EVOLUTION_KEY ? `${EVOLUTION_KEY.slice(0, 20)}...` : 'NÃO CONFIGURADA'}`);

  if (!EVOLUTION_KEY) {
    console.log('\n❌ ERRO: API Key não configurada!');
    return;
  }

  // 1. Testar conexão básica
  console.log('\n\n1️⃣  TESTANDO CONEXÃO BÁSICA');
  console.log('-'.repeat(80));
  
  try {
    const testRes = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY }
    });

    console.log(`   Status: ${testRes.status}`);
    
    if (testRes.ok) {
      const instances = await testRes.json();
      console.log(`   ✅ Conectado! Encontradas ${instances.length} instâncias`);
      
      const rsInstance = instances.find(i => 
        i.instance?.instanceName === INSTANCE_NAME || 
        i.instanceName === INSTANCE_NAME
      );

      if (rsInstance) {
        console.log(`\n   ✅ Instância "${INSTANCE_NAME}" encontrada:`);
        console.log(`      ${JSON.stringify(rsInstance, null, 2)}`);
      } else {
        console.log(`\n   ❌ Instância "${INSTANCE_NAME}" NÃO encontrada no Evolution API`);
        console.log('\n   Instâncias disponíveis:');
        instances.forEach(i => {
          const name = i.instance?.instanceName || i.instanceName;
          const state = i.instance?.state || i.state;
          console.log(`      - ${name} (estado: ${state})`);
        });
      }
    } else {
      const errorText = await testRes.text();
      console.log(`   ❌ Erro ${testRes.status}: ${errorText}`);
    }
  } catch (err) {
    console.log(`   ❌ Erro de conexão: ${err.message}`);
  }

  // 2. Verificar estado da instância
  console.log('\n\n2️⃣  VERIFICANDO ESTADO DA INSTÂNCIA');
  console.log('-'.repeat(80));

  try {
    const stateRes = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
      {
        headers: { apikey: EVOLUTION_KEY }
      }
    );

    console.log(`   Status: ${stateRes.status}`);

    if (stateRes.ok) {
      const state = await stateRes.json();
      console.log(`   ✅ Estado obtido:`);
      console.log(`      ${JSON.stringify(state, null, 2)}`);
    } else {
      const errorText = await stateRes.text();
      console.log(`   ❌ Erro: ${errorText}`);
    }
  } catch (err) {
    console.log(`   ❌ Erro: ${err.message}`);
  }

  // 3. Verificar webhook
  console.log('\n\n3️⃣  VERIFICANDO WEBHOOK');
  console.log('-'.repeat(80));

  try {
    const webhookRes = await fetch(
      `${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`,
      {
        headers: { apikey: EVOLUTION_KEY }
      }
    );

    console.log(`   Status: ${webhookRes.status}`);

    if (webhookRes.ok) {
      const webhook = await webhookRes.json();
      console.log(`   ✅ Webhook configurado:`);
      console.log(`      URL: ${webhook.url}`);
      console.log(`      Enabled: ${webhook.enabled}`);
      console.log(`      Events: ${webhook.events?.join(', ')}`);
      
      // Verificar se URL está correta
      const expectedUrl = 'https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook';
      if (webhook.url !== expectedUrl) {
        console.log(`\n   ⚠️  URL do webhook diferente da esperada!`);
        console.log(`      Esperado: ${expectedUrl}`);
        console.log(`      Atual: ${webhook.url}`);
      }
    } else {
      const errorText = await webhookRes.text();
      console.log(`   ⚠️  Webhook não encontrado ou erro: ${errorText}`);
    }
  } catch (err) {
    console.log(`   ❌ Erro: ${err.message}`);
  }

  // 4. Simular envio de mensagem (teste de permissão)
  console.log('\n\n4️⃣  TESTANDO PERMISSÕES DE ENVIO');
  console.log('-'.repeat(80));

  const testPayload = {
    number: '5511999999999',
    text: '[TESTE] Esta é uma mensagem de teste do sistema'
  };

  try {
    console.log(`   Tentando enviar mensagem de teste...`);
    console.log(`   Endpoint: ${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`);
    console.log(`   Payload: ${JSON.stringify(testPayload)}`);

    const sendRes = await fetch(
      `${EVOLUTION_URL}/message/sendText/${INSTANCE_NAME}`,
      {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(testPayload)
      }
    );

    console.log(`\n   Status: ${sendRes.status}`);

    if (sendRes.ok) {
      const result = await sendRes.json();
      console.log(`   ✅ Endpoint de envio acessível!`);
      console.log(`   Resposta: ${JSON.stringify(result, null, 2)}`);
    } else {
      const errorText = await sendRes.text();
      console.log(`   ❌ Erro ${sendRes.status}:`);
      console.log(`   ${errorText}`);
      
      if (sendRes.status === 400) {
        console.log(`\n   🔍 ERRO 400 - Possíveis causas:`);
        console.log(`      - Instância desconectada do WhatsApp`);
        console.log(`      - Número de teste inválido`);
        console.log(`      - Payload malformado`);
        console.log(`      - Instância em estado inconsistente`);
      }
    }
  } catch (err) {
    console.log(`   ❌ Erro: ${err.message}`);
  }

  // 5. Buscar logs recentes de erro no banco
  console.log('\n\n5️⃣  LOGS DE ERRO NO BANCO DE DADOS');
  console.log('-'.repeat(80));

  const quinzeMinutosAtras = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  
  const { data: logsComErro } = await supabase
    .from('ai_logs')
    .select('*')
    .eq('instanceName', INSTANCE_NAME)
    .eq('ok', false)
    .gte('createdAt', quinzeMinutosAtras)
    .order('createdAt', { ascending: false })
    .limit(5);

  if (logsComErro && logsComErro.length > 0) {
    console.log(`   ⚠️  Encontrados ${logsComErro.length} logs com erro:`);
    logsComErro.forEach((log, i) => {
      console.log(`\n   ${i + 1}. ${new Date(log.createdAt).toLocaleString('pt-BR')}`);
      console.log(`      Erro: ${log.error}`);
      console.log(`      Mensagem: ${log.userText?.slice(0, 50)}`);
    });
  } else {
    console.log(`   ✅ Nenhum log com erro nos últimos 15 minutos`);
  }

  // DIAGNÓSTICO FINAL
  console.log('\n\n' + '='.repeat(80));
  console.log('📊 DIAGNÓSTICO FINAL');
  console.log('='.repeat(80));

  console.log('\n🔍 PRÓXIMOS PASSOS:');
  console.log('   1. Se a instância não foi encontrada → Recrie no Evolution API');
  console.log('   2. Se o estado não é "open" → Reconecte escaneando QR Code');
  console.log('   3. Se o erro 400 persiste → Instância está em estado corrompido');
  console.log('      Solução: Deletar e recriar a instância');
  console.log('   4. Se webhook está incorreto → Reconfigure o webhook');
  console.log('\n📱 Para ver logs em tempo real:');
  console.log('   Acesse: https://painel-primeiroagent.rsconsultoria.pro/app/logs');
  console.log('');
}

debug().catch(console.error);
