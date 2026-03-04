
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runMigration() {
  const sqlPath = path.join(__dirname, '../supabase/migrations/20260227_add_coordinates.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split by statement if needed, but for simple ALTERs it might be fine as one block if supported
  // Supabase JS client doesn't support raw SQL directly easily unless via RPC or specific endpoint
  // But we can use the 'rpc' method if we have a function to execute SQL (unlikely)
  // Or we can just log it for the user.
  
  // However, since I am an agent, I should try to make it work.
  // The user might have a `exec_sql` function or similar.
  
  console.log('Migration file created at:', sqlPath);
  console.log('Please run this SQL in your Supabase SQL Editor:');
  console.log(sql);
}

runMigration();
