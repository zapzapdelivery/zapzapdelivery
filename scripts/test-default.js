
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testDefault() {
  const tempEmail = `test_default_${Date.now()}@example.com`;
  const tempId = '00000000-0000-0000-0000-000000000001'; // Try a dummy UUID
  
  console.log('Inserting user with null tipo_usuario_id...');
  const { data, error } = await supabase
    .from('usuarios')
    .insert({
      id: tempId,
      nome: 'Test Default',
      email: tempEmail,
      status_usuario: 'ativo',
      tipo_usuario_id: null // Explicitly null
    })
    .select('tipo_usuario_id')
    .single();

  if (error) {
    console.error('Insert failed:', error);
    // If it failed because of ID conflict, try to fetch it
    const { data: existing } = await supabase
        .from('usuarios')
        .select('tipo_usuario_id')
        .eq('id', tempId)
        .single();
    if (existing) {
        console.log('Existing user has tipo_usuario_id:', existing.tipo_usuario_id);
    }
  } else {
    console.log('Inserted user has tipo_usuario_id:', data.tipo_usuario_id);
    // Cleanup
    await supabase.from('usuarios').delete().eq('id', tempId);
  }

  // Now try WITHOUT specifying the column at all
  console.log('Inserting user WITHOUT tipo_usuario_id column...');
  const tempId2 = '00000000-0000-0000-0000-000000000002';
  const { data: data2, error: error2 } = await supabase
    .from('usuarios')
    .insert({
      id: tempId2,
      nome: 'Test Default 2',
      email: `test_default_2_${Date.now()}@example.com`,
      status_usuario: 'ativo'
    })
    .select('tipo_usuario_id')
    .single();

  if (error2) {
    console.error('Insert 2 failed:', error2);
  } else {
    console.log('Inserted user 2 has tipo_usuario_id:', data2.tipo_usuario_id);
    // Cleanup
    await supabase.from('usuarios').delete().eq('id', tempId2);
  }
}

testDefault();
