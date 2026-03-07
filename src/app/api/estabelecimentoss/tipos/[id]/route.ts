import { NextResponse } from 'next/server';
 import { supabaseAdmin } from '@/lib/supabase';
 import { getAuthContext } from '@/lib/server-auth';
 
 async function getTipo(id: string) {
  const { data, error } = await supabaseAdmin!
    .from('tipo_estabelecimentos')
    .select('id, nome')
    .eq('id', id)
    .single();
  if (error) throw error;
  return { id: data.id, nome: data.nome ?? '' };
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
     if (!nome || !nome.trim()) {
       return NextResponse.json({ error: 'Nome é obrigatório' }, { status: 400 });
     }
    const { error } = await supabaseAdmin
      .from('tipo_estabelecimentos')
      .update({ nome })
      .eq('id', id);
    if (error) throw error;
    return NextResponse.json({ id, nome });
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
