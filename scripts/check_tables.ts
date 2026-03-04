
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual env loader
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env: Record<string, string> = {};
envContent.split('\n').forEach(line => {
  const [key, value] = line.split('=');
  if (key && value) env[key.trim()] = value.trim();
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing env vars');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
  console.log('--- Checking Tables ---');

  const tables = ['pedidos', 'produtos', 'estabelecimentos', 'usuarios', 'categorias'];
  
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.log(`Table '${table}' check failed:`, error.message);
    } else {
      console.log(`Table '${table}' exists. Count: ${count}`);
      
      const { data: sample, error: sampleError } = await supabase.from(table).select('*, estoque').limit(1);
      if (sampleError) {
          // If error is about column not found, we know it doesn't exist.
          console.log(`Error selecting estoque from ${table}:`, sampleError.message);
          // Fallback to *
          const { data: sample2 } = await supabase.from(table).select('*').limit(1);
          if (sample2 && sample2.length > 0) console.log(`Sample row for ${table} (fallback):`, sample2[0]);
      } else if (sample && sample.length > 0) {
        console.log(`Sample row for ${table}:`, sample[0]);
      } else {
        console.log(`No rows in ${table} to sample.`);
        // Check columns via error message or just leave it
        if (table === 'pedidos') {
             // Try to insert a dummy row to see columns? No.
             // Try to select a non-existent column to get error with hints? No.
             // Just assume it's empty for now.
        }
      }
    }
  }
}

main().catch(console.error);
