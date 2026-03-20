import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    const allowed = ctx.role === 'admin' || ctx.role === 'estabelecimento' || ctx.isSuperAdmin;
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    let query = (supabaseAdmin as any).from('categorias').select('*').eq('id', id);

    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      query = query.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { data, error } = await query.single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 200 });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    const allowed = ctx.role === 'admin' || ctx.role === 'estabelecimento' || ctx.isSuperAdmin;
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));

    const nome = String(body?.nome_categoria || '').trim();
    if (!nome) {
      return NextResponse.json({ error: 'Nome da categoria é obrigatório' }, { status: 400 });
    }

    const estabFromBody = typeof body?.estabelecimento_id === 'string' ? body.estabelecimento_id : null;
    const estabelecimento_id = ctx.isSuperAdmin ? (estabFromBody ?? ctx.establishmentId) : ctx.establishmentId;

    if (!estabelecimento_id && !ctx.isSuperAdmin) {
      return NextResponse.json({ error: 'Estabelecimento não identificado' }, { status: 400 });
    }

    const payload: Record<string, any> = {
      nome_categoria: nome,
      descricao: typeof body?.descricao === 'string' ? body.descricao : '',
      status_categoria: String(body?.status_categoria || 'ativo') === 'inativo' ? 'inativo' : 'ativo',
      imagem_categoria_url: typeof body?.imagem_categoria_url === 'string' && body.imagem_categoria_url.trim()
        ? body.imagem_categoria_url.trim()
        : null,
      ordem_exibicao: Number.isFinite(Number(body?.ordem_exibicao)) ? Number(body.ordem_exibicao) : 0
    };

    if (ctx.isSuperAdmin && estabelecimento_id) {
      payload.estabelecimento_id = estabelecimento_id;
    }

    let query = (supabaseAdmin as any).from('categorias').update(payload).eq('id', id);
    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      query = query.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    const allowed = ctx.role === 'admin' || ctx.role === 'estabelecimento' || ctx.isSuperAdmin;
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const { id } = await context.params;
    let query = (supabaseAdmin as any).from('categorias').delete().eq('id', id);
    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      query = query.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

