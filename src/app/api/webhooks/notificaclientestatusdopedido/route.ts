import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import { OrderStatus, ORDER_STATUS_FLOW } from '@/types/orderStatus';

const WEBHOOK_URL =
  process.env.N8N_WEBHOOK_NOTIFICACLIENTE_STATUS_URL ||
  'https://webhookn8n.zapzapdelivery.com.br/webhook/notificaclientestatusdopedido';

type Payload = {
  orderId: string;
  newStatus: OrderStatus | string;
  previousStatus?: OrderStatus | string | null;
};

function shouldNotify(newStatus: string, previousStatus?: string | null) {
  if (previousStatus && previousStatus === newStatus) return false;
  const startIndex = ORDER_STATUS_FLOW.indexOf(OrderStatus.CONFIRMADO);
  if (startIndex < 0) return false;
  const allowed = new Set(ORDER_STATUS_FLOW.slice(startIndex));
  return allowed.has(newStatus as OrderStatus);
}

function safeNumber(value: unknown) {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export async function sendOrderStatusWebhook(params: {
  orderId: string;
  newStatus: string;
  previousStatus?: string | null;
  establishmentId?: string | null;
  isSuperAdmin?: boolean;
}) {
  const orderId = (params.orderId || '').trim();
  const newStatus = params.newStatus || '';
  const previousStatus = params.previousStatus ?? null;
  const establishmentId = params.establishmentId ?? null;
  const isSuperAdmin = Boolean(params.isSuperAdmin);

  if (!orderId) return { ok: false, error: 'orderId é obrigatório' };
  if (!newStatus) return { ok: false, error: 'newStatus é obrigatório' };

  if (!shouldNotify(newStatus, previousStatus)) {
    return { ok: true, skipped: true };
  }

  let pedidoQuery = supabaseAdmin
    .from('pedidos')
    .select(
      `
        id, numero_pedido, criado_em, forma_pagamento, forma_entrega, subtotal, taxa_entrega, desconto, total_pedido, status_pedido, observacao_cliente, estabelecimento_id,
        clientes:cliente_id (
          id, nome_cliente, telefone, email,
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
            id, nome_produto
          )
        )
      `
    )
    .eq('id', orderId);

  if (!isSuperAdmin && establishmentId) {
    pedidoQuery = pedidoQuery.eq('estabelecimento_id', establishmentId);
  }

  const { data: pedido, error: pedidoError } = await pedidoQuery.maybeSingle();
  if (pedidoError) {
    return { ok: false, error: pedidoError.message };
  }
  if (!pedido) {
    return { ok: false, error: 'Pedido não encontrado' };
  }

  const { data: estabRow } = await supabaseAdmin
    .from('estabelecimentos')
    .select('*')
    .eq('id', pedido.estabelecimento_id)
    .maybeSingle();

  const estab: any = estabRow || {};
  const cnpj =
    estab?.cnpj_cpf ??
    estab?.documento ??
    estab?.cnpj ??
    estab?.cpf ??
    estab?.document ??
    '';
  const nomeEstabelecimento =
    estab?.name ??
    estab?.nome ??
    estab?.nome_estabelecimento ??
    estab?.fantasia ??
    estab?.legal_name ??
    '';

  const itens = Array.isArray((pedido as any).itens_pedidos) ? (pedido as any).itens_pedidos : [];
  const quantidadeItens = itens.reduce((acc: number, item: any) => acc + safeNumber(item?.quantidade), 0);

  const cliente = (pedido as any).clientes || null;
  const enderecos = cliente?.enderecos_clientes;
  const entregador = (pedido as any).entregadores || null;

  const payload = {
    evento: 'status_pedido_alterado',
    status_anterior: previousStatus ?? null,
    status_atual: newStatus,
    estabelecimento: {
      id: pedido.estabelecimento_id,
      nome: nomeEstabelecimento || null,
      cnpj: cnpj || null
    },
    pedido: {
      id: pedido.id,
      numero: pedido.numero_pedido,
      criado_em: pedido.criado_em,
      forma_pagamento: pedido.forma_pagamento,
      forma_entrega: pedido.forma_entrega,
      subtotal: pedido.subtotal,
      taxa_entrega: pedido.taxa_entrega,
      desconto: pedido.desconto,
      total_pedido: pedido.total_pedido,
      observacao_cliente: pedido.observacao_cliente,
      quantidade_itens: quantidadeItens,
      itens: itens.map((item: any) => ({
        id: item?.id ?? null,
        quantidade: item?.quantidade ?? null,
        valor_unitario: item?.valor_unitario ?? null,
        total_item: item?.total_item ?? null,
        observacao_item: item?.observacao_item ?? null,
        produto: {
          id: item?.produtos?.id ?? null,
          nome: item?.produtos?.nome_produto ?? null
        }
      }))
    },
    cliente: {
      id: cliente?.id ?? null,
      nome: cliente?.nome_cliente ?? null,
      telefone: cliente?.telefone ?? null,
      email: cliente?.email ?? null,
      enderecos: Array.isArray(enderecos) ? enderecos : enderecos ? [enderecos] : []
    },
    entregador: {
      id: entregador?.id ?? null,
      nome: entregador?.nome_entregador ?? null,
      telefone: entregador?.telefone ?? null,
      veiculo: entregador?.veiculo ?? null,
      imagem_url: entregador?.imagem_entregador_url ?? null
    }
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const doPost = async (url: string) => {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = resp.ok ? '' : await resp.text().catch(() => '');
      return { resp, text };
    };

    try {
      const first = await doPost(WEBHOOK_URL);

      if (!first.resp.ok) {
        const bodyText = first.text || '';
        const canRetryToProd =
          WEBHOOK_URL.includes('/webhook-test/') &&
          first.resp.status === 404 &&
          bodyText.toLowerCase().includes('not registered');

        if (canRetryToProd) {
          const retryUrl = WEBHOOK_URL.replace('/webhook-test/', '/webhook/');
          const second = await doPost(retryUrl);
          if (!second.resp.ok) {
            console.error('Webhook n8n falhou:', { status: second.resp.status, body: second.text });
            return { ok: false, upstream_status: second.resp.status, upstream_body: second.text };
          }
        } else {
          console.error('Webhook n8n falhou:', { status: first.resp.status, body: bodyText });
          return { ok: false, upstream_status: first.resp.status, upstream_body: bodyText };
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (err: any) {
    console.error('Webhook n8n erro:', err?.message || err);
    return { ok: false, error: err?.message || 'Erro ao enviar webhook' };
  }

  return { ok: true };
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const ctx = await getAuthContext(request);
  if (ctx.error) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
  }

  const { role, isSuperAdmin, establishmentId } = ctx;
  if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'atendente')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as Partial<Payload>;
  const orderId = typeof body.orderId === 'string' ? body.orderId.trim() : '';
  const newStatus = typeof body.newStatus === 'string' ? body.newStatus : '';
  const previousStatus = typeof body.previousStatus === 'string' ? body.previousStatus : null;

  const result = await sendOrderStatusWebhook({
    orderId,
    newStatus,
    previousStatus,
    establishmentId,
    isSuperAdmin
  });

  if (!result.ok && result.error) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  return NextResponse.json(result);
}
