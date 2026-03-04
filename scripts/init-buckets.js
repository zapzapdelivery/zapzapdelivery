require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const BUCKETS = [
  { id: 'avatars', public: true },
  { id: 'products', public: true },
  { id: 'establishments', public: true },
  { id: 'partners', public: true },
  { id: 'categories', public: true }
];

async function initBuckets() {
  console.log('Initializing Supabase Storage Buckets...');

  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error('Error listing buckets:', listError);
    // Continue trying to create anyway? No, if listing fails, auth is probably wrong.
    return;
  }

  const existingIds = new Set(existingBuckets.map(b => b.id));

  for (const bucket of BUCKETS) {
    if (existingIds.has(bucket.id)) {
      console.log(`Bucket '${bucket.id}' already exists.`);
      
      // Update public status and configuration
      const { error: updateError } = await supabase.storage.updateBucket(bucket.id, {
        public: bucket.public,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'],
        fileSizeLimit: 5242880 // 5MB
      });
      
      if (updateError) {
         console.warn(`  Warning: Could not update bucket '${bucket.id}':`, updateError.message);
      } else {
         console.log(`  Updated configuration for '${bucket.id}'.`);
      }

    } else {
      console.log(`Creating bucket '${bucket.id}'...`);
      const { data, error } = await supabase.storage.createBucket(bucket.id, {
        public: bucket.public,
        allowedMimeTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'],
        fileSizeLimit: 5242880 // 5MB
      });

      if (error) {
        console.error(`  Error creating bucket '${bucket.id}':`, error.message);
      } else {
        console.log(`  Successfully created bucket '${bucket.id}'.`);
      }
    }
  }
  
  console.log('Bucket initialization complete.');
}

initBuckets();
