
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectPagamentos() {
  console.log('Inspecionando tabela pagamentos...');
  
  const { data, error } = await supabase
    .from('pagamentos')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao buscar pagamentos:', error);
  } else {
    if (data && data.length > 0) {
      console.log('Colunas pagamentos:', Object.keys(data[0]));
      console.log('Exemplo pagamentos:', data[0]);
    } else {
      console.log('Tabela pagamentos vazia.');
      // Tentar inserir dummy data para descobrir colunas seria arriscado.
    }
  }
}

inspectPagamentos();
