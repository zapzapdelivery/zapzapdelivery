
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Load env
try {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    envContent.split('\n').forEach((line: string) => {
      const [key, value] = line.split('=');
      if (key && value) process.env[key.trim()] = value.trim();
    });
  }
} catch (e) {}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars for test');
  process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceKey);
const authClient = createClient(supabaseUrl, supabaseAnonKey!);

async function runTest() {
  console.log('--- Iniciando Teste de Segurança e Isolamento ---');

  // 1. Setup Test Data (Establishment + User)
  const testEmail = `test_${Date.now()}@example.com`;
  const testPass = 'Test@123456';
  
  console.log(`1. Criando usuário de teste: ${testEmail}`);
  
  const { data: { user }, error: createError } = await adminClient.auth.admin.createUser({
    email: testEmail,
    password: testPass,
    email_confirm: true
  });

  if (createError || !user) {
    console.error('Erro ao criar usuário:', createError);
    return;
  }

  // Create Establishment
  const { data: estab, error: estabError } = await adminClient
    .from('estabelecimentos')
    .insert({
      nome: 'Estabelecimento Teste Security',
      status_estabelecimento: 'ativo',
      cnpj_cpf: '00000000000'
    })
    .select()
    .single();

  if (estabError || !estab) {
    console.error('Erro ao criar estabelecimento:', estabError);
    return;
  }

  // Link User to Establishment
  await adminClient.from('usuarios').insert({
    id: user.id, // Assuming id matches auth.uid, or logic handles it
    auth_user_id: user.id,
    nome: 'User Teste',
    email: testEmail,
    estabelecimento_id: estab.id,
    status_usuario: 'ativo'
  });

  console.log(`   Usuário ${user.id} vinculado ao estabelecimento ${estab.id}`);

  // 2. Authenticate as User
  console.log('2. Autenticando como usuário...');
  const { data: { session }, error: loginError } = await authClient.auth.signInWithPassword({
    email: testEmail,
    password: testPass
  });

  if (loginError || !session) {
    console.error('Erro ao logar:', loginError);
    return;
  }

  console.log('   Login realizado com sucesso.');

  // 3. Test Insert Own Category
  console.log('3. Testando inserção de categoria no PRÓPRIO estabelecimento...');
  const { data: catOwn, error: catOwnError } = await authClient
    .from('categorias')
    .insert({
      nome_categoria: 'Categoria Permitida',
      estabelecimento_id: estab.id,
      status_categoria: 'ativo',
      ordem_exibicao: 1
    })
    .select()
    .single();

  if (catOwnError) {
    console.error('   [FALHA] Não foi possível criar categoria no próprio estabelecimento (RLS pode estar bloqueando tudo ou erro de schema):', catOwnError.message);
  } else {
    console.log('   [SUCESSO] Categoria criada no próprio estabelecimento.');
  }

  // 4. Test Insert Other Establishment Category
  console.log('4. Testando inserção de categoria em OUTRO estabelecimento (deve falhar se RLS estiver ativo)...');
  const fakeEstabId = '00000000-0000-0000-0000-000000000000'; // Fake UUID
  
  const { data: catOther, error: catOtherError } = await authClient
    .from('categorias')
    .insert({
      nome_categoria: 'Categoria Proibida',
      estabelecimento_id: fakeEstabId,
      status_categoria: 'ativo',
      ordem_exibicao: 1
    })
    .select()
    .single();

  if (catOtherError) {
    console.log('   [SUCESSO] Bloqueado corretamente:', catOtherError.message);
  } else {
    console.warn('   [ALERTA] Inserção permitida em outro estabelecimento! RLS não está ativo ou configurado corretamente.');
    // Cleanup bad data
    if (catOther) await adminClient.from('categorias').delete().eq('id', catOther.id);
  }

  // Cleanup
  console.log('5. Limpando dados de teste...');
  await adminClient.auth.admin.deleteUser(user.id);
  await adminClient.from('estabelecimentos').delete().eq('id', estab.id);
  // User deletion cascades to 'usuarios' usually, establishment delete cascades to categories
  
  console.log('--- Teste Finalizado ---');
}

runTest();
