import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import { OrderStatus } from '@/types/orderStatus';

const isValidUuid = (value: any): value is string => {
  return value != null 
    && typeof value === 'string'
    && value.trim() !== ''
    && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
};

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { error, status, role, isSuperAdmin, establishmentId } = await getAuthContext(request);
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'atendente')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const rawId = params.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 });
    }

    let query = supabaseAdmin
      .from('pedidos')
      .select(`
            id, numero_pedido, criado_em, forma_pagamento, forma_entrega, subtotal, taxa_entrega, desconto, total_pedido, status_pedido, observacao_cliente, estabelecimento_id, entregador_id,
            clientes:cliente_id (
              id, nome_cliente, telefone, imagem_cliente_url,
              enderecos_clientes (
                endereco, numero, bairro, cidade, uf, cep, complemento
              )
            ),
            entregadores:entregador_id (
              id, nome_entregador, telefone, veiculo, imagem_entregador_url
            ),
            itens_pedidos (
              id, quantidade, valor_unitario, total_item, observacao_item,
              produtos (
                id, nome_produto, imagem_produto_url, valor_base
              )
            )
          `)
      .eq('id', id);

    if (!isSuperAdmin && establishmentId) {
      query = query.eq('estabelecimento_id', establishmentId);
    }

    const { data, error: fetchError } = await query.maybeSingle();
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Fetch audit logs for timeline
    const { data: logs } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('record_id', id)
      .eq('table_name', 'pedidos')
      .order('created_at', { ascending: true });

    return NextResponse.json({
      ...data,
      timeline: logs || []
    });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    const { role, isSuperAdmin, establishmentId } = ctx;
    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'atendente')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const rawId = params.id;
    const id = typeof rawId === 'string' ? rawId.trim() : '';
    if (!isValidUuid(id)) {
      return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 });
    }

    if (role === 'atendente') {
      let statusQuery = supabaseAdmin
        .from('pedidos')
        .select('id, status_pedido, estabelecimento_id')
        .eq('id', id);

      if (!isSuperAdmin && establishmentId) {
        statusQuery = statusQuery.eq('estabelecimento_id', establishmentId);
      }

      const { data: pedidoRow, error: pedidoErr } = await statusQuery.maybeSingle();
      if (pedidoErr) {
        return NextResponse.json({ error: pedidoErr.message }, { status: 400 });
      }
      if (!pedidoRow) {
        return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
      }
      if ((pedidoRow as any).status_pedido === OrderStatus.ENTREGUE) {
        return NextResponse.json(
          { error: 'Pedido entregue não pode ser alterado por atendente' },
          { status: 403 }
        );
      }
    }

    const body = await request.json().catch(() => ({}));
    const {
      status_pedido,
      entregador_id,
      observacao_cliente
    } = body;

    const updateData: any = {};
    if (status_pedido !== undefined) updateData.status_pedido = status_pedido;
    if (entregador_id !== undefined) updateData.entregador_id = entregador_id;
    if (observacao_cliente !== undefined) updateData.observacao_cliente = observacao_cliente;

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: 'Nada a atualizar' });
    }

    let query = supabaseAdmin
      .from('pedidos')
      .update(updateData)
      .eq('id', id);

    if (!isSuperAdmin && establishmentId) {
      query = query.eq('estabelecimento_id', establishmentId);
    }

    const { data, error } = await query.select().single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  return PATCH(request, { params: Promise.resolve(params) });
}
