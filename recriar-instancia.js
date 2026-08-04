// Script para ajudar a recriar a instância
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const EVOLUTION_URL = 'https://evolution-api.rsconsultoria.pro';
const EVOLUTION_KEY = '429683C4C977415CAAFCB2D1F2C19B57';
const OLD_INSTANCE = 'RS_Consultoria_EAD';
const NEW_INSTANCE = 'RS_Consultoria_EAD_v2'; // Nova instância
const TENANT_ID = 'cli_ms3ncqwm_o5vujw';

async function recriarInstancia() {
  console.log('🔄 PROCESSO DE RECRIAÇÃO DA INSTÂNCIA\n');
  console.log('='.repeat(80));

  console.log('\n📋 OPÇÃO 1: RECRIAR INSTÂNCIA (RECOMENDADO)');
  console.log('-'.repeat(80));
  console.log('\n1️⃣  Criar nova instância no Evolution API:');
  console.log(`   POST ${EVOLUTION_URL}/instance/create`);
  console.log('   Headers: { "apikey": "${EVOLUTION_KEY}" }');
  console.log('   Body: {');
  console.log(`     "instanceName": "${NEW_INSTANCE}",`);
  console.log('     "token": "opcional-seu-token-aqui",');
  console.log('     "qrcode": true,');
  console.log('     "integration": "WHATSAPP-BAILEYS"');
  console.log('   }');

  console.log('\n2️⃣  Configurar webhook da nova instância:');
  console.log(`   POST ${EVOLUTION_URL}/webhook/set/${NEW_INSTANCE}`);
  console.log('   Body: {');
  console.log('     "url": "https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook",');
  console.log('     "enabled": true,');
  console.log('     "events": ["MESSAGES_UPSERT", "CONNECTION_UPDATE"]');
  console.log('   }');

  console.log('\n3️⃣  Atualizar agente no banco de dados:');
  console.log('   Execute o código abaixo para atualizar automaticamente\n');

  // Atualizar agente automaticamente
  const { data: agent } = await supabase
    .from('agents')
    .select('*')
    .eq('whatsappInstanceId', OLD_INSTANCE)
    .single();

  if (agent) {
    console.log(`   ✅ Agente encontrado: ${agent.name}`);
    console.log('\n   Deseja atualizar para a nova instância? (sim/não)');
    console.log('   Se sim, execute:');
    console.log(`   
const { error } = await supabase
  .from('agents')
  .update({ whatsappInstanceId: '${NEW_INSTANCE}' })
  .eq('id', '${agent.id}');
    `);
  }

  console.log('\n\n📋 OPÇÃO 2: FORÇAR LOGOUT/RECONEXÃO');
  console.log('-'.repeat(80));
  
  try {
    console.log('\n🔌 Tentando desconectar instância antiga...');
    const logoutRes = await fetch(
      `${EVOLUTION_URL}/instance/logout/${OLD_INSTANCE}`,
      {
        method: 'DELETE',
        headers: { apikey: EVOLUTION_KEY }
      }
    );

    if (logoutRes.ok) {
      console.log('✅ Logout executado com sucesso');
      console.log('   Aguarde 30 segundos e reconecte escaneando novo QR Code');
    } else {
      console.log(`⚠️  Logout retornou ${logoutRes.status}: ${await logoutRes.text()}`);
    }
  } catch (err) {
    console.log(`❌ Erro ao fazer logout: ${err.message}`);
  }

  // Buscar QR Code
  console.log('\n📱 Buscando QR Code para reconexão...');
  
  try {
    const qrRes = await fetch(
      `${EVOLUTION_URL}/instance/connect/${OLD_INSTANCE}`,
      {
        headers: { apikey: EVOLUTION_KEY }
      }
    );

    if (qrRes.ok) {
      const qrData = await qrRes.json();
      console.log('✅ QR Code disponível!');
      console.log('\n🔗 Acesse este link no navegador para ver o QR Code:');
      console.log(`   ${EVOLUTION_URL}/instance/qrcode/${OLD_INSTANCE}`);
      
      if (qrData.qrcode?.base64) {
        console.log('\n📄 Ou salve este base64 e abra em: https://base64.guru/converter/decode/image');
      }
    } else {
      console.log(`⚠️  Não foi possível obter QR Code: ${qrRes.status}`);
    }
  } catch (err) {
    console.log(`❌ Erro ao buscar QR Code: ${err.message}`);
  }

  console.log('\n\n' + '='.repeat(80));
  console.log('📝 RESUMO');
  console.log('='.repeat(80));
  console.log('\n✅ MELHOR SOLUÇÃO: Recriar instância (OPÇÃO 1)');
  console.log('   1. Criar nova instância no Evolution API');
  console.log('   2. Configurar webhook');
  console.log('   3. Atualizar agente no banco');
  console.log('   4. Escanear QR Code');
  console.log('   5. Testar enviando mensagem');
  console.log('\n⚠️  SOLUÇÃO RÁPIDA: Forçar logout/reconexão (OPÇÃO 2)');
  console.log('   1. Aguardar 30s após logout');
  console.log('   2. Acessar QR Code no navegador');
  console.log('   3. Escanear com WhatsApp');
  console.log('   4. Aguardar status "open"');
  console.log('   5. Testar enviando mensagem\n');
}

recriarInstancia().catch(console.error);
