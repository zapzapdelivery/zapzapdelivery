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

async function sendReadyPush(opts: { establishmentId: string; orderId: string; orderNumber?: string | null }) {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:suporte@zapzapdelivery.com.br';

  if (!publicKey || !privateKey) return { ok: false, skipped: true, reason: 'missing_vapid' };

  const { data: rows, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .eq('estabelecimento_id', opts.establishmentId)
    .in('role', ['entregador', 'admin']);

  if (error) return { ok: false, error: error.message };
  const subs = Array.isArray(rows) ? rows : [];
  if (subs.length === 0) return { ok: true, sent: 0 };

  const mod = await import('web-push');
  const webpush: any = (mod as any).default || mod;
  webpush.setVapidDetails(subject, publicKey, privateKey);

  const orderLabel = opts.orderNumber ? `#${opts.orderNumber}` : `#${opts.orderId.slice(0, 8)}`;
  const payload = JSON.stringify({
    title: 'Pedido pronto',
    body: `Pedido ${orderLabel} está pronto.`,
    url: '/painelentregador',
    tag: `pedido-pronto-${opts.orderId}`,
    orderId: opts.orderId
  });

  let sent = 0;
  for (const row of subs) {
    const endpoint = String((row as any)?.endpoint || '').trim();
    const p256dh = String((row as any)?.p256dh || '').trim();
    const auth = String((row as any)?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) continue;

    const subscription = { endpoint, keys: { p256dh, auth } };
    try {
      await webpush.sendNotification(subscription, payload);
      sent += 1;
    } catch (err: any) {
      const statusCode = Number(err?.statusCode || err?.status || 0);
      if (statusCode === 404 || statusCode === 410) {
        await supabaseAdmin.from('push_subscriptions').delete().eq('endpoint', endpoint);
      }
    }
  }

  return { ok: true, sent };
}

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
    const { id, status: newStatus, entregador_id } = body || {};

    const safeId = typeof id === 'string' ? id.trim() : '';
    if (!safeId || !newStatus) {
      return NextResponse.json({ error: 'Parâmetros inválidos' }, { status: 400 });
    }
    if (!isValidUuid(safeId)) {
      return NextResponse.json({ error: 'ID de pedido inválido' }, { status: 400 });
    }
    if (entregador_id !== undefined && entregador_id !== null && !isValidUuid(entregador_id)) {
      return NextResponse.json({ error: 'ID de entregador inválido' }, { status: 400 });
    }

    let prevQuery = supabaseAdmin
      .from('pedidos')
      .select('id, status_pedido, estabelecimento_id, numero_pedido, forma_entrega')
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
      .update({ status_pedido: newStatus, ...(entregador_id !== undefined ? { entregador_id } : {}) })
      .eq('id', safeId);

    if (!ctx.isSuperAdmin && ctx.establishmentId) {
      updateQuery = updateQuery.eq('estabelecimento_id', ctx.establishmentId);
    }

    const { error: updateError } = await updateQuery;

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    let pushResult: any = null;
    if (newStatus === OrderStatus.PRONTO) {
      const estId = String((prevRow as any).estabelecimento_id || ctx.establishmentId || '').trim();
      const entregaKey = String((prevRow as any).forma_entrega || '').trim().toLowerCase();
      if (estId && entregaKey === 'delivery') {
        pushResult = await sendReadyPush({
          establishmentId: estId,
          orderId: safeId,
          orderNumber: (prevRow as any).numero_pedido ?? null
        });
      }
    }

    const webhookResult = await sendOrderStatusWebhook({
      orderId: safeId,
      newStatus: String(newStatus),
      previousStatus,
      establishmentId: ctx.establishmentId,
      isSuperAdmin: ctx.isSuperAdmin
    });

    return NextResponse.json({ ok: true, webhook: webhookResult, push: pushResult });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
