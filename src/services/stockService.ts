
import { supabaseAdmin } from '@/lib/server-auth';

export async function processStockDeduction(orderId: string, options?: { force?: boolean }): Promise<{ success: boolean; error?: string }> {
  try {
    // 1. Verificação de idempotência: Se já existe movimentação de venda ou saída para este pedido, ignora
    // A menos que force=true (usado em reativação para garantir baixa)
    if (!options?.force) {
      const { data: existingMovements, error: movementError } = await supabaseAdmin
        .from('estoque_movimentacoes')
        .select('id')
        .eq('pedido_id', orderId)
        .in('tipo_movimento', ['venda', 'saida'])
        .limit(1);

      if (movementError) {
        return { success: false, error: movementError.message || 'Erro ao verificar movimentações de estoque' };
      }

      if (existingMovements && existingMovements.length > 0) {
        // Já processado, retorna sucesso para não travar o fluxo
        return { success: true };
      }
    } else {
      // Se force=true, removemos quaisquer movimentações anteriores para garantir estado limpo
      // Isso é útil se o estado ficou inconsistente (ex: tabela técnica diz que tem, mas histórico ou saldo real não refletiu)
      await supabaseAdmin
        .from('estoque_movimentacoes')
        .delete()
        .eq('pedido_id', orderId)
        .in('tipo_movimento', ['venda', 'saida']);
    }

    // 2. Buscar dados do pedido e itens
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
      .eq('id', orderId)
      .single();

    if (pedidoError || !pedido) {
      return { success: false, error: pedidoError?.message || 'Pedido não encontrado' };
    }

    const items = (pedido.itens_pedidos || []) as { produto_id: string; quantidade: number }[];

    if (!Array.isArray(items) || items.length === 0) {
      // Pedido sem itens (pode ser erro ou apenas taxa de entrega/serviço?)
      // Retorna sucesso pois não há estoque a deduzir
      return { success: true };
    }

    // 3. Agregar quantidade por produto
    const aggregatedByProduct: Record<string, number> = {};
    for (const it of items) {
      const pid = typeof it?.produto_id === 'string' ? it.produto_id : null;
      const qty = Number(it?.quantidade) || 0;
      if (!pid || qty <= 0) continue;
      aggregatedByProduct[pid] = (aggregatedByProduct[pid] || 0) + qty;
    }

    const productIds = Object.keys(aggregatedByProduct);
    if (productIds.length === 0) {
      return { success: true };
    }

    // 4. Buscar estoque atual
    const { data: stockRows, error: stockError } = await supabaseAdmin
      .from('estoque_produtos')
      .select('id, produto_id, estoque_atual')
      .eq('estabelecimento_id', pedido.estabelecimento_id)
      .in('produto_id', productIds);

    if (stockError) {
      return { success: false, error: stockError.message || 'Erro ao consultar estoque' };
    }

    const stockMap = new Map<string, any>(
      (stockRows || []).map((row: any) => [String(row.produto_id), row])
    );

    // 5. Validar disponibilidade (Opcional: Se quiser bloquear venda sem estoque. 
    // Mas como o pedido já foi pago/feito, talvez devêssemos permitir negativo ou apenas logar erro?
    // O código original bloqueava (retornava erro 400). Vamos manter o bloqueio/erro.)
    const insufficients: { produto_id: string; required: number; available: number }[] = [];

    for (const pid of productIds) {
      const required = aggregatedByProduct[pid] || 0;
      const row = stockMap.get(pid);
      const available = row ? Number(row.estoque_atual) || 0 : 0;
      // Se não existir registro de estoque, assume 0
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

      return { success: false, error: message };
    }

    // 6. Atualizar estoque (Dedução)
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
      return { success: false, error: updateError.error.message || 'Erro ao atualizar estoque' };
    }

    // 7. Registrar Movimentação
    const movements = Object.keys(aggregatedByProduct).map((pid) => ({
      estabelecimento_id: pedido.estabelecimento_id,
      pedido_id: pedido.id,
      produto_id: pid,
      quantidade: aggregatedByProduct[pid],
      tipo_movimento: 'venda',
      criado_em: new Date().toISOString(),
      motivo: `Pedido ${pedido.numero_pedido}`
    }));

    let { error: insertError } = await supabaseAdmin
      .from('estoque_movimentacoes')
      .insert(movements);

    if (insertError) {
      const msg = String(insertError.message || '');
      // Fallback para erro de coluna 'motivo' se não existir (compatibilidade)
      if (msg.includes('column') && msg.includes('motivo')) {
        const movementsWithoutMotivo = movements.map(({ motivo, ...rest }) => rest);
        const retry = await supabaseAdmin
          .from('estoque_movimentacoes')
          .insert(movementsWithoutMotivo);
        if (retry.error) {
          console.error('Erro ao registrar movimentação de estoque (fallback):', retry.error);
           // Não retorna erro fatal pois o estoque já foi deduzido
        }
      } else {
        console.error('Erro ao registrar movimentação de estoque:', insertError);
        // Não retorna erro fatal pois o estoque já foi deduzido
      }
    }

    // 8. Registrar também na tabela de movimentacoes_estoque (usada na UI de admin)
    // A tabela anterior (estoque_movimentacoes) parece ser interna/técnica
    // A tabela movimentacoes_estoque parece ser a visualizada pelo usuário
    const resumoMovements = Object.keys(aggregatedByProduct).map((pid) => ({
      estabelecimento_id: pedido.estabelecimento_id,
      produto_id: pid,
      tipo_movimentacao: 'venda', // ou 'SAÍDA', verificar enum/check constraint
      quantidade: aggregatedByProduct[pid],
      motivo: `Pedido ${pedido.numero_pedido}`,
      criado_em: new Date().toISOString()
    }));

    // Tentar inserir com tipo 'venda'
    let { error: resumoError } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .insert(resumoMovements);

    // Se der erro de constraint no tipo_movimentacao, tentar 'SAÍDA'
    if (resumoError && resumoError.message.includes('check constraint')) {
        const movementsSaida = resumoMovements.map(m => ({ ...m, tipo_movimentacao: 'SAÍDA' }));
        const retryResumo = await supabaseAdmin
            .from('movimentacoes_estoque')
            .insert(movementsSaida);
            
        if (retryResumo.error) {
             console.error('Erro ao registrar resumo em movimentacoes_estoque (fallback SAÍDA):', retryResumo.error);
        }
    } else if (resumoError) {
       console.error('Erro ao registrar resumo em movimentacoes_estoque:', resumoError);
    }

    return { success: true };

  } catch (error: any) {
    console.error('Erro interno ao processar estoque:', error);
    return { success: false, error: error.message || 'Erro interno ao processar estoque' };
  }
}

