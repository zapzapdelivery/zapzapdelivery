import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_EMAIL = `atendente_test_${Date.now()}@example.com`;
const TEST_PASSWORD = 'TestPassword123!';

async function runTests() {
  console.log('Starting permission tests...');

  let userId = null;

  try {
    // 1. Create Test User
    console.log(`Creating test user: ${TEST_EMAIL}`);
    const { data: userData, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
      email_confirm: true
    });

    if (createError) throw createError;
    userId = userData.user.id;
    console.log(`User created with ID: ${userId}`);

    // 1.5 Create entry in public.usuarios
    console.log("Creating entry in public.usuarios...");
    const { error: publicUserError } = await supabaseAdmin
      .from('usuarios')
      .insert({
        id: userId, // Assuming id matches auth id or we set it
        auth_user_id: userId,
        email: TEST_EMAIL,
        nome: 'Test Atendente'
      });
    
    // Note: If insert fails because id constraint or something, we might need to adjust.
    // But usually id is PK.
    if (publicUserError) {
        console.log('Error creating public user (might be trigger auto-creation?):', publicUserError.message);
        // If trigger exists, it might have created it already.
        // Let's check if it exists.
        const { data: checkUser } = await supabaseAdmin.from('usuarios').select('id').eq('auth_user_id', userId).single();
        if (!checkUser) throw publicUserError;
        console.log('User exists in public.usuarios');
    } else {
        console.log("Entry created in public.usuarios.");
    }

    // 2. Assign 'atendente' role
    console.log("Assigning 'atendente' role...");
    const { error: roleError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: userId, role: 'atendente' });

    if (roleError) throw roleError;
    console.log("Role assigned.");

    // 3. Sign in to get token
    const { data: signInData, error: signInError } = await supabaseAdmin.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD
    });

    if (signInError) throw signInError;
    const token = signInData.session.access_token;
    console.log("Logged in successfully.");

    // 4. Test Restricted Endpoints
    const endpoints = [
      '/api/estabelecimentoss',
      '/api/usuarios',
      '/api/parceiros'
    ];

    const baseUrl = 'http://localhost:3000'; // Assuming dev server is running
    
    // Note: If dev server is not running, we cannot test the endpoints.
    // We will try to fetch, if connection refused, we warn.
    
    let allPassed = true;

    for (const endpoint of endpoints) {
      console.log(`Testing GET ${endpoint}...`);
      try {
        const res = await fetch(`${baseUrl}${endpoint}`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        console.log(`Status: ${res.status}`);
        
        if (res.status === 403) {
          console.log(`✅ Passed: Access denied as expected.`);
        } else {
          console.log(`❌ Failed: Expected 403, got ${res.status}`);
          allPassed = false;
        }
      } catch (err) {
        if (err.code === 'ECONNREFUSED') {
            console.error('❌ Error: Connection refused. Is the Next.js server running on port 3000?');
            allPassed = false;
            break;
        } else {
            console.error(`❌ Error testing ${endpoint}:`, err.message);
            allPassed = false;
        }
      }
    }
    
    if (allPassed) {
        console.log('\nAll permission tests PASSED! 🎉');
    } else {
        console.log('\nSome tests FAILED. Check logs above.');
    }

  } catch (error) {
    console.error('Test script failed:', error);
  } finally {
    // 5. Cleanup
    if (userId) {
      console.log(`Cleaning up user: ${userId}`);
      await supabaseAdmin.auth.admin.deleteUser(userId);
      // user_roles should cascade delete or we delete manually if needed
      // Assuming cascade or manual cleanup
      await supabaseAdmin.from('user_roles').delete().eq('user_id', userId);
    }
  }
}

runTests();
