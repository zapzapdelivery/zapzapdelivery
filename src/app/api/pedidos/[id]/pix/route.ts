
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

// Config Supabase Admin
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: orderId } = await params;

    if (!orderId) {
      return NextResponse.json({ error: 'ID do pedido é obrigatório' }, { status: 400 });
    }

    // 1. Buscar pedido para pegar estabelecimento e validar
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('estabelecimento_id, status_pedido, forma_pagamento')
      .eq('id', orderId)
      .single();

    if (pedidoError || !pedido) {
      console.error('Pedido não encontrado:', orderId, pedidoError);
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // Só permite busca se for PIX
    // Permitimos buscar mesmo se não estiver pendente, caso o usuário queira ver o comprovante ou tentar pagar novamente se falhou
    if (pedido.forma_pagamento !== 'pix') {
      return NextResponse.json({ error: 'Este pedido não é PIX' }, { status: 400 });
    }

    // 2. Buscar Configuração MP do Estabelecimento
    const { data: configMp, error: configError } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('access_token_producao, access_token_teste, ambiente')
      .eq('estabelecimento_id', pedido.estabelecimento_id)
      .single();

    if (configError || !configMp) {
      console.error('Configuração MP não encontrada para estabelecimento:', pedido.estabelecimento_id);
      return NextResponse.json({ error: 'Configuração de pagamento não encontrada' }, { status: 404 });
    }

    const accessToken = configMp.ambiente === 'producao' 
      ? configMp.access_token_producao 
      : configMp.access_token_teste;

    if (!accessToken) {
      return NextResponse.json({ error: 'Token de acesso não configurado' }, { status: 500 });
    }

    // 3. Buscar Pagamento no Mercado Pago
    const client = new MercadoPagoConfig({ accessToken });
    const payment = new Payment(client);

    // Busca pagamentos associados a este pedido (external_reference)
    // Ordena pelo mais recente criado
    try {
        const searchResult = await payment.search({
        options: {
            external_reference: orderId,
            sort: 'date_created',
            criteria: 'desc',
            limit: 1
        }
        });

        if (!searchResult.results || searchResult.results.length === 0) {
        return NextResponse.json({ error: 'Pagamento não encontrado no Mercado Pago' }, { status: 404 });
        }

        const lastPayment: any = searchResult.results[0];

        // Extrair dados do PIX
        const pointOfInteraction = lastPayment.point_of_interaction;
        const transactionData = pointOfInteraction?.transaction_data;

        if (!transactionData) {
        return NextResponse.json({ 
            error: 'Dados do PIX não disponíveis neste pagamento',
            payment_status: lastPayment.status
        }, { status: 404 });
        }

        return NextResponse.json({
        id: lastPayment.id,
        status: lastPayment.status,
        status_detail: lastPayment.status_detail,
        qr_code: transactionData.qr_code,
        qr_code_base64: transactionData.qr_code_base64,
        ticket_url: transactionData.ticket_url,
        date_expiration: lastPayment.date_of_expiration,
        amount: lastPayment.transaction_amount
        });

    } catch (mpError: any) {
        console.error('Erro na API do Mercado Pago:', mpError);
        return NextResponse.json({ 
            error: 'Erro ao comunicar com Mercado Pago', 
            details: mpError.message 
        }, { status: 502 });
    }

  } catch (error: any) {
    console.error('Erro ao buscar dados do PIX:', error);
    return NextResponse.json({ error: error.message || 'Erro interno' }, { status: 500 });
  }
}
