import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import { OrderStatus } from '@/types/orderStatus';
import { sendOrderStatusWebhook } from '@/app/api/webhooks/notificaclientestatusdopedido/route';

const isValidUuid = (value: any): value is string => {
  return (
    value != null &&
    typeof value === 'string' &&
    value.trim() !== '' &&
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(value.trim())
  );
};

function startOfTodayISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return start.toISOString();
}

function startOfWeekISO() {
  const now = new Date();
  const day = now.getDay();
  const diff = day === 0 ? 6 : day - 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  return start.toISOString();
}

function startOfMonthISO() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  return start.toISOString();
}

function normalizeEstabelecimento(e: any) {
  if (!e) return null;
  const row = Array.isArray(e) ? e[0] : e;
  if (!row) return null;
  return {
    id: row.id ?? null,
    nome: row.nome_estabelecimento ?? null,
    endereco: row.endereco ?? null,
    numero: row.numero ?? null,
    bairro: row.bairro ?? null,
    cidade: row.cidade ?? null,
    uf: row.uf ?? null
  };
}

function normalizeCliente(c: any) {
  if (!c) return null;
  const row = Array.isArray(c) ? c[0] : c;
  if (!row) return null;
  const enderecos = row.enderecos_clientes;
  return {
    id: row.id ?? null,
    nome: row.nome_cliente ?? null,
    telefone: row.telefone ?? null,
    email: row.email ?? null,
    enderecos: Array.isArray(enderecos) ? enderecos : enderecos ? [enderecos] : []
  };
}

