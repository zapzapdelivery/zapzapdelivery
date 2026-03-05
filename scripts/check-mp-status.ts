import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConfig() {
  const estabelecimentoId = '7535ce68-740f-4ba8-bf12-e757ef9d3fa7';
  
  const { data: config, error } = await supabase
    .from('configuracoes_mercadopago')
    .select('*')
    .eq('estabelecimento_id', estabelecimentoId)
    .single();

  if (error) {
    console.error('Erro ao buscar configuração:', error);
    return;
  }

  console.log('Configuração atual:', {
    id: config.id,
    ambiente: config.ambiente,
    ativo: config.ativo,
    public_key: config.public_key ? config.public_key.substring(0, 10) + '...' : null,
    access_token: config.access_token ? config.access_token.substring(0, 10) + '...' : null,
    public_key_producao: config.public_key_producao ? config.public_key_producao.substring(0, 10) + '...' : null,
    access_token_producao: config.access_token_producao ? config.access_token_producao.substring(0, 10) + '...' : null,
  });
}

checkConfig();
