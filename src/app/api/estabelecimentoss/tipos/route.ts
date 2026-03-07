import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthContext } from '@/lib/server-auth';

async function listTipos() {
  const { data, error } = await supabaseAdmin!
    .from('tipo_estabelecimentos')
    .select('id, nome')
    .order('nome', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ id: row.id, nome: row.nome ?? '' }));
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const { error, status } = await getAuthContext(request);
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }
    const list = await listTipos();
    return NextResponse.json(list);
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
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
     const nome: string = body?.nome;
     if (!nome || !nome.trim()) {
       return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
     }
    const { data, error } = await supabaseAdmin
      .from('tipo_estabelecimentos')
      .insert([{ nome }])
      .select('id')
      .single();
    if (error) throw error;
    return NextResponse.json({ id: data.id, nome }, { status: 201 });
   } catch (err: any) {
     return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
   }
 }
