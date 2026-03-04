import { MercadoPagoConfig, Preference } from 'mercadopago';
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const { pedidoId } = await request.json();

    if (!pedidoId) {
      return NextResponse.json({ error: 'ID do pedido obrigatório' }, { status: 400 });
    }
    
    // 1. Buscar pedido
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('*')
      .eq('id', pedidoId)
      .single();

    if (pedidoError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // 2. Buscar config MP do estabelecimento
    const { data: configMp, error: configError } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('*')
      .eq('estabelecimento_id', pedido.estabelecimento_id)
      .single();

    if (configError || !configMp || !configMp.ativo) {
      return NextResponse.json({ error: 'Pagamento online indisponível para este estabelecimento' }, { status: 400 });
    }

    // 3. Configurar MP
    // Determinar qual token usar baseando-se na configuração (Teste ou Produção)
    const accessToken = configMp.ambiente === 'producao' 
      ? (configMp.access_token_producao || configMp.access_token)
      : (configMp.access_token_teste || configMp.access_token);

    if (!accessToken) {
      return NextResponse.json({ error: 'Credenciais do Mercado Pago não configuradas' }, { status: 500 });
    }

    const client = new MercadoPagoConfig({ accessToken: accessToken });
    const preference = new Preference(client);

    // 4. Buscar dados do cliente (opcional, para pré-preencher email)
    // Tenta buscar da tabela usuarios ou auth se possível, mas vamos usar um fallback
    let payerEmail = 'cliente@email.com';
    if (pedido.cliente_id) {
       const { data: user, error: userError } = await supabaseAdmin.auth.admin.getUserById(pedido.cliente_id);
       if (!userError && user && user.user) {
         payerEmail = user.user.email || payerEmail;
       }
    }

    // 5. Criar corpo da preferência
    // Usamos um item único representando o total do pedido para simplificar descontos/taxas
    const preferenceBody = {
      items: [
        {
          id: `PEDIDO-${pedido.numero_pedido}`,
          title: `Pedido #${pedido.numero_pedido} - ZapZap Delivery`,
          quantity: 1,
          unit_price: Number(pedido.total_pedido)
        }
      ],
      payer: {
        email: payerEmail
      },
      external_reference: pedido.id, // ID interno do pedido para conciliação no webhook
      back_urls: {
        success: `${process.env.NEXT_PUBLIC_APP_URL}/minhaconta/pedidos?status=success&pedido=${pedido.numero_pedido}`,
        failure: `${process.env.NEXT_PUBLIC_APP_URL}/minhaconta/pedidos?status=failure&pedido=${pedido.numero_pedido}`,
        pending: `${process.env.NEXT_PUBLIC_APP_URL}/minhaconta/pedidos?status=pending&pedido=${pedido.numero_pedido}`
      },
      auto_return: 'approved',
      notification_url: `${process.env.NEXT_PUBLIC_APP_URL}/api/pagamentos/mercado-pago/webhook?estabelecimento_id=${pedido.estabelecimento_id}`,
      statement_descriptor: `ZAPZAP #${pedido.numero_pedido}`
    };

    const result = await preference.create({ body: preferenceBody });
    
    return NextResponse.json({ 
      init_point: result.init_point, 
      sandbox_init_point: result.sandbox_init_point, // Útil se quiser forçar sandbox, mas o init_point já detecta pelo token
      id: result.id 
    });

  } catch (error: any) {
    console.error('Erro ao criar preferência MP:', error);
    return NextResponse.json({ error: error.message || 'Erro interno ao criar pagamento' }, { status: 500 });
  }
}
