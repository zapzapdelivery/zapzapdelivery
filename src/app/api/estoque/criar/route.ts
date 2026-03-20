import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function POST(request: Request) {
  try {
    const { user, establishmentId, isSuperAdmin, error, status } = await getAuthContext(request);
    
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    const { produto_id, estabelecimento_id, estoque_atual, estoque_minimo } = await request.json();

    if (!produto_id || !estabelecimento_id) {
        return NextResponse.json({ error: 'produto_id e estabelecimento_id são obrigatórios' }, { status: 400 });
    }

    if (!isSuperAdmin && establishmentId !== estabelecimento_id) {
         return NextResponse.json({ error: 'Não autorizado para este estabelecimento' }, { status: 403 });
    }

    const { data: stockData, error: stockError } = await supabaseAdmin
        .from('estoque_produtos')
        .insert({
            produto_id,
            estabelecimento_id,
            estoque_atual: estoque_atual || 0,
            estoque_minimo: estoque_minimo || 0
        })
        .select()
        .single();
        
    if (stockError) {
        console.error('Erro ao adicionar estoque inicial (API):', stockError);
        return NextResponse.json({ error: stockError.message }, { status: 500 });
    }

    return NextResponse.json({ data: stockData });
  } catch (err: any) {
    console.error('API estoque criar erro:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
