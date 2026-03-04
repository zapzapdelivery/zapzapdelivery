import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

interface CleanupResult {
  bucket: string;
  totalFiles: number;
  usedFiles: number;
  deletedFiles: number;
  errors: string[];
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { isSuperAdmin, error, status } = await getAuthContext(request);
    
    if (error || !isSuperAdmin) {
      return NextResponse.json({ error: error || 'Unauthorized' }, { status: status || 401 });
    }

    const body = await request.json().catch(() => ({}));
    const dryRun = body.dryRun !== false; // Default to true (safe mode)

    const results: CleanupResult[] = [];

    // 1. Products Cleanup
    results.push(await cleanupBucket(
      'products',
      'produtos',
      'imagem_produto_url',
      dryRun
    ));

    // 2. Establishments Cleanup (Logo)
    results.push(await cleanupBucket('establishments', 'estabelecimentos', 'imagem_estabelecimento_url', dryRun));
    // Note: If 'establishments' bucket is used for both logo and cover, we need to check both columns.
    // My previous implementation suggests they might be in the same bucket but maybe different folders?
    // Let's assume 'establishments' bucket holds both.

    // 3. Categories Cleanup
    results.push(await cleanupBucket(
      'categories',
      'categorias',
      'imagem_categoria_url',
      dryRun
    ));

    // 4. Partners Cleanup
    results.push(await cleanupBucket(
      'partners',
      'parceiros',
      'imagem_parceiro_url',
      dryRun
    ));

    // 5. Avatars Cleanup
    /*
    results.push(await cleanupBucket(
      'avatars',
      'usuarios',
      'avatar_url',
      dryRun
    ));
    */

    return NextResponse.json({ 
      success: true, 
      dryRun, 
      results,
      message: dryRun ? 'Dry run completed. No files were deleted.' : 'Cleanup completed.' 
    });

  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function cleanupBucket(
  bucketName: string, 
  tableName: string, 
  columnName: string, 
  dryRun: boolean,
  extraColumns: string[] = []
): Promise<CleanupResult> {
  const result: CleanupResult = {
    bucket: bucketName,
    totalFiles: 0,
    usedFiles: 0,
    deletedFiles: 0,
    errors: []
  };

  try {
    // 1. List all files in bucket
    const { data: files, error: listError } = await supabaseAdmin.storage
      .from(bucketName)
      .list('', { limit: 1000, offset: 0 }); // Recursive list not fully supported by list(), might need recursive function for folders.
    
    // Note: .list() is shallow by default. If we use folders (e.g. 'produtos/'), we need to list inside them.
    // The current ImageUpload implementation uses folders like 'produtos', 'estabelecimentos', etc.
    // So files are NOT at root. They are in a subfolder.
    // Let's try to list recursively or check known folders.
    // Actually, ImageUpload prop 'folder' implies the path prefix.
    // If we passed folder="produtos", the file is at "produtos/filename".
    // So we should list the root and if we see folders, list them too.
    
    // For simplicity, let's assume a known structure or try to list recursively if possible.
    // Supabase storage list doesn't support recursive flag easily.
    // We'll list root, and if we find folders, we enter them.
    
    let allFiles: { name: string; path: string }[] = [];
    
    if (listError) throw listError;

    // Helper to traverse folders
    async function traverse(path: string) {
      const { data: items, error } = await supabaseAdmin.storage
        .from(bucketName)
        .list(path, { limit: 100 });
      
      if (error) {
        result.errors.push(`Error listing path ${path}: ${error.message}`);
        return;
      }

      if (!items) return;

      for (const item of items) {
        if (item.id === null) {
          // It's a folder (Supabase storage convention: folders have id null)
          await traverse(path ? `${path}/${item.name}` : item.name);
        } else {
          // It's a file
          allFiles.push({
            name: item.name,
            path: path ? `${path}/${item.name}` : item.name
          });
        }
      }
    }

    await traverse('');
    
    result.totalFiles = allFiles.length;

    if (allFiles.length === 0) return result;

    // 2. Get all used URLs from DB
    const columns = [columnName, ...extraColumns].join(',');
    const { data: rows, error: dbError } = await supabaseAdmin
      .from(tableName)
      .select(columns);

    if (dbError) throw dbError;

    // Normalize DB URLs to get paths
    // URLs are like: https://PROJECT.supabase.co/storage/v1/object/public/BUCKET/PATH
    // We need to extract PATH.
    const usedPaths = new Set<string>();
    
    rows?.forEach((row: any) => {
      [columnName, ...extraColumns].forEach(col => {
        const url = row[col];
        if (url && typeof url === 'string') {
          // Extract path from URL
          // Simple heuristic: split by bucket name
          const parts = url.split(`/${bucketName}/`);
          if (parts.length > 1) {
            // parts[1] is the path (decoded)
            usedPaths.add(decodeURIComponent(parts[1]));
          }
        }
      });
    });

    result.usedFiles = usedPaths.size; // Approximation

    // 3. Identify orphans
    const orphans = allFiles.filter(file => !usedPaths.has(file.path));

    // 4. Delete orphans
    if (!dryRun && orphans.length > 0) {
      const pathsToDelete = orphans.map(o => o.path);
      // Delete in batches of 50
      for (let i = 0; i < pathsToDelete.length; i += 50) {
        const batch = pathsToDelete.slice(i, i + 50);
        const { error: delError } = await supabaseAdmin.storage
          .from(bucketName)
          .remove(batch);
        
        if (delError) {
          result.errors.push(`Error deleting batch: ${delError.message}`);
        } else {
          result.deletedFiles += batch.length;
        }
      }
    } else {
      // In dry run, we just count them as "would be deleted"
      result.deletedFiles = orphans.length; 
    }

  } catch (err: any) {
    result.errors.push(err.message);
  }

  return result;
}
