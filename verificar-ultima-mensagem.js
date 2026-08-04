// Verificar última mensagem da RS Consultoria EAD
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function verificar() {
  console.log('🔍 VERIFICANDO ÚLTIMAS MENSAGENS - RS Consultoria EAD\n');
  console.log('='.repeat(80));

  // Buscar conversas da instância
  const { data: conversas } = await supabase
    .from('conversations')
    .select('*')
    .eq('instanceName', 'RS_Consultoria_EAD')
    .order('updatedAt', { ascending: false })
    .limit(5);

  if (!conversas || conversas.length === 0) {
    console.log('❌ Nenhuma conversa encontrada para RS_Consultoria_EAD');
    console.log('\n⚠️  ISSO SIGNIFICA:');
    console.log('   1. O webhook NÃO está enviando mensagens para o sistema');
    console.log('   2. OU a instância não está registrada corretamente');
    console.log('\n🔧 SOLUÇÃO:');
    console.log('   Verifique o webhook no Evolution API:');
    console.log('   URL deve ser: https://painel-primeiroagent.rsconsultoria.pro/api/public/evolution-webhook');
    return;
  }

  console.log(`✅ Encontradas ${conversas.length} conversas\n`);

  for (const conv of conversas) {
    console.log(`📱 Conversa: ${conv.contactName || conv.id}`);
    console.log(`   Bot Pausado: ${conv.botPaused ? '⏸️  SIM' : '✅ NÃO'}`);
    console.log(`   Status: ${conv.status}`);
    console.log(`   Última atualização: ${new Date(conv.updatedAt).toLocaleString('pt-BR')}`);

    // Buscar últimas mensagens desta conversa
    const { data: mensagens } = await supabase
      .from('messages')
      .select('*')
      .eq('conversationId', conv.id)
      .order('createdAt', { ascending: false })
      .limit(5);

    if (mensagens && mensagens.length > 0) {
      console.log(`\n   📨 Últimas ${mensagens.length} mensagens:`);
      mensagens.reverse().forEach((msg, i) => {
        const hora = new Date(msg.createdAt).toLocaleTimeString('pt-BR');
        const tipo = msg.bot ? '🤖 Bot' : (msg.fromMe ? '👤 Você' : '👥 Cliente');
        const texto = msg.text?.slice(0, 60) + (msg.text?.length > 60 ? '...' : '');
        console.log(`   ${i + 1}. [${hora}] ${tipo}: ${texto}`);
      });
    } else {
      console.log('   ❌ Nenhuma mensagem registrada nesta conversa');
    }
    
    console.log('');
  }

  // Verificar se há mensagens recentes (últimos 5 minutos)
  const cincoMinutosAtras = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const { data: mensagensRecentes } = await supabase
    .from('messages')
    .select('*, conversations!inner(*)')
    .eq('conversations.instanceName', 'RS_Consultoria_EAD')
    .gte('createdAt', cincoMinutosAtras)
    .order('createdAt', { ascending: false });

  if (mensagensRecentes && mensagensRecentes.length > 0) {
    console.log(`\n⏰ MENSAGENS DOS ÚLTIMOS 5 MINUTOS: ${mensagensRecentes.length}`);
    mensagensRecentes.forEach(msg => {
      const hora = new Date(msg.createdAt).toLocaleTimeString('pt-BR');
      const tipo = msg.bot ? '🤖 Bot' : (msg.fromMe ? '👤 Você' : '👥 Cliente');
      console.log(`   [${hora}] ${tipo}: ${msg.text?.slice(0, 80)}`);
    });
  } else {
    console.log('\n⚠️  NENHUMA mensagem nos últimos 5 minutos');
    console.log('   Se você acabou de enviar uma mensagem, isso significa que:');
    console.log('   ❌ O webhook NÃO está funcionando');
    console.log('   ❌ O Evolution API não está enviando eventos para o sistema');
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Verificação concluída\n');
}

verificar().catch(console.error);
