
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function inspectTable() {
  // Try to get column information from information_schema
  const { data, error } = await supabase.rpc('inspect_table_columns', { table_name: 'usuarios' });
  
  if (error) {
    console.log('RPC inspect_table_columns failed, trying direct query if allowed...');
    // Some Supabase setups allow querying information_schema if using service_role
    const { data: cols, error: colsError } = await supabase
      .from('information_schema.columns')
      .select('column_name, column_default, is_nullable, data_type')
      .eq('table_name', 'usuarios')
      .eq('table_schema', 'public');
    
    if (colsError) {
      console.error('Direct query failed:', colsError);
    } else {
      console.log('Columns for usuarios:');
      console.table(cols);
    }
  } else {
    console.log('Columns for usuarios:');
    console.table(data);
  }
}

inspectTable();
