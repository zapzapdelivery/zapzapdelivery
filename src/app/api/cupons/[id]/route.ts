import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase Admin client not configured' },
      { status: 500 }
    );
  }

  try {
    const { role, establishmentId, isSuperAdmin, error, status } =
      await getAuthContext(request);

    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'parceiro')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'ID do cupom é obrigatório' }, { status: 400 });
    }

    let query = supabaseAdmin.from('cupons').select('*').eq('id', id);

    if (!isSuperAdmin && establishmentId) {
      query = query.eq('estabelecimento_id', establishmentId);
    }

    const { data, error: fetchError } = await query.maybeSingle();

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    if (!data) {
      return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao buscar cupom' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase Admin client not configured' },
      { status: 500 }
    );
  }

  try {
    const { role, establishmentId, isSuperAdmin, error, status } =
      await getAuthContext(request);

    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'parceiro')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'ID do cupom é obrigatório' }, { status: 400 });
    }

    let query = supabaseAdmin.from('cupons').delete().eq('id', id);

    if (!isSuperAdmin && establishmentId) {
      query = query.eq('estabelecimento_id', establishmentId);
    }

    const { error: deleteError } = await query;

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao excluir cupom' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase Admin client not configured' },
      { status: 500 }
    );
  }

  try {
    const { role, establishmentId, isSuperAdmin, error, status } =
      await getAuthContext(request);

    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'parceiro')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const id = params.id;
    if (!id) {
      return NextResponse.json({ error: 'ID do cupom é obrigatório' }, { status: 400 });
    }

    const body = await request.json();
    const {
      codigo_cupom,
      valor_desconto,
      // outros campos...
    } = body || {};

    if (!codigo_cupom || typeof codigo_cupom !== 'string') {
      return NextResponse.json(
        { error: 'Código do cupom é obrigatório' },
        { status: 400 }
      );
    }

    let numericValor: number | null = null;
    if (typeof valor_desconto === 'number') {
      numericValor = valor_desconto;
    } else if (typeof valor_desconto === 'string') {
      const parsed = parseFloat(valor_desconto);
      if (Number.isNaN(parsed)) {
        return NextResponse.json(
          { error: 'Valor de desconto inválido' },
          { status: 400 }
        );
      }
      numericValor = parsed;
    }

    if (numericValor == null) {
      return NextResponse.json(
        { error: 'Valor de desconto é obrigatório' },
        { status: 400 }
      );
    }

    // Verificar se existe e permissão
    let checkQuery = supabaseAdmin.from('cupons').select('estabelecimento_id').eq('id', id).maybeSingle();
    const { data: existing, error: existingError } = await checkQuery;

    if (existingError) {
        return NextResponse.json({ error: existingError.message }, { status: 400 });
    }
    if (!existing) {
        return NextResponse.json({ error: 'Cupom não encontrado' }, { status: 404 });
    }

    if (!isSuperAdmin && establishmentId && existing.estabelecimento_id !== establishmentId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Atualizar
    const updateData: Record<string, any> = {};
    
    // Validar e atribuir campos permitidos
    if (codigo_cupom) updateData.codigo_cupom = codigo_cupom;
    if (numericValor !== null) updateData.valor_desconto = numericValor;
    
    if (body.tipo_desconto !== undefined) updateData.tipo_desconto = body.tipo_desconto;
    if (body.limite_uso !== undefined) updateData.limite_uso = body.limite_uso;
    
    // Datas podem ser null, então verificamos se a chave existe no body
    if ('data_inicio' in body) updateData.data_inicio = body.data_inicio;
    if ('data_fim' in body) updateData.data_fim = body.data_fim;
    
    if (body.status_cupom !== undefined) updateData.status_cupom = body.status_cupom;
    
    // Apenas admins podem alterar o estabelecimento
    if ((isSuperAdmin || role === 'admin' || role === 'parceiro') && body.estabelecimento_id !== undefined) {
        updateData.estabelecimento_id = body.estabelecimento_id;
    }

    const { data: updated, error: updateError } = await supabaseAdmin
        .from('cupons')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

    if (updateError) {
        return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao atualizar cupom' },
      { status: 500 }
    );
  }
}
