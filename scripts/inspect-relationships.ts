
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  console.log('Checking tables...');
  
  const tables = ['estabelecimentos', 'tipos_estabelecimento', 'tipo_estabelecimentos'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (!error) {
      console.log(`Table exists: ${table}`);
    } else {
      console.log(`Table error: ${table} - ${error.message}`);
    }
  }

  // Check data in estabelecimentos to see the foreign key column
  const { data: est, error: estError } = await supabase
    .from('estabelecimentos')
    .select('*')
    .limit(1);
    
  if (est && est.length > 0) {
    console.log('Sample establishment keys:', Object.keys(est[0]));
  }
}

inspect();
