import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const top10 = searchParams.get('top10') === 'true';
  const categoryId = searchParams.get('category_id');
  const uf = searchParams.get('uf');
  const cidade = searchParams.get('cidade');
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '10');
  const offset = (page - 1) * limit;

  try {
    let query = supabaseAdmin
      .from('estabelecimentos')
      .select(`
        id,
        name:nome_estabelecimento,
        logoUrl:imagem_estabelecimento_url,
        url_cardapio,
        created_at:criado_em,
        ordem,
        cidade,
        uf,
        tipo_estabelecimento_id,
        tipos_estabelecimento:tipo_estabelecimentos (
          id,
          name:nome
        )
      `, { count: 'exact' })
      .eq('status_estabelecimento', 'ativo')
      .eq('is_open', true);

    if (top10) {
      if (uf) query = query.eq('uf', uf);
      if (cidade) query = query.eq('cidade', cidade);

      // Try to sort by order first. 
      // If the column 'ordem' doesn't exist, this might fail, 
      // but we assume the migration has been run.
      // We use nullsLast to ensure established order comes first.
      query = query
        .order('ordem', { ascending: true, nullsFirst: false })
        .order('criado_em', { ascending: false })
        .limit(10);
    } else {
      if (categoryId) {
        query = query.eq('tipo_estabelecimento_id', categoryId);
      }
      
      if (uf) query = query.eq('uf', uf);
      if (cidade) query = query.eq('cidade', cidade);
      
      query = query
        .range(offset, offset + limit - 1)
        .order('criado_em', { ascending: false });
    }

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching establishments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const establishments = data?.map(item => ({
      ...item,
      address: item.cidade && item.uf ? `${item.cidade} - ${item.uf}` : (item.cidade || item.uf || 'Vila Rica - MT')
    }));

    return NextResponse.json({
      data: establishments,
      count,
      page,
      limit,
      totalPages: count ? Math.ceil(count / limit) : 0
    });
  } catch (error) {
    console.error('Internal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
