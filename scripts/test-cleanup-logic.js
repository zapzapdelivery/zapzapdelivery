
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

// Create a single supabase client for interacting with your database
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testCleanup() {
    console.log('Testing cleanup API...');
    
    // 1. Get a session token (simulated or real if possible, but for admin API we might need service role or specific header)
    // The API uses getAuthContext which checks for user session.
    // For this test, we might fail if we don't have a user token. 
    // However, the user asked to "Implement integration". 
    // Let's try to call the API using a script that simulates the fetch from the server side? 
    // No, the API is an HTTP endpoint. 
    // We can use the service role key to bypass auth if we modified the API to accept it, 
    // BUT the API checks `supabase.auth.getUser()`.
    
    // Instead of calling the API endpoint via HTTP, let's just run the cleanup logic directly in this script 
    // to verify the logic (traversal, etc). This is better for "dry run" verification of the *logic*.
    
    const bucketName = 'establishments';
    
    console.log(`Listing files in bucket '${bucketName}'...`);
    
    const { data: files, error } = await supabase.storage.from(bucketName).list('', { limit: 100 });
    
    if (error) {
        console.error('Error listing files:', error);
        return;
    }
    
    console.log(`Found ${files.length} files/folders at root.`);
    
    // Recursive traversal test
    async function traverse(path) {
        console.log(`Traversing ${path}...`);
        const { data: items, error } = await supabase.storage.from(bucketName).list(path);
        if (error) {
            console.error(`Error in ${path}:`, error);
            return [];
        }
        
        let all = [];
        for (const item of items) {
            if (!item.id) {
                // Folder
                const sub = await traverse(path ? `${path}/${item.name}` : item.name);
                all = all.concat(sub);
            } else {
                all.push(path ? `${path}/${item.name}` : item.name);
            }
        }
        return all;
    }
    
    const allFiles = await traverse('');
    console.log('All files found (recursive):', allFiles);
    
    // Check DB schema first
    const { data: sample, error: sampleError } = await supabase.from('estabelecimentos').select('*').limit(1);
    if (sampleError) {
        console.error('Error fetching sample:', sampleError);
        return;
    }
    if (sample && sample.length > 0) {
        console.log('Estabelecimentos columns:', Object.keys(sample[0]));
        const logoCol = Object.keys(sample[0]).find(k => k.includes('logo') || k.includes('image') || k.includes('url'));
        console.log('Potential logo column:', logoCol);
    }

    // Check Categorias Schema
    const { data: catSample, error: catError } = await supabase.from('categorias').select('*').limit(1);
    if (catError) {
        console.error('Error fetching categorias sample:', catError);
    } else if (catSample && catSample.length > 0) {
        console.log('Categorias columns:', Object.keys(catSample[0]));
    }

    // Check Parceiros Schema
    const { data: parcSample, error: parcError } = await supabase.from('parceiros').select('*').limit(1);
    if (parcError) {
        console.error('Error fetching parceiros sample:', parcError);
    } else if (parcSample && parcSample.length > 0) {
        console.log('Parceiros columns:', Object.keys(parcSample[0]));
    }



    
    return; // Stop here for now

    // Check DB for used files
    const { data: dbFiles, error: dbError } = await supabase.from('estabelecimentos').select('logo_url');
    
    if (dbError) {
        console.error('Error fetching from DB:', dbError);
        return;
    }
    
    if (!dbFiles) {
        console.log('No data returned from DB');
        return;
    }

    const usedUrls = dbFiles.map(r => r.logo_url).filter(u => u);
    
    console.log(`Found ${usedUrls.length} used URLs in DB.`);
    
    // Check intersection
    const usedPaths = usedUrls.map(url => {
        const parts = url.split(`/${bucketName}/`);
        return parts.length > 1 ? decodeURIComponent(parts[1]) : null;
    }).filter(p => p);
    
    console.log('Used paths:', usedPaths);
    
    const orphans = allFiles.filter(f => !usedPaths.includes(f));
    console.log('Orphans to be deleted:', orphans);
}

testCleanup();
