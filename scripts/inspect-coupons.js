
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

async function inspectCoupons() {
  console.log('Iniciando inspeção da tabela cupons...');

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Erro: Variáveis de ambiente do Supabase não encontradas.');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Tentar inserir um registro dummy para ver o erro e descobrir colunas, ou dar um select * limit 1
  const { data, error } = await supabase
    .from('cupons')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao fazer select:', error);
  } else {
    console.log('Select bem sucedido. Dados:', data);
    if (data.length > 0) {
        console.log('Colunas encontradas:', Object.keys(data[0]));
    } else {
        console.log('Tabela vazia. Tentando inserir para descobrir colunas...');
    }
  }
}

inspectCoupons();
