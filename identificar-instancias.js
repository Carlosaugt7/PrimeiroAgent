// Script para identificar detalhes das instâncias "undefined"
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function identificar() {
  console.log('🔍 IDENTIFICAR INSTÂNCIAS DO EVOLUTION API\n');
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

  if (!EVOLUTION_KEY) {
    console.log('❌ API Key não configurada');
    return;
  }

  // Buscar todas as instâncias
  console.log('📱 Buscando todas as instâncias...\n');
  
  try {
    const res = await fetch(`${EVOLUTION_URL}/instance/fetchInstances`, {
      headers: { apikey: EVOLUTION_KEY }
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const instances = await res.json();
    
    console.log(`✅ Total: ${instances.length} instâncias\n`);
    console.log('='.repeat(80));

    // Para cada instância, buscar detalhes completos
    for (let i = 0; i < instances.length; i++) {
      const inst = instances[i];
      console.log(`\n📱 INSTÂNCIA ${i + 1}/${instances.length}\n`);
      console.log('JSON completo recebido do Evolution API:');
      console.log(JSON.stringify(inst, null, 2));
      console.log('\n' + '-'.repeat(80));

      // Tentar extrair possíveis identificadores
      const possibleKeys = Object.keys(inst).filter(k => 
        k.includes('name') || 
        k.includes('id') || 
        k.includes('key') ||
        k.includes('phone') ||
        k.includes('jid')
      );

      if (possibleKeys.length > 0) {
        console.log('\n🔑 Possíveis identificadores encontrados:');
        possibleKeys.forEach(key => {
          console.log(`   ${key}: ${inst[key]}`);
        });
      }

      // Se houver objeto instance aninhado
      if (inst.instance && typeof inst.instance === 'object') {
        const instanceKeys = Object.keys(inst.instance).filter(k => 
          k.includes('name') || 
          k.includes('id') || 
          k.includes('key') ||
          k.includes('phone') ||
          k.includes('jid')
        );

        if (instanceKeys.length > 0) {
          console.log('\n🔑 Identificadores no objeto "instance":');
          instanceKeys.forEach(key => {
            console.log(`   ${key}: ${inst.instance[key]}`);
          });
        }
      }

      // Tentar buscar estado de conexão individual
      console.log('\n📊 Tentando buscar estado da instância...');
      
      // Testar diferentes formas de identificar a instância
      const possibleIds = [
        inst.instanceName,
        inst.instance?.instanceName,
        inst.name,
        inst.instance?.name,
        inst.key,
        inst.instance?.key,
        inst.id
      ].filter(Boolean);

      let foundState = false;
      for (const id of possibleIds) {
        try {
          const stateRes = await fetch(
            `${EVOLUTION_URL}/instance/connectionState/${id}`,
            { headers: { apikey: EVOLUTION_KEY } }
          );

          if (stateRes.ok) {
            const state = await stateRes.json();
            console.log(`   ✅ Estado obtido usando ID: "${id}"`);
            console.log(`   Estado: ${JSON.stringify(state, null, 2)}`);
            foundState = true;
            break;
          }
        } catch (err) {
          // Continua tentando
        }
      }

      if (!foundState) {
        console.log('   ⚠️  Não foi possível obter estado da instância');
      }

      console.log('\n' + '='.repeat(80));
    }

    // Comparar com banco de dados
    console.log('\n\n📊 AGENTES NO BANCO DE DADOS\n');
    console.log('='.repeat(80));

    const { data: agents } = await supabase
      .from('agents')
      .select('id, name, tenantId, whatsappInstanceId')
      .not('whatsappInstanceId', 'is', null);

    if (agents && agents.length > 0) {
      console.log('\n✅ Agentes com whatsappInstanceId configurado:\n');
      agents.forEach(agent => {
        console.log(`   Nome: ${agent.name}`);
        console.log(`   ID: ${agent.id}`);
        console.log(`   Instance ID: ${agent.whatsappInstanceId}`);
        console.log(`   Tenant: ${agent.tenantId}`);
        console.log('');
      });

      // Verificar quais estão no Evolution
      console.log('🔍 Verificando quais existem no Evolution API:\n');
      const instanceNames = instances.map(i => 
        i.instance?.instanceName || i.instanceName
      );

      agents.forEach(agent => {
        const exists = instanceNames.includes(agent.whatsappInstanceId);
        const status = exists ? '✅ EXISTE' : '❌ NÃO EXISTE';
        console.log(`   ${agent.name}: ${status} (${agent.whatsappInstanceId})`);
      });
    }

    // Sugestão de correção
    console.log('\n\n💡 PRÓXIMOS PASSOS\n');
    console.log('='.repeat(80));
    console.log('\nBased nos dados acima:');
    console.log('\n1. Se encontrou identificadores nas instâncias "undefined":');
    console.log('   - Use o identificador correto para atualizar o banco de dados');
    console.log('   - Execute: UPDATE agents SET "whatsappInstanceId" = \'NOME_CORRETO\'');
    console.log('             WHERE id = \'276242c7-b41d-4f3c-823b-8c2711d713b7\';');
    console.log('\n2. Se as instâncias realmente têm nome "undefined":');
    console.log('   - Acesse o painel do Evolution API');
    console.log('   - Delete todas as instâncias "undefined"');
    console.log('   - Crie novas instâncias com nomes corretos:');
    console.log('     • RS_Consultoria_EAD');
    console.log('     • RSTV_Plus');
    console.log('     • Corporativo');
    console.log('\n3. Configure o webhook em cada instância:');
    console.log('   URL: https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook');
    console.log('   Eventos: messages.upsert, messages.update');
    console.log('\n4. Escaneie o QR Code de cada instância\n');

  } catch (err) {
    console.error('❌ Erro:', err.message);
  }
}

identificar().catch(console.error);
