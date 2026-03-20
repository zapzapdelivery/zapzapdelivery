import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function DELETE(request: Request, ctx: RouteContext) {
  try {
    const authCtx = await getAuthContext(request);
    if (authCtx.error) return NextResponse.json({ error: authCtx.error }, { status: authCtx.status || 401 });
    
    if (!authCtx.role || (authCtx.role !== 'admin' && authCtx.role !== 'estabelecimento' && authCtx.role !== 'atendente')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const estabId = authCtx.establishmentId;
    if (!estabId) return NextResponse.json({ error: 'Estabelecimento inválido' }, { status: 400 });

    const params = await ctx.params;
    const movementId = params.id;
    
    if (!movementId) return NextResponse.json({ error: 'ID da movimentação não informado' }, { status: 400 });

    // 1. Find the current movement to reverse its stock mathematical effect
    const { data: movData, error: movErr } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .select('id, tipo_movimentacao, quantidade, produto_id')
      .eq('id', movementId)
      .eq('estabelecimento_id', estabId)
      .maybeSingle();

    if (movErr) {
       return NextResponse.json({ error: 'Erro interno ao buscar movimentação' }, { status: 400 });
    }
    if (!movData) {
       return NextResponse.json({ error: 'Movimentação não encontrada, pode já ter sido excluída.' }, { status: 404 });
    }
    if (movData.tipo_movimentacao === 'venda') {
       return NextResponse.json({ error: 'Registros de vendas não podem ser excluídos pelo gerenciador manual.' }, { status: 400 });
    }

    // 2. Compute and apply reversing stock calculations
    const { data: stockRow } = await supabaseAdmin
      .from('estoque_produtos')
      .select('id, estoque_atual')
      .eq('estabelecimento_id', estabId)
      .eq('produto_id', movData.produto_id)
      .maybeSingle();

    if (stockRow && movData.tipo_movimentacao !== 'ajuste') {
       let currStock = stockRow.estoque_atual || 0;
       
       if (movData.tipo_movimentacao === 'entrada') {
           currStock -= movData.quantidade; // Removing an entrance means restoring back down
       } else if (movData.tipo_movimentacao === 'saida') {
           currStock += movData.quantidade; // Removing a withdrawal means returning items to inventory
       }
       
       await supabaseAdmin
         .from('estoque_produtos')
         .update({ estoque_atual: currStock })
         .eq('id', stockRow.id);
    }

    // 3. Delete the history record
    const { error: delErr } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .delete()
      .eq('id', movementId)
      .eq('estabelecimento_id', estabId);

    if (delErr) {
       return NextResponse.json({ error: 'Erro ao deletar registro oficial no banco.' }, { status: 400 });
    }

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal Server Error' }, { status: 500 });
  }
}
