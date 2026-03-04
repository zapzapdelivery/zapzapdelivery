
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkTypes() {
  const { data, error } = await supabase
    .from('tipos_usuarios')
    .select('id, nome_tipo_usuario');
  
  if (error) {
    console.error(error);
  } else {
    console.log('User Types:');
    console.table(data);
  }

  const { data: defaults, error: defError } = await supabase
    .rpc('get_column_default', { t_name: 'usuarios', c_name: 'tipo_usuario_id' });
  
  if (defError) {
    console.log('Could not get default via RPC');
  } else {
    console.log('Default value for tipo_usuario_id:', defaults);
  }
}

checkTypes();
