import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    // 1. Auth Check
    const { user, error: authError } = await getAuthContext(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Form Data
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const rawBucket = formData.get('bucket') as string;
    const bucket = rawBucket?.trim();
    const folder = formData.get('folder') as string;

    if (!file || !bucket) {
      return NextResponse.json({ error: 'File and bucket are required' }, { status: 400 });
    }

    // 3. Validation
    // Validate bucket name against allowlist
    const ALLOWED_BUCKETS = ['avatars', 'products', 'establishments', 'partners', 'categories', 'perfil'];
    if (!ALLOWED_BUCKETS.includes(bucket.toLowerCase())) {
      return NextResponse.json({ error: `Invalid bucket: ${bucket}` }, { status: 400 });
    }

    // Validate file type
    const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'];
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type' }, { status: 400 });
    }

    // Validate size (bucket-specific). Products: 2MB; others: 5MB
    const maxMB = bucket.toLowerCase() === 'products' ? 2 : 5;
    if (file.size > maxMB * 1024 * 1024) {
      return NextResponse.json({ error: `File too large (max ${maxMB}MB)` }, { status: 400 });
    }

    // 4. Prepare Upload Path
    const fileExt = file.name.split('.').pop();
    const fileName = `${crypto.randomUUID()}.${fileExt}`;
    const folderPath = folder ? `${folder}/` : '';
    const filePath = `${folderPath}${fileName}`;

    // 5. Upload using Service Role (Bypassing RLS)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { data, error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(filePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    // 6. Get Public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return NextResponse.json({ url: publicUrl });

  } catch (error: any) {
    console.error('Unexpected upload error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
