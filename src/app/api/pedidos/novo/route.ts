import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import { OrderStatus } from '@/types/orderStatus';

function formatCurrency(n: any) {
  const v = Number(n);
  return isFinite(v) ? v : 0;
}

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  let tries = 0;
  while (tries < 20) {
    const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
    const number = `${year}${random}`;
    const { data, error } = await supabaseAdmin
      .from('pedidos')
      .select('id')
      .eq('numero_pedido', number)
      .maybeSingle();
    if (error) throw new Error('Erro ao verificar unicidade do número do pedido');
    if (!data) return number;
    tries++;
  }
  throw new Error('Falha ao gerar número de pedido único');
}

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    const allowed = ctx.role === 'admin' || ctx.role === 'estabelecimento' || ctx.isSuperAdmin;
    if (!allowed) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      estabelecimento_id,
      cliente_id,
      forma_pagamento,
      forma_entrega,
      observacao_cliente,
      subtotal,
      taxa_entrega,
      desconto,
      total,
      items
    } = body || {};

    if (!estabelecimento_id || !cliente_id || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }

    // Se não for super admin, garantir que está operando no próprio estabelecimento
    if (!ctx.isSuperAdmin && ctx.establishmentId && ctx.establishmentId !== estabelecimento_id) {
      return NextResponse.json({ error: 'Estabelecimento inválido' }, { status: 403 });
    }

    const numero_pedido = await generateOrderNumber();

    const aggregatedByProduct: Record<string, number> = {};
    for (const it of items as any[]) {
      const pid = typeof it?.produto_id === 'string' ? it.produto_id : null;
      const qty = Number(it?.quantidade) || 0;
      if (!pid || qty <= 0) continue;
      aggregatedByProduct[pid] = (aggregatedByProduct[pid] || 0) + qty;
    }

    const productIds = Object.keys(aggregatedByProduct);
    if (productIds.length === 0) {
      return NextResponse.json({ error: 'Itens do pedido inválidos' }, { status: 400 });
    }

    const { data: stockRows, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('id, produto_id, estoque_atual')
      .eq('estabelecimento_id', estabelecimento_id)
      .in('produto_id', productIds);

    if (stockError) {
      return NextResponse.json({ error: stockError.message || 'Erro ao consultar estoque' }, { status: 400 });
    }

    const stockMap = new Map<string, any>(
      (stockRows || []).map((row: any) => [String(row.produto_id), row])
    );

    const insufficients: { produto_id: string; required: number; available: number }[] = [];

    for (const pid of productIds) {
      const required = aggregatedByProduct[pid] || 0;
      const row = stockMap.get(pid);
      const available = row ? Number(row.estoque_atual) || 0 : 0;
      if (!row || available < required) {
        insufficients.push({ produto_id: pid, required, available });
      }
    }

    if (insufficients.length > 0) {
      const idsWithIssue = insufficients.map(i => i.produto_id);
      const { data: products } = await supabaseAdmin
        .from('produtos')
        .select('id, nome_produto')
        .in('id', idsWithIssue);

      const nameMap = new Map<string, string>(
        (products || []).map((p: any) => [String(p.id), String(p.nome_produto || '')])
      );

      const first = insufficients[0];
      const name = nameMap.get(first.produto_id) || first.produto_id;
      const message = `Estoque insuficiente para o produto "${name}". Solicitado: ${first.required}, disponível: ${first.available}.`;

      return NextResponse.json({ error: message }, { status: 400 });
    }

    const orderPayload = {
      estabelecimento_id,
      cliente_id,
      numero_pedido,
      status_pedido: OrderStatus.CONFIRMADO,
      subtotal: formatCurrency(subtotal),
      taxa_entrega: formatCurrency(taxa_entrega),
      desconto: formatCurrency(desconto),
      total_pedido: formatCurrency(total),
      forma_pagamento,
      forma_entrega,
      observacao_cliente: observacao_cliente || '',
      criado_em: new Date().toISOString()
    };

    const { data: orderData, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .insert(orderPayload)
      .select()
      .single();

    if (orderError || !orderData) {
      return NextResponse.json({ error: orderError?.message || 'Erro ao criar pedido' }, { status: 400 });
    }

    const itemsToInsert = items.map((it: any) => ({
      pedido_id: orderData.id,
      produto_id: it.produto_id,
      quantidade: Number(it.quantidade),
      valor_unitario: Number(it.valor_unitario),
      total_item: Number(it.quantidade) * Number(it.valor_unitario),
      estabelecimento_id,
      numero_pedido
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('itens_pedidos')
      .insert(itemsToInsert);

    if (itemsError) {
      // Rollback best-effort
      await supabaseAdmin.from('pedidos').delete().eq('id', orderData.id);
      return NextResponse.json({ error: itemsError.message || 'Erro ao inserir itens' }, { status: 400 });
    }

    // A atualização de estoque agora é feita automaticamente via Trigger no banco de dados (handle_new_order_item_stock)
    // Mantemos apenas a validação inicial de estoque (linhas 55-86) para garantir que o pedido não seja criado se não houver estoque.

    return NextResponse.json({ ok: true, pedido: orderData });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
