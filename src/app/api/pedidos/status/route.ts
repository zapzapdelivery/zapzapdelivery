import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import { OrderStatus } from '@/types/orderStatus';
import { sendOrderStatusWebhook } from '@/app/api/webhooks/notificaclientestatusdopedido/route';

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

    let prevQuery = supabaseAdmin
      .from('pedidos')
      .select('id, status_pedido, estabelecimento_id')
      .eq('id', safeId);

    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      prevQuery = prevQuery.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { data: prevRow, error: prevError } = await prevQuery.maybeSingle();
    if (prevError) {
      return NextResponse.json({ error: prevError.message }, { status: 400 });
    }
    if (!prevRow) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    const previousStatus = String((prevRow as any).status_pedido || '');
    if (previousStatus === String(newStatus)) {
      return NextResponse.json({ ok: true, skipped: true });
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

    let updateQuery = supabaseAdmin
      .from('pedidos')
      .update({ status_pedido: newStatus })
      .eq('id', safeId);

    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      updateQuery = updateQuery.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    const webhookResult = await sendOrderStatusWebhook({
      orderId: safeId,
      newStatus: String(newStatus),
      previousStatus,
      establishmentId: ctx.establishmentId,
      isSuperAdmin: ctx.isSuperAdmin
    });

    return NextResponse.json({ ok: true, webhook: webhookResult });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
