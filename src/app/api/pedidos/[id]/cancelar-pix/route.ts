import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Verificar se o pedido existe
    const { data: pedido, error: fetchError } = await supabaseAdmin
      .from('pedidos')
      .select('id, status_pedido, forma_pagamento, observacao_cliente')
      .eq('id', id)
      .single();

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Se já estiver cancelado ou finalizado, não faz nada
    if (pedido.status_pedido.includes('Cancelado') || pedido.status_pedido === 'Entregue') {
        return NextResponse.json({ message: 'Pedido já processado' });
    }

    // Se a forma de pagamento não for PIX (opcional, mas bom validar)
    if (pedido.forma_pagamento && !pedido.forma_pagamento.includes('PIX')) {
        return NextResponse.json({ error: 'Pedido não é via PIX' }, { status: 400 });
    }

    // Atualizar status
    const novaObservacao = pedido.observacao_cliente 
      ? `${pedido.observacao_cliente} | Cancelado por falta de pagamento`
      : `Cancelado por falta de pagamento`;

    const { error: updateError } = await supabaseAdmin
      .from('pedidos')
      .update({
        status_pedido: 'Cancelado Pelo Estabelecimento', // Conforme solicitado
        observacao_cliente: novaObservacao
      })
      .eq('id', id);

    if (updateError) {
      console.error('Erro ao cancelar pedido:', updateError);
      return NextResponse.json({ error: 'Erro ao cancelar pedido' }, { status: 500 });
    }

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error('Erro interno ao cancelar pedido:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
