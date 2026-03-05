import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

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
    // Next.js 15: params must be awaited
    const { id } = await params;

    // 1. Buscar pedido atual
    const { data: pedido, error: fetchError } = await supabaseAdmin
      .from('pedidos')
      .select('*, estabelecimentos(*)')
      .eq('id', id)
      .single();

    if (fetchError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // 2. Buscar Configuração MP do Estabelecimento
    const { data: configMp, error: configError } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('*')
      .eq('estabelecimento_id', pedido.estabelecimento_id)
      .single();

    if (configError || !configMp) {
      return NextResponse.json({ error: 'Configuração de pagamento não encontrada' }, { status: 404 });
    }

    const accessToken = configMp.ambiente === 'producao' 
      ? configMp.access_token_producao 
      : configMp.access_token_teste;

    if (!accessToken) {
      return NextResponse.json({ error: 'Token de acesso não configurado' }, { status: 500 });
    }

    // 3. Inicializar SDK e Buscar Pagamento Anterior
    const client = new MercadoPagoConfig({ accessToken: accessToken as string });
    const payment = new Payment(client);

    try {
        const searchResult = await payment.search({
          options: {
              external_reference: id,
              sort: 'date_created',
              criteria: 'desc',
              limit: 1
          }
        });

        if (!searchResult.results || searchResult.results.length === 0) {
            return NextResponse.json({ error: 'Pagamento original não encontrado.' }, { status: 404 });
        }

        const lastPayment: any = searchResult.results[0];
        
        // 4. Apenas Atualizar Pedido no Supabase (Sem criar novo pagamento)
        // Adicionar timestamp de reativação na observação para fins de log
        const novaObservacao = pedido.observacao_cliente 
          ? `${pedido.observacao_cliente} | Reexibido em: ${new Date().toISOString()}`
          : `Reexibido em: ${new Date().toISOString()}`;

        const { error: updateError } = await supabaseAdmin
          .from('pedidos')
          .update({
            status_pedido: 'Pedindo',
            observacao_cliente: novaObservacao
          })
          .eq('id', id);

        if (updateError) {
          console.error('Erro ao reativar pedido:', updateError);
          return NextResponse.json({ error: 'Erro ao atualizar status do pedido' }, { status: 500 });
        }

        console.log(`[Reativar] Pedido ${id} restaurado para 'Pedindo'. Reutilizando pagamento ${lastPayment.id}`);

        // Retornar dados do pagamento existente
        const pointOfInteraction = lastPayment.point_of_interaction;
        const transactionData = pointOfInteraction?.transaction_data;

        return NextResponse.json({
            success: true,
            id: lastPayment.id,
            status: lastPayment.status,
            status_detail: lastPayment.status_detail,
            qr_code: transactionData?.qr_code,
            qr_code_base64: transactionData?.qr_code_base64,
            ticket_url: transactionData?.ticket_url,
            date_expiration: lastPayment.date_of_expiration,
            amount: lastPayment.transaction_amount
        });

    } catch (mpError) {
        console.error('[Reativar] Erro ao buscar/restaurar pagamento:', mpError);
        return NextResponse.json({ error: 'Erro ao processar reativação' }, { status: 500 });
    }
  } catch (error) {
    console.error('Erro interno ao reativar pedido:', error);
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
  }
}
