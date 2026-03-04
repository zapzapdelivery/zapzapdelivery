import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);
    
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    // Audit Log
    console.log(`[AUDIT] User ${user.email} (${role}) accessing products. Establishment: ${establishmentId || 'None'} ${isSuperAdmin ? '(SuperAdmin)' : ''}`);

    let query = supabaseAdmin
      .from('produtos')
      .select('id, nome_produto, descricao, valor_base, categoria_id, imagem_produto_url, status_produto, criado_em, atualizado_em, estabelecimento_id');

    if (!isSuperAdmin) {
      if (!establishmentId) {
        // If user has no establishment and is not super admin, they shouldn't see any products
        // unless they are a customer (cliente) viewing a specific menu, but this API seems to be for Admin Panel.
        // Assuming Admin Panel context:
        return NextResponse.json({ data: [] });
      }
      
      // Force filter by establishment
      query = query.eq('estabelecimento_id', establishmentId);
    } else {
        // Super admin can filter by establishment if provided in query params
        const url = new URL(request.url);
        const estabIdParam = url.searchParams.get('estabelecimento_id');
        if (estabIdParam) {
            query = query.eq('estabelecimento_id', estabIdParam);
        }
    }

    // Fetch data with database sorting
    const { data: products, error: fetchError } = await query
      .order('atualizado_em', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false });

    if (fetchError) {
      console.error('Error fetching products:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json(products);
  } catch (error) {
    console.error('Unexpected error in /api/produtos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
