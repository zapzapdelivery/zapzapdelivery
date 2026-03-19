import { NextResponse } from 'next/server';
 import { supabaseAdmin } from '@/lib/supabase';
 import { getAuthContext } from '@/lib/server-auth';
 
 async function getTipo(id: string) {
  const trySelect = async (select: string) => {
    const { data, error } = await (supabaseAdmin! as any)
      .from('tipo_estabelecimentos')
      .select(select)
      .eq('id', id)
      .single();
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
  if (!res.data) {
    throw new Error('Not Found');
  }

  return {
    id: res.data.id,
    nome: res.data.nome ?? '',
    descricao: res.data.descricao ?? '',
    ativo: typeof res.data.ativo === 'boolean' ? res.data.ativo : undefined
  };
}
 
 export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
 
 const { role } = await getAuthContext(request);
 if (role === 'estabelecimento' || role === 'atendente') {
   return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
 }

  const params = await props.params;
  const { id } = params;
   try {
    const item = await getTipo(id);
    return NextResponse.json(item);
   } catch (err: any) {
     return NextResponse.json({ error: err.message || 'Not Found' }, { status: 404 });
   }
 }
 
 export async function PUT(
   request: Request,
   props: { params: Promise<{ id: string }> }
 ) {
   if (!supabaseAdmin) {
     return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
   }
  {
    const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
    const token = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
    if (token) {
      const { data: auth } = await supabaseAdmin.auth.getUser(token);
      const userId = auth?.user?.id;
      if (userId) {
        const { data: roles } = await supabaseAdmin
          .from('user_roles')
          .select('role')
          .eq('user_id', userId)
          .limit(1);
        const role = Array.isArray(roles) && roles.length > 0 ? (roles[0] as any).role : null;
        if (role === 'estabelecimento') {
          return NextResponse.json({ error: 'Acesso negado para estabelecimentos' }, { status: 403 });
        }
      }
    }
  }
   const params = await props.params;
   const { id } = params;
   try {
     const body = await request.json();
     const nome: string = body?.nome;
    const descricao: string | undefined = typeof body?.descricao === 'string' ? body.descricao : undefined;
    const ativo: boolean | undefined = typeof body?.ativo === 'boolean' ? body.ativo : undefined;
     if (!nome || !nome.trim()) {
       return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
     }

    const tryUpdate = async (payload: Record<string, any>) => {
      const { error } = await (supabaseAdmin as any)
        .from('tipo_estabelecimentos')
        .update(payload)
        .eq('id', id);
      return { error };
    };

    let payload: Record<string, any> = { nome: nome.trim() };
    if (typeof descricao === 'string') payload.descricao = descricao;
    if (typeof ativo === 'boolean') payload.ativo = ativo;

    let updated = await tryUpdate(payload);
    if (updated.error) {
      const msg = String(updated.error.message || '');
      if (msg.toLowerCase().includes('ativo')) {
        const fallback = { ...payload };
        delete fallback.ativo;
        updated = await tryUpdate(fallback);
      }
    }
    if (updated.error) {
      const msg = String(updated.error.message || '');
      if (msg.toLowerCase().includes('descricao')) {
        updated = await tryUpdate({ nome: nome.trim() });
      }
    }
    if (updated.error) throw updated.error;

    return NextResponse.json({ id, nome: nome.trim(), descricao: descricao ?? '', ativo });
   } catch (err: any) {
     return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
   }
 }
 
 export async function DELETE(
  request: Request,
   props: { params: Promise<{ id: string }> }
 ) {
   if (!supabaseAdmin) {
     return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
   }
  
  const { role } = await getAuthContext(request);
  if (role === 'estabelecimento' || role === 'atendente') {
    return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
  }

   const params = await props.params;
   const { id } = params;
   try {
    const { error } = await supabaseAdmin
      .from('tipo_estabelecimentos')
      .delete()
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
   } catch (err: any) {
     return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
   }
 }
