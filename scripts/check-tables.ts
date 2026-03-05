
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function listTables() {
  console.log('Listando tabelas...');
  
  // Como não há acesso direto ao schema information via API padrão sem permissões extras,
  // vamos tentar listar via RPC se existir, ou inferir.
  // Mas podemos tentar listar algumas conhecidas para ver se existem.
  
  const tables = ['pagamentos', 'transacoes', 'payment_attempts', 'pedidos_meta'];
  
  for (const table of tables) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (!error) {
          console.log(`Tabela encontrada: ${table}`);
      } else {
          console.log(`Tabela não encontrada ou erro: ${table} (${error.message})`);
      }
  }
}

listTables();
