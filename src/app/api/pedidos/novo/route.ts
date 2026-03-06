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

    // 3. Deduct Stock (Optimistic Locking)
    const deductedItems: { produto_id: string; quantidade: number }[] = [];
    
    // Process each product sequentially to avoid deadlocks
    for (const pid of productIds) {
      const required = aggregatedByProduct[pid] || 0;
      
      // Get fresh stock data
      const { data: stockData, error: stockCheckError } = await supabaseAdmin
        .from('estoque_produtos')
        .select('id, estoque_atual')
        .eq('estabelecimento_id', estabelecimento_id)
        .eq('produto_id', pid)
        .single();
        
      if (stockCheckError) {
         if (stockCheckError.code === 'PGRST116') {
             // Product not found in stock table, skip deduction (assume unlimited or not tracked)
             continue;
         }
         throw new Error(`Erro ao verificar estoque do produto ${pid}`);
      }

      if (stockData) {
        if (stockData.estoque_atual < required) {
           // Rollback previous deductions
           for (const deducted of deductedItems) {
             // Best effort rollback
             const { data: curr } = await supabaseAdmin.from('estoque_produtos').select('estoque_atual').eq('produto_id', deducted.produto_id).single();
             if (curr) {
                await supabaseAdmin.from('estoque_produtos').update({ estoque_atual: curr.estoque_atual + deducted.quantidade }).eq('produto_id', deducted.produto_id);
             }
           }
           
           // Fetch product name for error message
           const { data: prod } = await supabaseAdmin.from('produtos').select('nome_produto').eq('id', pid).single();
           const name = prod?.nome_produto || 'Produto desconhecido';
           return NextResponse.json({ error: `Estoque insuficiente para "${name}". Disponível: ${stockData.estoque_atual}, Solicitado: ${required}` }, { status: 400 });
        }

        // Deduct
        const { error: updateError, data: updatedData } = await supabaseAdmin
          .from('estoque_produtos')
          .update({ estoque_atual: stockData.estoque_atual - required })
          .eq('produto_id', pid)
          .eq('estoque_atual', stockData.estoque_atual) // Optimistic lock
          .select()
          .single();
          
        if (updateError || !updatedData) {
           // Concurrency issue
           for (const deducted of deductedItems) {
             const { data: curr } = await supabaseAdmin.from('estoque_produtos').select('estoque_atual').eq('produto_id', deducted.produto_id).single();
             if (curr) {
                await supabaseAdmin.from('estoque_produtos').update({ estoque_atual: curr.estoque_atual + deducted.quantidade }).eq('produto_id', deducted.produto_id);
             }
           }
           return NextResponse.json({ error: `O estoque mudou durante a operação. Tente novamente.` }, { status: 409 });
        }
        
        deductedItems.push({ produto_id: pid, quantidade: required });
      }
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
      // Rollback stock
      for (const deducted of deductedItems) {
          const { data: curr } = await supabaseAdmin.from('estoque_produtos').select('estoque_atual').eq('produto_id', deducted.produto_id).single();
          if (curr) {
            await supabaseAdmin.from('estoque_produtos').update({ estoque_atual: curr.estoque_atual + deducted.quantidade }).eq('produto_id', deducted.produto_id);
          }
      }
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
      
      // Rollback stock
      for (const deducted of deductedItems) {
          const { data: curr } = await supabaseAdmin.from('estoque_produtos').select('estoque_atual').eq('produto_id', deducted.produto_id).single();
          if (curr) {
            await supabaseAdmin.from('estoque_produtos').update({ estoque_atual: curr.estoque_atual + deducted.quantidade }).eq('produto_id', deducted.produto_id);
          }
      }
      return NextResponse.json({ error: itemsError.message || 'Erro ao inserir itens' }, { status: 400 });
    }

    // 6. Register Stock Movement
    const now = new Date().toISOString();
    const motivo = `Pedido PDV ${numero_pedido}`;

    // A. Internal Tracking (estoque_movimentacoes)
    const internalMovements = deductedItems.map(item => ({
      estabelecimento_id,
      pedido_id: orderData.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      tipo_movimento: 'venda',
      motivo,
      criado_em: now
    }));

    const { error: internalError } = await supabaseAdmin
      .from('estoque_movimentacoes')
      .insert(internalMovements);
    
    if (internalError) {
      console.error('Error registering internal stock movements:', internalError);
    }

    // B. UI Display (movimentacoes_estoque)
    const uiMovements = deductedItems.map(item => ({
      estabelecimento_id,
      produto_id: item.produto_id,
      tipo_movimentacao: 'saida',
      quantidade: item.quantidade,
      motivo,
      criado_em: now
    }));

    const { error: uiError } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .insert(uiMovements);
      
    if (uiError) {
      console.error('Error registering UI stock movements:', uiError);
    }

    return NextResponse.json({ ok: true, pedido: orderData });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
