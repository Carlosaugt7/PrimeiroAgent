// Script para resolver definitivamente o problema da instância RS Consultoria EAD
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INSTANCE_NAME = 'RS_Consultoria_EAD';
const TENANT_ID = 'cli_ms3ncqwm_o5vujw';

async function resolver() {
  console.log('🔧 RESOLVER PROBLEMA - RS Consultoria EAD\n');
  console.log('='.repeat(80));

  // 1. Buscar credenciais Evolution API
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
  console.log(`   URL: ${EVOLUTION_URL}`);
  console.log(`   Key: ${EVOLUTION_KEY ? 'Configurada ✓' : 'NÃO CONFIGURADA ✗'}\n`);

  if (!EVOLUTION_KEY) {
    console.log('❌ ERRO CRÍTICO: API Key não encontrada!');
    console.log('\nPara resolver:');
    console.log('1. Acesse o painel do Evolution API');
    console.log('2. Copie a API Key global');
    console.log('3. Adicione na tabela global_settings:');
    console.log('   key: evolutionApiKey');
    console.log('   value: SUA_API_KEY\n');
    return;
  }

  // 2. Listar todas as instâncias no Evolution API
  console.log('🔍 PASSO 1: Buscando instâncias no Evolution API...\n');
  
  let instances = [];
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }

    instances = await res.json();
    console.log(`✅ Encontradas ${instances.length} instâncias\n`);

    if (instances.length === 0) {
      console.log('⚠️  NENHUMA instância encontrada no Evolution API!');
      console.log('\n📝 AÇÃO NECESSÁRIA:');
      console.log('   1. Acesse: https://evolution-api.rsconsultoria.pro');
      console.log(`   2. Crie uma nova instância com nome: ${INSTANCE_NAME}`);
      console.log('   3. Configure o webhook:');
      console.log('      URL: https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook');
      console.log('      Eventos: messages.upsert, messages.update');
      console.log('   4. Escaneie o QR Code');
      console.log('   5. Execute este script novamente\n');
      return;
    }

    // Mostrar todas as instâncias
    console.log('📱 Instâncias encontradas:');
    instances.forEach((inst, idx) => {
      const name = inst.instance?.instanceName || inst.instanceName || 'undefined';
      const state = inst.instance?.state || inst.state || 'unknown';
      const owner = inst.instance?.owner || inst.owner || 'N/A';
      console.log(`   ${idx + 1}. Nome: "${name}"`);
      console.log(`      Estado: ${state}`);
      console.log(`      Owner: ${owner}\n`);
    });

  } catch (err) {
    console.log(`❌ ERRO ao buscar instâncias: ${err.message}\n`);
    return;
  }

  // 3. Verificar se RS_Consultoria_EAD existe
  console.log('🔍 PASSO 2: Procurando instância RS_Consultoria_EAD...\n');

  const rsInstance = instances.find(i => {
    const name = i.instance?.instanceName || i.instanceName;
    return name === INSTANCE_NAME;
  });

  if (!rsInstance) {
    console.log(`❌ Instância "${INSTANCE_NAME}" NÃO EXISTE no Evolution API\n`);
    
    // Verificar se há alguma instância "undefined" que possa ser ela
    const undefinedInstances = instances.filter(i => {
      const name = i.instance?.instanceName || i.instanceName;
      return !name || name === 'undefined';
    });

    if (undefinedInstances.length > 0) {
      console.log(`⚠️  Encontradas ${undefinedInstances.length} instâncias com nome "undefined"`);
      console.log('   Isso indica um problema na API do Evolution\n');
      
      console.log('💡 POSSÍVEIS SOLUÇÕES:\n');
      console.log('   OPÇÃO A - Recriar a instância:');
      console.log('   1. Acesse: https://evolution-api.rsconsultoria.pro');
      console.log(`   2. Crie nova instância: ${INSTANCE_NAME}`);
      console.log('   3. Configure webhook (URL abaixo)');
      console.log('   4. Escaneie QR Code\n');
      
      console.log('   OPÇÃO B - Identificar instância existente:');
      console.log('   1. Acesse o painel do Evolution API');
      console.log('   2. Identifique qual das instâncias "undefined" é a correta');
      console.log('   3. Anote o nome REAL da instância');
      console.log('   4. Atualize a tabela agents no banco:');
      console.log(`      UPDATE agents SET "whatsappInstanceId" = 'NOME_REAL'`);
      console.log(`      WHERE id = '276242c7-b41d-4f3c-823b-8c2711d713b7';\n`);
    } else {
      console.log('💡 SOLUÇÃO:\n');
      console.log('   1. Acesse: https://evolution-api.rsconsultoria.pro');
      console.log(`   2. Crie nova instância com nome: ${INSTANCE_NAME}`);
      console.log('   3. Configure o webhook:');
      console.log('      URL: https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook');
      console.log('      Eventos: messages.upsert, messages.update');
      console.log('   4. Escaneie o QR Code\n');
    }

    console.log('📝 Webhook URL para copiar:');
    console.log('   https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook\n');
    
    return;
  }

  // 4. Instância existe - verificar estado
  console.log(`✅ Instância "${INSTANCE_NAME}" ENCONTRADA!\n`);
  
  const instanceState = rsInstance.instance?.state || rsInstance.state;
  const instanceOwner = rsInstance.instance?.owner || rsInstance.owner;
  
  console.log('📊 Detalhes da instância:');
  console.log(`   Estado: ${instanceState}`);
  console.log(`   Owner: ${instanceOwner}`);
  console.log(`   Dados completos: ${JSON.stringify(rsInstance, null, 2)}\n`);

  // 5. Verificar webhook
  console.log('🔍 PASSO 3: Verificando configuração do webhook...\n');
  
  try {
    const webhookRes = await fetch(
      `${EVOLUTION_URL}/webhook/find/${INSTANCE_NAME}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );

    if (webhookRes.ok) {
      const webhook = await webhookRes.json();
      const expectedUrl = 'https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook';
      
      console.log('✅ Webhook configurado:');
      console.log(`   URL: ${webhook.url}`);
      console.log(`   Enabled: ${webhook.enabled}`);
      console.log(`   Events: ${webhook.events?.join(', ')}\n`);
      
      if (webhook.url !== expectedUrl) {
        console.log('⚠️  URL DO WEBHOOK INCORRETA!\n');
        console.log('💡 CORREÇÃO NECESSÁRIA:');
        console.log(`   1. URL esperada: ${expectedUrl}`);
        console.log(`   2. URL atual: ${webhook.url}\n`);
        console.log('   Para corrigir, execute este comando via API ou painel:\n');
        console.log(`   curl -X POST "${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}" \\`);
        console.log(`     -H "apikey: ${EVOLUTION_KEY.slice(0, 10)}..." \\`);
        console.log('     -H "Content-Type: application/json" \\');
        console.log('     -d \'{"enabled":true,"url":"' + expectedUrl + '","events":["messages.upsert","messages.update"]}\'\n');
      } else {
        console.log('✅ URL do webhook está correta!\n');
      }
    } else {
      console.log('⚠️  Webhook não configurado ou erro ao buscar\n');
      console.log('💡 CONFIGURAR WEBHOOK:');
      console.log(`   POST ${EVOLUTION_URL}/webhook/set/${INSTANCE_NAME}`);
      console.log('   Body: {');
      console.log('     "enabled": true,');
      console.log('     "url": "https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook",');
      console.log('     "events": ["messages.upsert", "messages.update"]');
      console.log('   }\n');
    }
  } catch (err) {
    console.log(`⚠️  Erro ao verificar webhook: ${err.message}\n`);
  }

  // 6. Verificar estado de conexão
  console.log('🔍 PASSO 4: Verificando estado de conexão...\n');
  
  try {
    const stateRes = await fetch(
      `${EVOLUTION_URL}/instance/connectionState/${INSTANCE_NAME}`,
      { headers: { apikey: EVOLUTION_KEY } }
    );

    if (stateRes.ok) {
      const state = await stateRes.json();
      console.log('📱 Estado da conexão:');
      console.log(JSON.stringify(state, null, 2) + '\n');
      
      if (state.state !== 'open') {
        console.log('⚠️  INSTÂNCIA NÃO CONECTADA AO WHATSAPP!\n');
        console.log('💡 AÇÃO NECESSÁRIA:');
        console.log('   1. Acesse: https://evolution-api.rsconsultoria.pro');
        console.log(`   2. Localize a instância: ${INSTANCE_NAME}`);
        console.log('   3. Clique em "Conectar" ou "QR Code"');
        console.log('   4. Escaneie o QR Code com o WhatsApp\n');
      } else {
        console.log('✅ Instância conectada ao WhatsApp!\n');
      }
    } else {
      const errorText = await stateRes.text();
      console.log(`❌ Erro ao verificar estado: ${errorText}\n`);
    }
  } catch (err) {
    console.log(`❌ Erro: ${err.message}\n`);
  }

  // 7. Verificar banco de dados
  console.log('🔍 PASSO 5: Verificando configuração no banco de dados...\n');
  
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('id', '276242c7-b41d-4f3c-823b-8c2711d713b7')
    .single();

  if (agent) {
    console.log('📋 Agente no banco:');
    console.log(`   Nome: ${agent.name}`);
    console.log(`   Tenant: ${agent.tenantId}`);
    console.log(`   Instance ID: ${agent.whatsappInstanceId}`);
    console.log(`   Provider: ${agent.providerId}`);
    console.log(`   Model: ${agent.model}\n`);

    if (agent.whatsappInstanceId !== INSTANCE_NAME) {
      console.log(`⚠️  ATENÇÃO: whatsappInstanceId no banco difere do esperado!`);
      console.log(`   Esperado: ${INSTANCE_NAME}`);
      console.log(`   Atual: ${agent.whatsappInstanceId}\n`);
    } else {
      console.log(`✅ whatsappInstanceId está correto no banco\n`);
    }
  }

  // 8. Testar envio de mensagem
  console.log('🔍 PASSO 6: Testando envio de mensagem (simulação)...\n');
  
  const testNumber = '5511999999999';
  const testPayload = {
    number: testNumber,
    text: '🤖 [TESTE AUTOMÁTICO] Sistema verificando conectividade - ' + new Date().toLocaleString('pt-BR')
  };

  try {
    console.log(`Tentando enviar para: ${testNumber}`);
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

    console.log(`Status: ${sendRes.status}\n`);

    if (sendRes.ok) {
      const result = await sendRes.json();
      console.log('✅ TESTE DE ENVIO PASSOU!');
      console.log(`   A instância está funcional e pode enviar mensagens\n`);
      console.log(`   Resposta: ${JSON.stringify(result, null, 2)}\n`);
    } else {
      const errorText = await sendRes.text();
      console.log(`❌ TESTE DE ENVIO FALHOU (${sendRes.status}):`);
      console.log(`   ${errorText}\n`);
      
      if (sendRes.status === 404) {
        console.log('💡 ERRO 404 = Instância não existe no Evolution API');
        console.log('   Ação: Criar a instância manualmente\n');
      } else if (sendRes.status === 400) {
        console.log('💡 ERRO 400 = Instância existe mas não está conectada');
        console.log('   Ação: Reconectar via QR Code\n');
      }
    }
  } catch (err) {
    console.log(`❌ Erro no teste: ${err.message}\n`);
  }

  // RESUMO FINAL
  console.log('='.repeat(80));
  console.log('📊 RESUMO DO DIAGNÓSTICO\n');
  
  const problemas = [];
  const acoes = [];

  if (!rsInstance) {
    problemas.push('❌ Instância não existe no Evolution API');
    acoes.push('Criar instância manualmente no painel');
  }
  
  if (instanceState && instanceState !== 'open') {
    problemas.push('❌ Instância não conectada ao WhatsApp');
    acoes.push('Escanear QR Code para conectar');
  }

  if (problemas.length === 0) {
    console.log('✅ TUDO PARECE OK!');
    console.log('\nSe ainda há problemas:');
    console.log('1. Verifique logs em tempo real no painel');
    console.log('2. Envie uma mensagem de teste pelo WhatsApp');
    console.log('3. Monitore a tabela ai_logs no banco\n');
  } else {
    console.log('⚠️  PROBLEMAS IDENTIFICADOS:\n');
    problemas.forEach(p => console.log(`   ${p}`));
    
    console.log('\n💡 AÇÕES NECESSÁRIAS:\n');
    acoes.forEach((a, i) => console.log(`   ${i + 1}. ${a}`));
    console.log('');
  }

  console.log('🔗 Links úteis:');
  console.log(`   Evolution API: ${EVOLUTION_URL}`);
  console.log('   Painel: https://painel-primeiroagent.rsconsultoria.pro');
  console.log('   Logs: https://painel-primeiroagent.rsconsultoria.pro/app/logs\n');
  
  console.log('='.repeat(80));
}

resolver().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
});
