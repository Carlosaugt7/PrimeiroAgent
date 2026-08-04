// Script para corrigir os nomes das instâncias no banco de dados
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function corrigir() {
  console.log('🔧 CORREÇÃO AUTOMÁTICA DOS NOMES DAS INSTÂNCIAS\n');
  console.log('='.repeat(80));

  // Mapeamento de correções necessárias
  const correcoes = [
    {
      agentId: '276242c7-b41d-4f3c-823b-8c2711d713b7',
      agentName: 'Helena (RS Consultoria EAD)',
      tenantId: 'cli_ms3ncqwm_o5vujw',
      nomeAtual: 'RS_Consultoria_EAD',
      nomeCorreto: 'RS_Consultoria-EAD',
      motivo: 'Nome no banco usa underscore, mas Evolution API usa hífen'
    }
  ];

  console.log('📋 Correções a serem aplicadas:\n');
  
  correcoes.forEach((corr, idx) => {
    console.log(`${idx + 1}. Agente: ${corr.agentName}`);
    console.log(`   ID: ${corr.agentId}`);
    console.log(`   Tenant: ${corr.tenantId}`);
    console.log(`   Nome atual: "${corr.nomeAtual}"`);
    console.log(`   Nome correto: "${corr.nomeCorreto}"`);
    console.log(`   Motivo: ${corr.motivo}\n`);
  });

  console.log('='.repeat(80));
  console.log('\n⏳ Aplicando correções...\n');

  for (const corr of correcoes) {
    try {
      // 1. Atualizar tabela agents
      console.log(`📝 Atualizando agente ${corr.agentName}...`);
      
      const { error: agentError } = await supabase
        .from('agents')
        .update({ whatsappInstanceId: corr.nomeCorreto })
        .eq('id', corr.agentId)
        .eq('tenantId', corr.tenantId);

      if (agentError) {
        throw new Error(`Erro ao atualizar agents: ${agentError.message}`);
      }

      console.log(`   ✅ Tabela agents atualizada`);

      // 2. Verificar se existe registro na tabela instances
      const { data: existingInstance } = await supabase
        .from('instances')
        .select('*')
        .eq('tenantId', corr.tenantId)
        .eq('name', corr.nomeAtual)
        .maybeSingle();

      if (existingInstance) {
        console.log(`   📝 Atualizando tabela instances...`);
        
        const { error: instanceError } = await supabase
          .from('instances')
          .update({ name: corr.nomeCorreto })
          .eq('id', existingInstance.id);

        if (instanceError) {
          console.warn(`   ⚠️  Erro ao atualizar instances: ${instanceError.message}`);
        } else {
          console.log(`   ✅ Tabela instances atualizada`);
        }
      } else {
        console.log(`   ℹ️  Nenhum registro encontrado na tabela instances`);
      }

      // 3. Verificar e atualizar instance_index se existir
      const { data: indexRecords } = await supabase
        .from('instance_index')
        .select('*')
        .eq('tenantId', corr.tenantId)
        .eq('instanceName', corr.nomeAtual);

      if (indexRecords && indexRecords.length > 0) {
        console.log(`   📝 Atualizando ${indexRecords.length} registro(s) em instance_index...`);
        
        const { error: indexError } = await supabase
          .from('instance_index')
          .update({ instanceName: corr.nomeCorreto })
          .eq('tenantId', corr.tenantId)
          .eq('instanceName', corr.nomeAtual);

        if (indexError) {
          console.warn(`   ⚠️  Erro ao atualizar instance_index: ${indexError.message}`);
        } else {
          console.log(`   ✅ Tabela instance_index atualizada`);
        }
      } else {
        console.log(`   ℹ️  Nenhum registro encontrado na tabela instance_index`);
      }

      // 4. Atualizar conversations que possam estar usando o nome antigo
      const { data: conversations } = await supabase
        .from('conversations')
        .select('id')
        .eq('tenantId', corr.tenantId)
        .eq('instanceName', corr.nomeAtual);

      if (conversations && conversations.length > 0) {
        console.log(`   📝 Atualizando ${conversations.length} conversa(s)...`);
        
        const { error: convError } = await supabase
          .from('conversations')
          .update({ instanceName: corr.nomeCorreto })
          .eq('tenantId', corr.tenantId)
          .eq('instanceName', corr.nomeAtual);

        if (convError) {
          console.warn(`   ⚠️  Erro ao atualizar conversations: ${convError.message}`);
        } else {
          console.log(`   ✅ Conversas atualizadas`);
        }
      } else {
        console.log(`   ℹ️  Nenhuma conversa encontrada com o nome antigo`);
      }

      console.log(`\n✅ Correção concluída para ${corr.agentName}!\n`);
      console.log('-'.repeat(80) + '\n');

    } catch (err) {
      console.error(`❌ ERRO ao processar ${corr.agentName}:`, err.message);
      console.log('-'.repeat(80) + '\n');
    }
  }

  // Verificação final
  console.log('='.repeat(80));
  console.log('🔍 VERIFICAÇÃO FINAL\n');

  const { data: agents } = await supabase
    .from('agents')
    .select('id, name, whatsappInstanceId, tenantId')
    .in('id', correcoes.map(c => c.agentId));

  if (agents) {
    console.log('✅ Estado atual dos agentes:\n');
    agents.forEach(agent => {
      const corr = correcoes.find(c => c.agentId === agent.id);
      const status = agent.whatsappInstanceId === corr?.nomeCorreto ? '✅' : '❌';
      console.log(`   ${status} ${agent.name}`);
      console.log(`      whatsappInstanceId: ${agent.whatsappInstanceId}`);
      console.log(`      Esperado: ${corr?.nomeCorreto}\n`);
    });
  }

  // Buscar credenciais Evolution API
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

  if (EVOLUTION_KEY) {
    console.log('🔍 Testando conectividade com Evolution API...\n');

    for (const corr of correcoes) {
      try {
        const res = await fetch(
          `${EVOLUTION_URL}/instance/connectionState/${corr.nomeCorreto}`,
          { headers: { apikey: EVOLUTION_KEY } }
        );

        if (res.ok) {
          const state = await res.json();
          console.log(`✅ ${corr.agentName}:`);
          console.log(`   Instância: ${corr.nomeCorreto}`);
          console.log(`   Estado: ${state.instance?.state || 'unknown'}`);
          
          if (state.instance?.state === 'open') {
            console.log(`   Status: 🟢 CONECTADA e pronta para uso\n`);
          } else {
            console.log(`   Status: ⚠️  Necessita reconexão via QR Code\n`);
          }
        } else {
          console.log(`❌ ${corr.agentName}: Erro ao verificar estado (${res.status})\n`);
        }
      } catch (err) {
        console.log(`❌ ${corr.agentName}: ${err.message}\n`);
      }
    }
  }

  console.log('='.repeat(80));
  console.log('\n🎉 CORREÇÃO FINALIZADA!\n');
  console.log('📝 Próximos passos:');
  console.log('   1. Teste enviando uma mensagem para RS Consultoria EAD');
  console.log('   2. Verifique se o bot responde corretamente');
  console.log('   3. Monitore os logs em: https://painel-primeiroagent.rsconsultoria.pro/app/logs');
  console.log('\n💡 Se ainda houver problemas:');
  console.log('   - Verifique se o webhook está configurado no Evolution API');
  console.log('   - Confirme que a instância está conectada (estado "open")');
  console.log('   - Execute: node verificar-webhook.js\n');
}

corrigir().catch(err => {
  console.error('\n❌ ERRO FATAL:', err.message);
  console.error(err.stack);
});
