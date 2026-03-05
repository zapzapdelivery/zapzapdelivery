import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import { OrderStatus } from '@/types/orderStatus';

const isValidUuid = (value: any): value is string => {
  return value != null
    && typeof value === 'string'
    && value.trim() !== ''
    && /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim());
};

export async function POST(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }

    if (!ctx.role || (ctx.role !== 'admin' && ctx.role !== 'estabelecimento' && ctx.role !== 'atendente')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { id, status: newStatus } = body || {};

    const safeId = typeof id === 'string' ? id.trim() : '';
    if (!safeId || !newStatus) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }
    if (!isValidUuid(safeId)) {
      return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 });
    }

    if (newStatus === OrderStatus.CONFIRMADO) {
      const { data: existingMovements, error: movementError } = await supabaseAdmin
        .from('estoque_movimentacoes')
        .select('id')
        .eq('pedido_id', safeId)
        .eq('tipo_movimento', 'venda')
        .limit(1);

      if (movementError) {
        return NextResponse.json(
          { error: movementError.message || 'Erro ao verificar movimentações de estoque' },
          { status: 400 }
        );
      }

      if (!existingMovements || existingMovements.length === 0) {
        const { data: pedido, error: pedidoError } = await supabaseAdmin
          .from('pedidos')
          .select(
            `
              id,
              estabelecimento_id,
              status_pedido,
              numero_pedido,
              itens_pedidos (
                produto_id,
                quantidade
              )
            `
          )
          .eq('id', safeId)
          .single();

        if (pedidoError || !pedido) {
          return NextResponse.json(
            { error: pedidoError?.message || 'Pedido não encontrado' },
            { status: 400 }
          );
        }

        const items = (pedido.itens_pedidos || []) as { produto_id: string; quantidade: number }[];

        if (!Array.isArray(items) || items.length === 0) {
          return NextResponse.json(
            { error: 'Pedido sem itens para processar estoque' },
            { status: 400 }
          );
        }

        const aggregatedByProduct: Record<string, number> = {};
        for (const it of items) {
          const pid = typeof it?.produto_id === 'string' ? it.produto_id : null;
          const qty = Number(it?.quantidade) || 0;
          if (!pid || qty <= 0) continue;
          aggregatedByProduct[pid] = (aggregatedByProduct[pid] || 0) + qty;
        }

        const productIds = Object.keys(aggregatedByProduct);
        if (productIds.length === 0) {
          return NextResponse.json(
            { error: 'Itens do pedido inválidos para controle de estoque' },
            { status: 400 }
          );
        }

        const { data: stockRows, error: stockError } = await supabaseAdmin
          .from('estoque_produtos')
          .select('id, produto_id, estoque_atual')
          .eq('estabelecimento_id', pedido.estabelecimento_id)
          .in('produto_id', productIds);

        if (stockError) {
          return NextResponse.json(
            { error: stockError.message || 'Erro ao consultar estoque' },
            { status: 400 }
          );
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

        const updates = [];
        for (const pid of Object.keys(aggregatedByProduct)) {
          const row = stockMap.get(pid);
          if (!row) continue;
          const currentStock = Number(row.estoque_atual) || 0;
          const required = aggregatedByProduct[pid] || 0;
          const newStock = currentStock - required;
          updates.push(
            supabaseAdmin
              .from('estoque_produtos')
              .update({ estoque_atual: newStock })
              .eq('id', row.id)
          );
        }

        const updateResults = await Promise.all(updates);
        const updateError = updateResults.find((r: any) => r.error);
        if (updateError && updateError.error) {
          return NextResponse.json(
            { error: updateError.error.message || 'Erro ao atualizar estoque' },
            { status: 400 }
          );
        }

        const movements = Object.keys(aggregatedByProduct).map((pid) => ({
          estabelecimento_id: pedido.estabelecimento_id,
          pedido_id: pedido.id,
          produto_id: pid,
          quantidade: aggregatedByProduct[pid],
          tipo_movimento: 'venda',
          criado_em: new Date().toISOString(),
          motivo: `Venda vinculada ao pedido ${pedido.numero_pedido}`
        }));

        let { error: movementError } = await supabaseAdmin
          .from('estoque_movimentacoes')
          .insert(movements);

        if (movementError) {
          const msg = String(movementError.message || '');
          if (msg.includes('column') && msg.includes('motivo')) {
            const movementsWithoutMotivo = movements.map(({ motivo, ...rest }) => rest);
            const retry = await supabaseAdmin
              .from('estoque_movimentacoes')
              .insert(movementsWithoutMotivo);
            if (retry.error) {
              console.error(
                'Erro ao registrar movimentação de estoque (status, fallback):',
                retry.error
              );
            }
          } else {
            console.error('Erro ao registrar movimentação de estoque (status):', movementError);
          }
        }

        const resumoMovements = Object.keys(aggregatedByProduct).map((pid) => ({
          estabelecimento_id: pedido.estabelecimento_id,
          produto_id: pid,
          tipo_movimentacao: 'venda',
          quantidade: aggregatedByProduct[pid],
          motivo: `Pedido ${pedido.numero_pedido}`,
          criado_em: new Date().toISOString()
        }));

        const { error: resumoError } = await supabaseAdmin
          .from('movimentacoes_estoque')
          .insert(resumoMovements);

        if (resumoError) {
          console.error(
            'Erro ao registrar resumo em movimentacoes_estoque (status):',
            resumoError
          );
        }
      }
    } else if (
      newStatus === OrderStatus.PEDINDO || 
      newStatus === OrderStatus.CANCELADO_CLIENTE || 
      newStatus === OrderStatus.CANCELADO_ESTABELECIMENTO
    ) {
      // Check for existing 'venda' movements to reverse them
      const { data: existingMovements, error: movementError } = await supabaseAdmin
        .from('estoque_movimentacoes')
        .select('*')
        .eq('pedido_id', safeId)
        .eq('tipo_movimento', 'venda');

      if (!movementError && existingMovements && existingMovements.length > 0) {
        // Prepare to restore stock
        const aggregatedByProduct: Record<string, number> = {};
        const establishmentId = existingMovements[0].estabelecimento_id; // Assume all same establishment

        for (const mov of existingMovements) {
          const pid = mov.produto_id;
          const qty = Number(mov.quantidade) || 0;
          if (pid && qty > 0) {
            aggregatedByProduct[pid] = (aggregatedByProduct[pid] || 0) + qty;
          }
        }

        const productIds = Object.keys(aggregatedByProduct);
        if (productIds.length > 0) {
          // Fetch current stock
          const { data: stockRows } = await supabaseAdmin
            .from('estoque_produtos')
            .select('id, produto_id, estoque_atual')
            .eq('estabelecimento_id', establishmentId)
            .in('produto_id', productIds);
            
          const stockMap = new Map<string, any>(
            (stockRows || []).map((row: any) => [String(row.produto_id), row])
          );

          const updates = [];
          for (const pid of productIds) {
            const row = stockMap.get(pid);
            if (!row) continue;
            const currentStock = Number(row.estoque_atual) || 0;
            const toRestore = aggregatedByProduct[pid];
            const newStock = currentStock + toRestore;
            
            updates.push(
              supabaseAdmin
                .from('estoque_produtos')
                .update({ estoque_atual: newStock })
                .eq('id', row.id)
            );
          }
          
          await Promise.all(updates);

          // Log restoration in movimentacoes_estoque
          const resumoMovements = productIds.map((pid) => ({
            estabelecimento_id: establishmentId,
            produto_id: pid,
            tipo_movimentacao: 'devolucao',
            quantidade: aggregatedByProduct[pid],
            motivo: `Retorno ao status ${newStatus} (Estorno)`,
            criado_em: new Date().toISOString()
          }));

          await supabaseAdmin
            .from('movimentacoes_estoque')
            .insert(resumoMovements);

          // Delete the original 'venda' movements so they can be re-deducted if confirmed again
          const movementIds = existingMovements.map((m: any) => m.id);
          await supabaseAdmin
            .from('estoque_movimentacoes')
            .delete()
            .in('id', movementIds);
        }
      }
    }

    const { error: updateError } = await supabaseAdmin
      .from('pedidos')
      .update({ status_pedido: newStatus })
      .eq('id', safeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
