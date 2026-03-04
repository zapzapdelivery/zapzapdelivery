
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Carregar variáveis de ambiente manualmente do .env.local
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf-8');
  
  envContent.split('\n').forEach((line: string) => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
} catch (e) {
  console.log('Arquivo .env.local não encontrado ou erro ao ler, tentando variáveis de ambiente do sistema...');
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (ou ANON) são obrigatórios.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCategorias() {
  console.log('Inspecionando tabela public.categorias...');

  // Tentar pegar uma linha para ver os campos
  const { data, error } = await supabase
    .from('categorias')
    .select('*')
    .limit(1);

  if (error) {
    console.error('Erro ao consultar categorias:', error);
    return;
  }

  console.log('Exemplo de registro em categorias:', data);
  
  if (data && data.length > 0) {
    console.log('Campos encontrados:', Object.keys(data[0]));
  } else {
    console.log('Tabela vazia ou sem acesso. Tentando inferir estrutura...');
  }
}

inspectCategorias();
