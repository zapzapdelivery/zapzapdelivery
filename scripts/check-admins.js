
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkAdmins() {
  const adminTypeId = '075b7702-53b4-4655-9f31-08b9105e8ec2';
  
  const { data, error } = await supabase
    .from('usuarios')
    .select('id, nome, email, estabelecimento_id, tipo_usuario_id')
    .eq('tipo_usuario_id', adminTypeId);
  
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${data.length} users with 'administrador' type:`);
    console.table(data);
  }
}

checkAdmins();
