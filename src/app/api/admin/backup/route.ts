import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { isSuperAdmin, error, status } = await getAuthContext(request);
    
    if (error || !isSuperAdmin) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: status || 401 });
    }

    const buckets = ['products', 'establishments', 'categories', 'partners', 'avatars'];
    const backupManifest: Record<string, string[]> = {};

    for (const bucket of buckets) {
      const files: string[] = [];
      
      // Recursive traverse
      const traverse = async (path: string) => {
        const { data: items, error } = await supabaseAdmin.storage
          .from(bucket)
          .list(path, { limit: 100 });
        
        if (error || !items) return;

        for (const item of items) {
          if (item.id === null) {
            // Folder
            await traverse(path ? `${path}/${item.name}` : item.name);
          } else {
            // File - Construct Public URL
            const { data } = supabaseAdmin.storage
                .from(bucket)
                .getPublicUrl(path ? `${path}/${item.name}` : item.name);
            
            if (data?.publicUrl) {
                files.push(data.publicUrl);
            }
          }
        }
      };

      await traverse('');
      backupManifest[bucket] = files;
    }

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      files: backupManifest,
      instructions: "Use a download tool (like wget or curl) to download these files."
    });

  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
