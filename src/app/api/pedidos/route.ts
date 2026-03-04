import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { error, status, isSuperAdmin, establishmentId, role } = await getAuthContext(request);
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    // Bloqueia perfis não administrativos
    const forbiddenRoles = ['cliente', 'entregador'];
    if (role && forbiddenRoles.includes(role)) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    // Parse query params
    const { searchParams } = new URL(request.url);
    const searchParam = searchParams.get('search');
    const daysParam = searchParams.get('days');
    const days = daysParam ? parseInt(daysParam) : 0;

    let query = supabaseAdmin
      .from('pedidos')
      .select(`
        id, numero_pedido, cliente_id, criado_em, forma_pagamento, total_pedido, status_pedido, estabelecimento_id,
        clientes:cliente_id (
          nome_cliente,
          telefone,
          imagem_cliente_url
        ),
        itens_pedidos (
          quantidade,
          valor_unitario,
          total_item,
          produtos (
            nome_produto,
            imagem_produto_url,
            valor_base
          )
        )
      `);

    // Se houver parâmetro de busca, pesquisa pelo número do pedido em todo o histórico
    if (searchParam) {
      // Tenta buscar pelo número do pedido (assumindo que seja numérico ou texto exato)
      // Se for um número válido, busca por numero_pedido
      if (!isNaN(Number(searchParam))) {
        query = query.eq('numero_pedido', Number(searchParam));
      } else {
        // Se não for número, pode tentar buscar pelo ID textual ou retornar vazio
        query = query.eq('id', searchParam);
      }
    } else {
      // Comportamento padrão: filtro por data
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
      const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      
      query = query
        .gte('criado_em', startDate.toISOString())
        .lt('criado_em', endDate.toISOString());
    }
      
    query = query.order('criado_em', { ascending: false });

    if (!isSuperAdmin && establishmentId) {
      query = query.eq('estabelecimento_id', establishmentId);
    }

    const { data, error: fetchError } = await query;
    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    return NextResponse.json(data || []);
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
