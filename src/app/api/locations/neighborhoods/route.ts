import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const city = searchParams.get('city');
  const state = searchParams.get('state');

  if (!city || !state) {
    return NextResponse.json({ error: 'City and state are required' }, { status: 400 });
  }

  try {
    // Fetch all neighborhoods for the city from ALL establishments
    // This allows cross-establishment neighborhood sharing
    const { data, error } = await supabaseAdmin
      .from('taxas_bairros')
      .select(`
        nome_bairro,
        taxa_entregas!inner(
          estabelecimentos!inner(cidade, uf)
        )
      `)
      .eq('taxa_entregas.estabelecimentos.cidade', city)
      .eq('taxa_entregas.estabelecimentos.uf', state);

    if (error) {
      console.error('Error fetching city neighborhoods:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!data) {
      return NextResponse.json({ neighborhoods: [] });
    }

    // Dedup and sort
    const uniqueNeighborhoods = Array.from(new Set(
      data.map((item: any) => item.nome_bairro)
    )).sort();

    return NextResponse.json({ neighborhoods: uniqueNeighborhoods });
  } catch (error: any) {
    console.error('Unexpected error in GET neighborhoods:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
