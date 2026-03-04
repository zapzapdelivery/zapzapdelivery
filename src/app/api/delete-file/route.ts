import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    // 1. Auth Check
    const { user, error: authError } = await getAuthContext(request);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Parse Request Body
    const { url, bucket: rawBucket } = await request.json();
    const bucket = rawBucket?.trim();

    if (!url || !bucket) {
      return NextResponse.json({ error: 'URL and bucket are required' }, { status: 400 });
    }

    // 3. Validation
    // Validate bucket name against allowlist
    const ALLOWED_BUCKETS = ['avatars', 'products', 'establishments', 'partners', 'categories', 'perfil'];
    if (!ALLOWED_BUCKETS.includes(bucket.toLowerCase())) {
      return NextResponse.json({ error: `Invalid bucket: ${bucket}` }, { status: 400 });
    }

    // 4. Extract Path from URL
    // URL format: https://PROJECT_ID.supabase.co/storage/v1/object/public/BUCKET/PATH
    // or sometimes custom domain. We need to be careful extracting the path.
    // However, usually we can just rely on the path relative to the bucket.
    
    let path = '';
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
      
      if (pathParts.length === 2) {
        path = decodeURIComponent(pathParts[1]);
      } else {
        // Fallback: try to match from end if structure is different
        // but standard supabase storage url is consistent.
        // If using custom domain, it might differ.
        console.warn('Could not parse standard Supabase URL, trying simple path extraction');
        // This is risky without knowing exact structure, but let's assume standard for now.
        return NextResponse.json({ error: 'Invalid Supabase Storage URL format' }, { status: 400 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Invalid URL' }, { status: 400 });
    }

    if (!path) {
      return NextResponse.json({ error: 'Could not extract file path' }, { status: 400 });
    }

    // 5. Delete using Service Role
    const { error: deleteError } = await supabaseAdmin.storage
      .from(bucket)
      .remove([path]);

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Unexpected delete error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