function normalizePedido(p: any) {
  return {
    id: p.id,
    numero_pedido: p.numero_pedido ?? null,
    criado_em: p.criado_em ?? null,
    total_pedido: p.total_pedido ?? null,
    taxa_entrega: p.taxa_entrega ?? null,
    forma_entrega: p.forma_entrega ?? null,
    forma_pagamento: p.forma_pagamento ?? null,
    status_pedido: p.status_pedido ?? null,
    estabelecimento: normalizeEstabelecimento(p.estabelecimentos),
    cliente: normalizeCliente(p.clientes)
  };
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const includeEntregues = searchParams.get('includeEntregues') === '1';
  const page = Math.max(1, Number(searchParams.get('page') || 1) || 1);
  const perPage = Math.min(50, Math.max(5, Number(searchParams.get('perPage') || 20) || 20));
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  const ctx = await getAuthContext(request);
  if (ctx.error) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
  }

  const { role, isSuperAdmin, establishmentId, user } = ctx;
  if (!role || (role !== 'entregador' && role !== 'admin')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const entregadorId = user?.id;
  if (!entregadorId) {
    return NextResponse.json({ error: 'Usuário inválido' }, { status: 401 });
  }

  let disponiveisQuery = supabaseAdmin
    .from('pedidos')
    .select(
      `
        id, numero_pedido, criado_em, total_pedido, taxa_entrega, forma_entrega, forma_pagamento, status_pedido, estabelecimento_id,
        clientes (
          id, nome_cliente, telefone, email,
          enderecos_clientes (endereco, numero, bairro, cidade, uf, cep, complemento)
        ),
        estabelecimentos (
          id, nome_estabelecimento, endereco, numero, bairro, cidade, uf
        )
      `
    )
    .eq('status_pedido', OrderStatus.PRONTO)
    .eq('forma_entrega', 'delivery')
    .is('entregador_id', null)
    .order('criado_em', { ascending: true });

  if (!isSuperAdmin && establishmentId) {
    disponiveisQuery = disponiveisQuery.eq('estabelecimento_id', establishmentId);
  }

  const { data: disponiveisRaw, error: disponiveisError } = await disponiveisQuery;
  if (disponiveisError) {
    return NextResponse.json({ error: disponiveisError.message }, { status: 400 });
  }

  let atualQuery = supabaseAdmin
    .from('pedidos')
    .select(
      `
        id, numero_pedido, criado_em, total_pedido, taxa_entrega, forma_entrega, forma_pagamento, status_pedido, estabelecimento_id,
        clientes (
          id, nome_cliente, telefone, email,
          enderecos_clientes (endereco, numero, bairro, cidade, uf, cep, complemento)
        ),
        estabelecimentos (
          id, nome_estabelecimento, endereco, numero, bairro, cidade, uf
        )
      `
    )
    .eq('entregador_id', entregadorId)
    .in('status_pedido', [OrderStatus.SAIU_ENTREGA, OrderStatus.PRONTO])
    .eq('forma_entrega', 'delivery')
    .order('criado_em', { ascending: true });

  if (!isSuperAdmin && establishmentId) {
    atualQuery = atualQuery.eq('estabelecimento_id', establishmentId);
  }

  const { data: atualRaw, error: atualError } = await atualQuery;
  if (atualError) {
    return NextResponse.json({ error: atualError.message }, { status: 400 });
  }

  let historicoQuery = supabaseAdmin
    .from('pedidos')
    .select(
      `
        id, numero_pedido, criado_em, total_pedido, forma_entrega, forma_pagamento, status_pedido, estabelecimento_id,
        clientes (id, nome_cliente, telefone),
        estabelecimentos (id, nome_estabelecimento)
      `
    )
    .eq('entregador_id', entregadorId)
    .in('status_pedido', [OrderStatus.ENTREGUE, OrderStatus.CANCELADO_CLIENTE, OrderStatus.CANCELADO_ESTABELECIMENTO])
    .eq('forma_entrega', 'delivery')
    .order('criado_em', { ascending: false })
    .limit(10);

  if (!isSuperAdmin && establishmentId) {
    historicoQuery = historicoQuery.eq('estabelecimento_id', establishmentId);
  }

  const { data: historicoRaw, error: historicoError } = await historicoQuery;
  if (historicoError) {
    return NextResponse.json({ error: historicoError.message }, { status: 400 });
  }

  const startISO = startOfTodayISO();
  let statsQuery = supabaseAdmin
    .from('pedidos')
    .select('id, total_pedido, criado_em', { count: 'exact' })
    .eq('entregador_id', entregadorId)
    .eq('status_pedido', OrderStatus.ENTREGUE)
    .eq('forma_entrega', 'delivery')
    .gte('criado_em', startISO);

  if (!isSuperAdmin && establishmentId) {
    statsQuery = statsQuery.eq('estabelecimento_id', establishmentId);
  }

  const { data: statsRows, count: entregasHojeCount } = await statsQuery;
  const faturamentoTotal = (statsRows || []).reduce((acc: number, row: any) => acc + Number(row?.total_pedido || 0), 0);

  let ganhos: { dia: number; semana: number; mes: number } | null = null;
  let entregues: any[] | null = null;

  if (includeEntregues) {
    const startDiaISO = startOfTodayISO();
    const startSemanaISO = startOfWeekISO();
    const startMesISO = startOfMonthISO();

    let ganhosDiaQuery = supabaseAdmin
      .from('pedidos')
      .select('taxa_entrega, criado_em')
      .eq('entregador_id', entregadorId)
      .eq('status_pedido', OrderStatus.ENTREGUE)
      .eq('forma_entrega', 'delivery')
      .gte('criado_em', startDiaISO);

    let ganhosSemanaQuery = supabaseAdmin
      .from('pedidos')
      .select('taxa_entrega, criado_em')
      .eq('entregador_id', entregadorId)
      .eq('status_pedido', OrderStatus.ENTREGUE)
      .eq('forma_entrega', 'delivery')
      .gte('criado_em', startSemanaISO);

    let ganhosMesQuery = supabaseAdmin
      .from('pedidos')
      .select('taxa_entrega, criado_em')
      .eq('entregador_id', entregadorId)
      .eq('status_pedido', OrderStatus.ENTREGUE)
      .eq('forma_entrega', 'delivery')
      .gte('criado_em', startMesISO);

    let entreguesQuery = supabaseAdmin
      .from('pedidos')
      .select(
        `
          id, numero_pedido, criado_em, total_pedido, taxa_entrega, forma_entrega, forma_pagamento, status_pedido, estabelecimento_id,
          clientes (
            id, nome_cliente, telefone, email,
            enderecos_clientes (endereco, numero, bairro, cidade, uf, cep, complemento)
          ),
          estabelecimentos (
            id, nome_estabelecimento, endereco, numero, bairro, cidade, uf
          )
        `
      )
      .eq('entregador_id', entregadorId)
      .eq('status_pedido', OrderStatus.ENTREGUE)
      .eq('forma_entrega', 'delivery')
      .order('criado_em', { ascending: false })
      .range(from, to);

    if (!isSuperAdmin && establishmentId) {
      ganhosDiaQuery = ganhosDiaQuery.eq('estabelecimento_id', establishmentId);
      ganhosSemanaQuery = ganhosSemanaQuery.eq('estabelecimento_id', establishmentId);
      ganhosMesQuery = ganhosMesQuery.eq('estabelecimento_id', establishmentId);
      entreguesQuery = entreguesQuery.eq('estabelecimento_id', establishmentId);
    }

    const [
      { data: ganhosDiaRows, error: ganhosDiaError },
      { data: ganhosSemanaRows, error: ganhosSemanaError },
      { data: ganhosMesRows, error: ganhosMesError },
      { data: entreguesRaw, error: entreguesError }
    ] = await Promise.all([ganhosDiaQuery, ganhosSemanaQuery, ganhosMesQuery, entreguesQuery]);

    const maybeError = ganhosDiaError || ganhosSemanaError || ganhosMesError || entreguesError;
    if (maybeError) {
      return NextResponse.json({ error: maybeError.message }, { status: 400 });
    }

    const sumTaxa = (rows: any[] | null | undefined) =>
      (rows || []).reduce((acc: number, row: any) => acc + Number(row?.taxa_entrega || 0), 0);

    ganhos = {
      dia: sumTaxa(ganhosDiaRows),
      semana: sumTaxa(ganhosSemanaRows),
      mes: sumTaxa(ganhosMesRows)
    };

    entregues = (entreguesRaw || []).map(normalizePedido);
  }

  return NextResponse.json({
    disponiveis: (disponiveisRaw || []).map(normalizePedido),
    entrega_atual: (atualRaw || []).map(normalizePedido),
    historico: (historicoRaw || []).map((p: any) => ({
      id: p.id,
      numero_pedido: p.numero_pedido ?? null,
      criado_em: p.criado_em ?? null,
      total_pedido: p.total_pedido ?? null,
      status_pedido: p.status_pedido ?? null,
      estabelecimento_nome: (Array.isArray(p?.estabelecimentos) ? p.estabelecimentos[0] : p?.estabelecimentos)?.nome_estabelecimento ?? null
    })),
    stats: {
      entregasHoje: entregasHojeCount || 0,
      faturamentoTotal: faturamentoTotal
    },
    ganhos,
    entregues,
    entregues_paginacao: includeEntregues
      ? { page, perPage, from, to, hasMore: Array.isArray(entregues) ? entregues.length === perPage : false }
      : null
  });
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const ctx = await getAuthContext(request);
  if (ctx.error) {
    return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
  }

  const { role, isSuperAdmin, establishmentId, user } = ctx;
  if (!role || (role !== 'entregador' && role !== 'admin')) {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  const entregadorId = user?.id;
  if (!entregadorId) {
    return NextResponse.json({ error: 'Usuário inválido' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : '';

  if (action !== 'aceitar' && action !== 'finalizar') {
    return NextResponse.json({ error: 'Ação inválida' }, { status: 400 });
  }

  const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
  if (!isValidUuid(orderId)) {
    return NextResponse.json({ error: 'orderId inválido' }, { status: 400 });
  }

  if (action === 'aceitar') {
    let updateQuery = supabaseAdmin
      .from('pedidos')
      .update({
        entregador_id: entregadorId,
        status_pedido: OrderStatus.SAIU_ENTREGA
      })
      .eq('id', orderId)
      .eq('status_pedido', OrderStatus.PRONTO)
      .eq('forma_entrega', 'delivery')
      .is('entregador_id', null);

    if (!isSuperAdmin && establishmentId) {
      updateQuery = updateQuery.eq('estabelecimento_id', establishmentId);
    }

    const { data, error } = await updateQuery.select('id').maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (!data) {
      return NextResponse.json({ error: 'Pedido não disponível para aceitar' }, { status: 409 });
    }

    const webhookResult = await sendOrderStatusWebhook({
      orderId,
      newStatus: OrderStatus.SAIU_ENTREGA,
      previousStatus: OrderStatus.PRONTO,
      establishmentId,
      isSuperAdmin
    });
    if (!webhookResult.ok && !webhookResult.skipped) {
      console.error('[Entregador Painel] Falha ao disparar webhook de status:', webhookResult);
    }

    return NextResponse.json({ ok: true });
  }

  let updateQuery = supabaseAdmin
    .from('pedidos')
    .update({
      status_pedido: OrderStatus.ENTREGUE
    })
    .eq('id', orderId)
    .eq('entregador_id', entregadorId)
    .eq('status_pedido', OrderStatus.SAIU_ENTREGA)
    .eq('forma_entrega', 'delivery');

  if (!isSuperAdmin && establishmentId) {
    updateQuery = updateQuery.eq('estabelecimento_id', establishmentId);
  }

  const { data, error } = await updateQuery.select('id').maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (!data) {
    return NextResponse.json({ error: 'Pedido não disponível para finalizar' }, { status: 409 });
  }

  const webhookResult = await sendOrderStatusWebhook({
    orderId,
    newStatus: OrderStatus.ENTREGUE,
    previousStatus: OrderStatus.SAIU_ENTREGA,
    establishmentId,
    isSuperAdmin
  });
  if (!webhookResult.ok && !webhookResult.skipped) {
    console.error('[Entregador Painel] Falha ao disparar webhook de status:', webhookResult);
  }

  return NextResponse.json({ ok: true });
}
