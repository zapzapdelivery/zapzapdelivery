import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateConfig() {
  const estabelecimentoId = '7535ce68-740f-4ba8-bf12-e757ef9d3fa7';
  
  const { data, error } = await supabase
    .from('configuracoes_mercadopago')
    .update({ ambiente: 'producao' })
    .eq('estabelecimento_id', estabelecimentoId)
    .select();

  if (error) {
    console.error('Erro ao atualizar configuração:', error);
    return;
  }

  console.log('Configuração atualizada para PRODUÇÃO:', data);
}

updateConfig();
