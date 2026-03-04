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
      .from('tipos_usuarios')
      .select('*')
      .order('nome_tipo_usuario', { ascending: true });

    if (error) {
      console.error('Error fetching user types:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error in GET /api/usuarios/tipos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { role } = await getAuthContext(request);
    if (role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json();
    const { nome_tipo_usuario, descricao } = body;

    if (!nome_tipo_usuario) {
      return NextResponse.json({ error: 'O nome do tipo de usuário é obrigatório' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('tipos_usuarios')
      .insert([{
        nome_tipo_usuario,
        descricao
      }])
      .select()
      .single();

    if (error) {
      console.error('Error creating user type:', error);
      // Check for unique constraint violation
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Já existe um tipo de usuário com este nome.' }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Unexpected error in POST /api/usuarios/tipos:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
