
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectSchema() {
  console.log('Inspecionando tabela pedidos...');
  
  // Tenta pegar uma linha para ver as chaves
  const { data, error } = await supabase
    .from('pedidos')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar pedidos:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Colunas encontradas:', Object.keys(data[0]));
    console.log('Exemplo de dados:', data[0]);
  } else {
    console.log('Tabela vazia ou sem acesso.');
  }
}

inspectSchema();
