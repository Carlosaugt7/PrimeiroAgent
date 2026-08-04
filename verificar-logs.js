// Verificar logs de IA para ver se houve erro ao tentar responder
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificarLogs() {
  console.log('🔍 VERIFICANDO LOGS DE ERRO - RS Consultoria EAD\n');
  console.log('='.repeat(80));

  // Buscar logs de IA dos últimos 30 minutos
  const trintaMinutosAtras = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  
  const { data: logs } = await supabase
    .from('ai_logs')
    .select('*')
    .eq('instanceName', 'RS_Consultoria_EAD')
    .gte('createdAt', trintaMinutosAtras)
    .order('createdAt', { ascending: false })
    .limit(10);

  if (!logs || logs.length === 0) {
    console.log('❌ NENHUM LOG DE IA ENCONTRADO nos últimos 30 minutos');
    console.log('\n🔍 ISSO SIGNIFICA:');
    console.log('   1. O webhook recebe a mensagem');
    console.log('   2. Salva no banco de dados');
    console.log('   3. MAS NÃO está chamando o bot para processar');
    console.log('\n⚠️  POSSÍVEIS CAUSAS:');
    console.log('   - Agente não está vinculado corretamente à instância');
    console.log('   - AutoReply está desativado');
    console.log('   - Webhook não está acionando a função runBridge');
    return;
  }

  console.log(`✅ Encontrados ${logs.length} logs de IA\n`);

  logs.forEach((log, i) => {
    console.log(`\n📝 Log ${i + 1} - ${new Date(log.createdAt).toLocaleString('pt-BR')}`);
    console.log(`   Agente: ${log.agentName}`);
    console.log(`   Modelo: ${log.model}`);
    console.log(`   Provider: ${log.providerKind}`);
    console.log(`   Sucesso: ${log.ok ? '✅ SIM' : '❌ NÃO'}`);
    console.log(`   Latência: ${log.latencyMs}ms`);
    console.log(`   Tokens Input: ${log.inputTokens}`);
    console.log(`   Tokens Output: ${log.outputTokens}`);
    
    if (log.userText) {
      console.log(`   Mensagem do usuário: "${log.userText.slice(0, 100)}"`);
    }
    
    if (log.reply) {
      console.log(`   Resposta da IA: "${log.reply.slice(0, 100)}"`);
    }
    
    if (log.error) {
      console.log(`   ❌ ERRO: ${log.error}`);
    }
    
    if (!log.ok) {
      console.log(`   ⚠️  FALHA ao processar mensagem`);
    }
  });

  // Verificar agente
  console.log('\n\n🤖 VERIFICANDO CONFIGURAÇÃO DO AGENTE');
  console.log('='.repeat(80));
  
  const { data: agent } = await supabase
    .from('agents')
    .select('*, llm_providers(*)')
    .eq('whatsappInstanceId', 'RS_Consultoria_EAD')
    .single();

  if (!agent) {
    console.log('❌ PROBLEMA CRÍTICO: Agente não encontrado!');
    console.log('   O sistema não consegue processar mensagens sem um agente vinculado.');
    return;
  }

  console.log(`\n✅ Agente: ${agent.name}`);
  console.log(`   ID: ${agent.id}`);
  console.log(`   Auto Reply: ${agent.autoReply ? '✅ ATIVO' : '❌ DESATIVADO'}`);
  console.log(`   Modelo: ${agent.model || '❌ NÃO CONFIGURADO'}`);
  console.log(`   Provider: ${agent.llm_providers?.name || '❌ NÃO CONFIGURADO'}`);
  console.log(`   Provider Kind: ${agent.llm_providers?.kind || 'N/A'}`);
  console.log(`   Provider API Key: ${agent.llm_providers?.apiKey ? '✅ Configurada' : '❌ FALTANDO'}`);
  console.log(`   Status: ${agent.status}`);

  if (!agent.autoReply) {
    console.log('\n❌ PROBLEMA: Auto Reply está DESATIVADO!');
    console.log('🔧 SOLUÇÃO: Ative o Auto Reply no painel admin');
  }

  if (!agent.model) {
    console.log('\n❌ PROBLEMA: Modelo não configurado!');
    console.log('🔧 SOLUÇÃO: Configure um modelo no painel admin');
  }

  if (!agent.llm_providers?.apiKey) {
    console.log('\n❌ PROBLEMA: Provider sem API Key!');
    console.log('🔧 SOLUÇÃO: Configure a API Key do provider');
  }

  // Verificar credenciais Evolution API
  console.log('\n\n🔗 VERIFICANDO CREDENCIAIS EVOLUTION API');
  console.log('='.repeat(80));

  const { data: tenant } = await supabase
    .from('tenants')
    .select('evolutionApiUrl, evolutionApiKey')
    .eq('id', agent.tenantId)
    .single();

  let evolutionUrl, evolutionKey;

  if (tenant?.evolutionApiUrl && tenant?.evolutionApiKey) {
    console.log('✅ Tenant tem credenciais próprias');
    evolutionUrl = tenant.evolutionApiUrl;
    evolutionKey = tenant.evolutionApiKey;
  } else {
    console.log('⚠️  Tenant usando credenciais globais');
    const { data: globalSettings } = await supabase
      .from('global_settings')
      .select('*')
      .in('key', ['evolutionApiUrl', 'evolutionApiKey']);

    const config = {};
    globalSettings?.forEach(s => {
      config[s.key] = s.value;
    });

    evolutionUrl = config.evolutionApiUrl;
    evolutionKey = config.evolutionApiKey;
  }

  console.log(`   URL: ${evolutionUrl || '❌ NÃO CONFIGURADA'}`);
  console.log(`   Key: ${evolutionKey ? `✅ ${evolutionKey.slice(0, 20)}...` : '❌ NÃO CONFIGURADA'}`);

  if (!evolutionUrl || !evolutionKey) {
    console.log('\n❌ PROBLEMA CRÍTICO: Credenciais Evolution API não configuradas!');
    console.log('   Sem credenciais, o sistema não consegue enviar mensagens de volta.');
    console.log('🔧 SOLUÇÃO: Configure as credenciais no painel admin');
  }

  // Testar envio de mensagem
  if (evolutionUrl && evolutionKey) {
    console.log('\n\n🧪 TESTANDO ENVIO DE MENSAGEM');
    console.log('='.repeat(80));
    
    try {
      const testRes = await fetch(
        `${evolutionUrl}/instance/connectionState/RS_Consultoria_EAD`,
        {
          headers: { apikey: evolutionKey }
        }
      );

      if (testRes.ok) {
        const state = await testRes.json();
        console.log(`✅ Conexão com Evolution API: OK`);
        console.log(`   Estado da instância: ${state.state || state.instance?.state}`);
        
        if (state.state !== 'open') {
          console.log('\n❌ PROBLEMA: Instância NÃO está aberta!');
          console.log('   A instância precisa estar conectada ao WhatsApp');
        }
      } else {
        console.log(`❌ Erro ao conectar: ${testRes.status}`);
        console.log(`   Resposta: ${await testRes.text()}`);
      }
    } catch (err) {
      console.log(`❌ Erro ao testar conexão: ${err.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Diagnóstico concluído\n');
}

verificarLogs().catch(console.error);
