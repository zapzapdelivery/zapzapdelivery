import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const ctx = await getAuthContext(request);
    if (ctx.error) {
      return NextResponse.json({ error: ctx.error }, { status: ctx.status || 401 });
    }
    if (!ctx.role || (ctx.role !== 'admin' && ctx.role !== 'estabelecimento' && ctx.role !== 'atendente')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }
    const estabId = ctx.establishmentId;
    if (!estabId) {
      return NextResponse.json({ error: 'Estabelecimento inválido' }, { status: 400 });
    }

    const { data: movements, error: movErr } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .select('id, estabelecimento_id, produto_id, quantidade, tipo_movimentacao, motivo, criado_em, atualizado_em')
      .eq('estabelecimento_id', estabId)
      .order('criado_em', { ascending: false });

    let movementsList = movements || [];
    if (movErr && (movErr.message || '').includes("Could not find the table 'public.movimentacoes_estoque'")) {
      const { data: pedidos, error: pedidosErr } = await supabaseAdmin
        .from('pedidos')
        .select(`
          id,
          numero_pedido,
          criado_em,
          estabelecimento_id,
          itens_pedidos (
            produto_id,
            quantidade,
            produtos (
              nome_produto,
              imagem_produto_url
            )
          )
        `)
        .eq('estabelecimento_id', estabId)
        .order('criado_em', { ascending: false });

      if (pedidosErr) {
        return NextResponse.json({ error: pedidosErr.message || 'Erro ao buscar pedidos para fallback' }, { status: 400 });
      }

      movementsList = (pedidos || []).flatMap((p: any) => {
        const itens = Array.isArray(p.itens_pedidos) ? p.itens_pedidos : [];
        return itens.map((it: any) => ({
          id: `${p.id}-${it.produto_id}`,
          produto_id: it.produto_id,
          quantidade: Number(it.quantidade) || 0,
          tipo_movimentacao: 'venda',
          criado_em: p.criado_em,
          estabelecimento_id: p.estabelecimento_id,
          _produto_nome: it.produtos?.nome_produto || null,
          _produto_imagem: it.produtos?.imagem_produto_url || null,
          _numero_pedido: p.numero_pedido || null
        }));
      });
    } else if (movErr) {
      return NextResponse.json({ error: movErr.message || 'Erro ao buscar movimentações' }, { status: 400 });
    }

    const productIds = Array.from(new Set((movementsList || []).map((m: any) => String(m.produto_id))));

    let productsMap = new Map<string, any>();

    if (productIds.length > 0) {
      const { data: products } = await supabaseAdmin
        .from('produtos')
        .select('id, nome_produto, imagem_produto_url')
        .in('id', productIds);
      productsMap = new Map<string, any>((products || []).map((p: any) => [String(p.id), p]));
    }

    const enriched = (movementsList || []).map((m: any) => {
      const prod = productsMap.get(String(m.produto_id));
      return {
        id: String(m.id),
        estabelecimento_id: String(m.estabelecimento_id),
        produto_id: String(m.produto_id),
        quantidade: Number(m.quantidade) || 0,
        tipo_movimentacao: String(m.tipo_movimentacao || m.tipo_movimento || 'ajuste'),
        motivo:
          m.motivo ||
          (m._numero_pedido
            ? `Venda • Pedido ${m._numero_pedido}`
            : null),
        criado_em: m.criado_em || null,
        atualizado_em: m.atualizado_em || null,
        nome_produto: (m._produto_nome as string | null) ?? (prod?.nome_produto || 'Produto'),
        imagem_produto_url: (m._produto_imagem as string | null) ?? (prod?.imagem_produto_url || null)
      };
    });

    return NextResponse.json(enriched);
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
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

    const estabId = ctx.establishmentId;
    if (!estabId) {
      return NextResponse.json({ error: 'Estabelecimento inválido' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      produto_id,
      tipo_movimentacao,
      quantidade,
      motivo,
      criado_em
    } = body || {};

    if (!produto_id) {
      return NextResponse.json({ error: 'Produto não informado' }, { status: 400 });
    }

    const allowedTypes = ['entrada', 'saida', 'ajuste', 'venda'];
    if (!tipo_movimentacao || !allowedTypes.includes(tipo_movimentacao)) {
      return NextResponse.json({ error: 'Tipo de movimentação inválido' }, { status: 400 });
    }

    const qty = Number(quantidade);
    if (!Number.isFinite(qty) || qty < 0) {
      return NextResponse.json({ error: 'Quantidade inválida' }, { status: 400 });
    }

    // Update or Create the Stock in `estoque_produtos` first
    const { data: stockRow } = await supabaseAdmin
      .from('estoque_produtos')
      .select('id, estoque_atual, estoque_minimo')
      .eq('estabelecimento_id', estabId)
      .eq('produto_id', produto_id)
      .maybeSingle();

    let newStock = 0;
    if (stockRow) {
      // Calculate based on existing stock
      if (tipo_movimentacao === 'entrada') newStock = (stockRow.estoque_atual || 0) + qty;
      else if (tipo_movimentacao === 'saida' || tipo_movimentacao === 'venda') newStock = (stockRow.estoque_atual || 0) - qty;
      else if (tipo_movimentacao === 'ajuste') newStock = qty;
    } else {
      // New stock record
      if (tipo_movimentacao === 'entrada' || tipo_movimentacao === 'ajuste') newStock = qty;
      else if (tipo_movimentacao === 'saida' || tipo_movimentacao === 'venda') newStock = -qty;
    }

    if (stockRow?.id) {
      await supabaseAdmin
        .from('estoque_produtos')
        .update({ estoque_atual: newStock })
        .eq('id', stockRow.id);
    } else {
      await supabaseAdmin
        .from('estoque_produtos')
        .insert({
          estabelecimento_id: estabId,
          produto_id: produto_id,
          estoque_atual: newStock,
          estoque_minimo: 0
        });
    }

    const payload: any = {
      estabelecimento_id: estabId,
      produto_id,
      tipo_movimentacao,
      quantidade: qty
    };

    if (typeof motivo === 'string' && motivo.trim()) {
      payload.motivo = motivo.trim();
    }
    if (criado_em) {
      payload.criado_em = criado_em;
    }

    const { error: movError } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .insert(payload);

    if (movError) {
      return NextResponse.json(
        { error: movError.message || 'Erro ao registrar movimentação de estoque' },
        { status: 400 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const message = e?.message || 'Internal Server Error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
