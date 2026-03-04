
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
  console.log('Checking columns...');
  const { data, error } = await supabase
    .from('enderecos_clientes')
    .select('ponto_referencia, tipo_endereco')
    .limit(1);

  if (error) {
    console.log('ERROR:', error.message);
  } else {
    console.log('SUCCESS:', data);
  }
}

check();
