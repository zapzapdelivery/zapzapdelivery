import { NextResponse } from 'next/server';
import { getAuthContext, supabaseAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const { user, error: authError, status } = await getAuthContext(request);

    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Não autenticado' }, { status: status || 401 });
    }

    let clientId = user.id;

    const { data: client } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (client?.id) {
      clientId = client.id;
    } else if (user.email) {
      const { data: clientByEmail } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (clientByEmail?.id) clientId = clientByEmail.id;
    }

    const { data: pedido, error } = await supabaseAdmin
      .from('pedidos')
      .select(
        `
          id,
          numero_pedido,
          criado_em,
          total_pedido,
          status_pedido,
          forma_pagamento,
          forma_entrega,
          subtotal,
          taxa_entrega,
          desconto,
          observacao_cliente,
          estabelecimento_id,
          estabelecimentos (
            id,
            nome_estabelecimento,
            url_cardapio
          ),
          itens_pedidos (
            id,
            produto_id,
            quantidade,
            valor_unitario,
            total_item,
            observacao_item,
            produtos (
              id,
              nome_produto,
              imagem_produto_url,
              valor_base
            )
          )
        `
      )
      .eq('cliente_id', clientId)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, pedido: pedido || null });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}

