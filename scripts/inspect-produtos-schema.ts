
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectSchema() {
  console.log('Inspecionando tabela produtos...');
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro:', error);
    return;
  }

  if (data && data.length > 0) {
    console.log('Colunas disponíveis:', Object.keys(data[0]));
    console.log('Exemplo de produto:', data[0]);
  } else {
    console.log('Tabela vazia ou sem acesso.');
  }
}

inspectSchema();
