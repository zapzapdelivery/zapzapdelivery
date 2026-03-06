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
      const { processStockDeduction } = await import('@/services/stockService');
      const result = await processStockDeduction(safeId);
      
      if (!result.success) {
        return NextResponse.json(
          { error: result.error || 'Erro ao processar estoque' },
          { status: 400 }
        );
      }
    } else if (
      newStatus === OrderStatus.PEDINDO || 
      newStatus === OrderStatus.CANCELADO_CLIENTE || 
      newStatus === OrderStatus.CANCELADO_ESTABELECIMENTO
    ) {
      // Use centralized stock return logic
      try {
          const { processStockReturn } = await import('@/services/stockService');
          const reason = `Retorno ao status ${newStatus}`;
          const stockResult = await processStockReturn(safeId, reason);
          
          if (!stockResult.success) {
               console.error(`[Status Update] Falha ao retornar estoque para pedido ${safeId}: ${stockResult.error}`);
               // Should we abort status update? Probably not, but maybe warn.
               // For now, we log and proceed, or we could return error.
               // Returning error might prevent status change which is safer for consistency.
               return NextResponse.json({ error: `Erro ao retornar estoque: ${stockResult.error}` }, { status: 400 });
          } else {
               console.log(`[Status Update] Estoque retornado com sucesso para pedido ${safeId}`);
          }
      } catch (stockErr) {
          console.error(`[Status Update] Erro fatal ao chamar serviço de estoque (retorno):`, stockErr);
          return NextResponse.json({ error: 'Erro interno ao processar estoque' }, { status: 500 });
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
