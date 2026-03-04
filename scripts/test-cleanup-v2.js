
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const CONFIG = [
    {
        entity: 'Usuarios',
        table: 'usuarios',
        bucket: 'avatars',
        folder: 'usuarios', // Optional, filtering by folder path prefix if needed
        columns: ['avatar_url']
    },
    {
        entity: 'Estabelecimentos',
        table: 'estabelecimentos',
        bucket: 'establishments',
        folder: 'estabelecimentos',
        columns: ['logo_url', 'capa_url', 'logoUrl', 'capaUrl'] // Check variations
    },
    {
        entity: 'Parceiros',
        table: 'parceiros',
        bucket: 'partners',
        folder: 'parceiros',
        columns: ['logo_url', 'logoUrl']
    },
    {
        entity: 'Categorias',
        table: 'categorias',
        bucket: 'categories',
        folder: 'categorias',
        columns: ['imagem_categoria_url']
    },
    {
        entity: 'Produtos',
        table: 'produtos',
        bucket: 'products',
        folder: 'produtos',
        columns: ['imagem_produto_url']
    }
];

async function listAllFiles(bucket) {
    let allFiles = [];
    
    async function traverse(path) {
        const { data: items, error } = await supabase.storage.from(bucket).list(path, { limit: 100 });
        if (error) {
            console.error(`Error listing ${bucket}/${path}:`, error.message);
            return;
        }

        for (const item of items) {
            if (!item.id) {
                // Folder
                await traverse(path ? `${path}/${item.name}` : item.name);
            } else {
                // File
                const fullPath = path ? `${path}/${item.name}` : item.name;
                allFiles.push(fullPath);
            }
        }
    }

    await traverse('');
    return allFiles;
}

async function getUsedUrls(table, columns) {
    // First, verify which columns exist
    const { data: sample, error: sampleError } = await supabase.from(table).select('*').limit(1);
    
    if (sampleError) {
        console.error(`Error checking schema for ${table}:`, sampleError.message);
        return [];
    }
    
    if (!sample || sample.length === 0) return [];

    const validCols = columns.filter(col => Object.keys(sample[0]).includes(col));
    
    if (validCols.length === 0) {
        console.warn(`No matching image columns found for ${table} among [${columns.join(', ')}]`);
        return [];
    }

    const { data: rows, error } = await supabase.from(table).select(validCols.join(','));
    if (error) {
        console.error(`Error fetching data from ${table}:`, error.message);
        return [];
    }

    const urls = [];
    rows.forEach(row => {
        validCols.forEach(col => {
            if (row[col]) urls.push(row[col]);
        });
    });
    
    return urls;
}

async function runCleanupTest() {
    console.log('--- STARTING CLEANUP DRY-RUN ---\n');

    for (const conf of CONFIG) {
        console.log(`Checking ${conf.entity}...`);
        
        // 1. Get all files in bucket
        const storageFiles = await listAllFiles(conf.bucket);
        console.log(`  Storage (${conf.bucket}): Found ${storageFiles.length} files.`);

        if (storageFiles.length === 0) {
            console.log('  No files to check.\n');
            continue;
        }

        // 2. Get all used URLs from DB
        const dbUrls = await getUsedUrls(conf.table, conf.columns);
        console.log(`  Database (${conf.table}): Found ${dbUrls.length} image references.`);

        // 3. Extract paths from DB URLs to match storage paths
        // DB URL format: .../storage/v1/object/public/{bucket}/{path}
        // or just relative path? Usually full public URL.
        const usedPaths = dbUrls.map(url => {
            if (!url) return null;
            const parts = url.split(`/${conf.bucket}/`);
            if (parts.length > 1) {
                return decodeURIComponent(parts[1]);
            }
            return null;
        }).filter(p => p);

        // 4. Find Orphans
        const orphans = storageFiles.filter(file => !usedPaths.includes(file));

        if (orphans.length > 0) {
            console.log(`  [WARNING] Found ${orphans.length} orphan files (candidates for deletion):`);
            orphans.forEach(f => console.log(`    - ${f}`));
        } else {
            console.log('  [OK] No orphan files found.');
        }
        console.log('');
    }

    console.log('--- DRY-RUN COMPLETE ---');
}

runCleanupTest();
