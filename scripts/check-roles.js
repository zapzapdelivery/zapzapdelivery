
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkRoles() {
  const { data, error } = await supabase
    .from('user_roles')
    .select('user_id, role')
    .eq('role', 'administrador');

  if (error) {
    console.error(error);
    return;
  }

  console.log('Usuários com role administrador em user_roles:', data);

  if (data && data.length > 0) {
    const userIds = data.map(r => r.user_id);
    const { data: users, error: usersError } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .in('id', userIds);
    
    if (usersError) {
      console.error(usersError);
    } else {
      console.log('Detalhes dos usuários:', users);
    }
  }
}

checkRoles();