export async function processStockReturn(orderId: string, reason: string): Promise<{ success: boolean; error?: string }> {
  try {
    console.log(`[StockService] Iniciando retorno de estoque para pedido ${orderId} (Motivo: ${reason})`);
    
    // 1. Atomically fetch and delete movements to ensure single processor
    // This prevents race conditions where multiple processes try to return stock simultaneously
    const { data: deletedMovements, error: deleteError } = await supabaseAdmin
      .from('estoque_movimentacoes')
      .delete()
      .eq('pedido_id', orderId)
      .in('tipo_movimento', ['venda', 'saida'])
      .select();

    if (deleteError) {
      console.error(`[StockService] Erro ao deletar movimentos para pedido ${orderId}:`, deleteError);
      return { success: false, error: deleteError.message || 'Erro ao processar devolução de estoque' };
    }

    if (!deletedMovements || deletedMovements.length === 0) {
      console.warn(`[StockService] Nenhum movimento encontrado para deletar/retornar para pedido ${orderId}. Pode já ter sido processado.`);
      // Nothing to return (already returned or never deducted)
      return { success: true };
    }

    console.log(`[StockService] Movimentos deletados para retorno: ${deletedMovements.length}`);

    // Use the deleted movements for processing
    const existingMovements = deletedMovements;

    // 2. Prepare to restore stock
    const aggregatedByProduct: Record<string, number> = {};
    const establishmentId = existingMovements[0].estabelecimento_id;

    for (const mov of existingMovements) {
      const pid = mov.produto_id;
      const qty = Number(mov.quantidade) || 0;
      if (pid && qty > 0) {
        aggregatedByProduct[pid] = (aggregatedByProduct[pid] || 0) + qty;
      }
    }

    const productIds = Object.keys(aggregatedByProduct);
    if (productIds.length === 0) {
      return { success: true };
    }

    // 3. Fetch current stock and order number
    const { data: orderData } = await supabaseAdmin
      .from('pedidos')
      .select('numero_pedido')
      .eq('id', orderId)
      .single();

    const numeroPedido = orderData?.numero_pedido || 'N/A';

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

    // 4. Log restoration in movimentacoes_estoque (Admin UI)
    const resumoMovements = productIds.map((pid) => ({
      estabelecimento_id: establishmentId,
      produto_id: pid,
      tipo_movimentacao: 'entrada',
      quantidade: aggregatedByProduct[pid],
      motivo: `Devolução Pedido ${numeroPedido}: ${reason}`,
      criado_em: new Date().toISOString()
    }));

    const { error: resumoError } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .insert(resumoMovements);

    if (resumoError && resumoError.message.includes('check constraint')) {
        // Fallback to uppercase if lowercase fails
        const movementsEntrada = resumoMovements.map(m => ({ ...m, tipo_movimentacao: 'ENTRADA' }));
        await supabaseAdmin
            .from('movimentacoes_estoque')
            .insert(movementsEntrada);
    } else if (resumoError) {
        console.error('Erro ao registrar resumo em movimentacoes_estoque (retorno):', resumoError);
    }

    return { success: true };

  } catch (error: any) {
    console.error('Erro interno ao processar retorno de estoque:', error);
    return { success: false, error: error.message || 'Erro interno ao processar retorno de estoque' };
  }
}
