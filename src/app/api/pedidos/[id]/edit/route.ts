import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

const isValidUuid = (value: any): value is string => {
  return value != null
    && typeof value === 'string'
    && value.trim() !== ''
    && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
};

export async function POST(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { error, status, role, establishmentId, isSuperAdmin } = await getAuthContext(request);
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

    const body = await request.json().catch(() => ({}));
    const { status_pedido, forma_pagamento, observacao_cliente } = body || {};

    const fields: Record<string, any> = {};
    if (status_pedido) fields.status_pedido = status_pedido;
    if (forma_pagamento) fields.forma_pagamento = forma_pagamento;
    if (typeof observacao_cliente === 'string') fields.observacao_cliente = observacao_cliente;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json({ error: 'Nada para atualizar' }, { status: 400 });
    }

    if (!isSuperAdmin && establishmentId) {
      const { data: orderRow } = await supabaseAdmin
        .from('pedidos')
        .select('id, estabelecimento_id')
        .eq('id', id)
        .maybeSingle();

      if (orderRow && orderRow.estabelecimento_id && orderRow.estabelecimento_id !== establishmentId && role !== 'admin') {
        return NextResponse.json({ error: 'Acesso negado ao pedido' }, { status: 403 });
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('pedidos')
      .update(fields)
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
