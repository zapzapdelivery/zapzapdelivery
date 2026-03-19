import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAuthContext } from '@/lib/server-auth';

async function listTipos() {
  const trySelect = async (select: string) => {
    const { data, error } = await (supabaseAdmin! as any)
      .from('tipo_estabelecimentos')
      .select(select)
      .order('nome', { ascending: true });
    return { data, error };
  };

  let res = await trySelect('id, nome, descricao, ativo');
  if (res.error) {
    res = await trySelect('id, nome, descricao');
  }
  if (res.error) {
    res = await trySelect('id, nome');
  }
  if (res.error) throw res.error;

  return (res.data ?? []).map((row: any) => ({
    id: row.id,
    nome: row.nome ?? '',
    descricao: row.descricao ?? '',
    ativo: typeof row.ativo === 'boolean' ? row.ativo : undefined
  }));
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
    const descricao: string | undefined = typeof body?.descricao === 'string' ? body.descricao : undefined;
    const ativo: boolean | undefined = typeof body?.ativo === 'boolean' ? body.ativo : undefined;
     if (!nome || !nome.trim()) {
       return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
     }

    const tryInsert = async (payload: Record<string, any>) => {
      const { data, error } = await (supabaseAdmin as any)
        .from('tipo_estabelecimentos')
        .insert([payload])
        .select('id, nome, descricao, ativo')
        .single();
      return { data, error };
    };

    let payload: Record<string, any> = { nome: nome.trim() };
    if (typeof descricao === 'string') payload.descricao = descricao;
    if (typeof ativo === 'boolean') payload.ativo = ativo;

    let inserted = await tryInsert(payload);
    if (inserted.error) {
      const msg = String(inserted.error.message || '');
      if (msg.toLowerCase().includes('ativo')) {
        const fallback = { ...payload };
        delete fallback.ativo;
        inserted = await tryInsert(fallback);
      }
    }
    if (inserted.error) {
      const msg = String(inserted.error.message || '');
      if (msg.toLowerCase().includes('descricao')) {
        inserted = await tryInsert({ nome: nome.trim() });
      }
    }
    if (inserted.error) throw inserted.error;

    return NextResponse.json(
      {
        id: inserted.data.id,
        nome: inserted.data.nome ?? nome.trim(),
        descricao: inserted.data.descricao ?? descricao ?? '',
        ativo: typeof inserted.data.ativo === 'boolean' ? inserted.data.ativo : ativo
      },
      { status: 201 }
    );
   } catch (err: any) {
     return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
   }
 }
