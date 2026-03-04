import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { role } = await getAuthContext(request);
    if (role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { data, error } = await supabaseAdmin
      .from('planos')
      .select('*')
      .order('criado_em', { ascending: false });

    if (error) {
      console.error('Error fetching plans:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Unexpected error fetching plans:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { role } = await getAuthContext(request);
    if (role === 'estabelecimento' || role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
    }

    const body = await request.json();
    
    // Validate required fields
    if (!body.nome_plano || body.valor_mensal === undefined) {
      return NextResponse.json({ error: 'Nome e valor mensal são obrigatórios' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('planos')
      .insert([body])
      .select()
      .single();

    if (error) {
      console.error('Error creating plan:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Unexpected error creating plan:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
