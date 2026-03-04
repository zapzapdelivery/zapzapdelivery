import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    // Permitir apenas admin/estabelecimento/super admin
    const allowed = ctx.role === 'admin' || ctx.role === 'estabelecimento' || ctx.isSuperAdmin;
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    let query = supabaseAdmin
      .from('categorias')
      .select('id, nome_categoria, estabelecimento_id, status_categoria')
      .order('nome_categoria', { ascending: true });

    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      query = query.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data || []);
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
