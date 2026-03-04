
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function inspectPedidos() {
  console.log('Iniciando inspeção da tabela pedidos...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao fazer select:', error);
  } else {
    if (data.length > 0) {
        console.log('Colunas encontradas em PEDIDOS:', Object.keys(data[0]));
    } else {
        console.log('Tabela vazia. Tentando inserir dummy para descobrir colunas (não recomendado sem saber schema)...');
        // Melhor apenas listar o erro se não conseguir select
    }
  }
}

inspectPedidos();
