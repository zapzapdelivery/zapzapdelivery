import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { formData, orderId } = body;

    if (!orderId || !formData) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1. Buscar pedido para validar valor e pegar estabelecimento
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('*, estabelecimentos(*)')
      .eq('id', orderId)
      .single();

    if (pedidoError || !pedido) {
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // 2. Buscar configurações do MP para o estabelecimento
    const { data: configMp, error: configError } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('*')
      .eq('estabelecimento_id', pedido.estabelecimento_id)
      .single();

    if (configError || !configMp || !configMp.ativo) {
      return NextResponse.json({ error: 'Configuração de pagamento não encontrada' }, { status: 400 });
    }

    const accessToken = configMp.ambiente === 'producao' 
      ? (configMp.access_token_producao || configMp.access_token) 
      : (configMp.access_token_teste || configMp.access_token);

    if (!accessToken) {
      return NextResponse.json({ error: 'Token de acesso não configurado' }, { status: 400 });
    }

    // 3. Inicializar SDK
    const client = new MercadoPagoConfig({ accessToken: accessToken });
    const payment = new Payment(client);

    // 4. Criar pagamento
    // O ambiente de teste deve ser determinado SOMENTE pela configuração.
    const isTestEnv = configMp.ambiente === 'teste';

    // Validação e Definição do Payer
    let payerEmail = formData.payer.email;
    let payerFirstName = formData.payer.first_name || 'Cliente';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Log para depuração das credenciais (mostrando apenas prefixo)
    const tokenPrefix = accessToken.substring(0, 10);
    console.log(`[MP] Ambiente Configurado: ${configMp.ambiente}`);
    console.log(`[MP] Token Prefix: ${tokenPrefix}...`);
    console.log(`[MP] Is Test Env (Logic): ${isTestEnv}`);
    console.log(`[MP] Payer Email Input: ${payerEmail}`);

    // Em ambiente de teste, para evitar erros de "self-payment" (pagar a si mesmo) ou email inválido,
    // forçamos um email de teste aleatório APENAS se o email fornecido for inválido ou vazio.
    // REMOVIDO: Forçar email aleatório em localhost mesmo com email válido. Agora respeita o email inserido se for válido.
    if (isTestEnv) {
        if (!payerEmail || !emailRegex.test(payerEmail)) {
            const randomId = Math.floor(Math.random() * 1000000);
            payerEmail = `test_user_${randomId}@testuser.com`;
            console.log(`[Sandbox] Email inválido ou ausente. Usando email de teste gerado: ${payerEmail}`);
        } else {
             console.log(`[Sandbox] Usando email fornecido: ${payerEmail}`);
        }
    } else {
        // Em produção, exigimos email válido
        if (!payerEmail || !emailRegex.test(payerEmail)) {
            return NextResponse.json({ error: 'Email inválido. Por favor, insira um email válido.' }, { status: 400 });
        }
    }

    const paymentData: any = {
      ...formData,
      transaction_amount: Number(pedido.total_pedido),
      description: `Pedido #${pedido.numero_pedido} - ZapZap Delivery`,
      external_reference: pedido.id,
      payer: {
        email: payerEmail,
        first_name: payerFirstName,
      }
    };

    // URL da aplicação
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');

    // Só adiciona notification_url se NÃO for localhost e se a URL for válida (https)
    if (!isLocalhost && appUrl.startsWith('https')) {
       paymentData.notification_url = `${appUrl}/api/pagamentos/mercado-pago/webhook?estabelecimento_id=${pedido.estabelecimento_id}`;
    }

    console.log(`Ambiente: ${configMp.ambiente}, Token Prefix: ${accessToken.substring(0, 10)}...`);
    console.log('Criando pagamento MP (Payload):', JSON.stringify(paymentData, null, 2));

    let result;
    try {
      result = await payment.create({ body: paymentData });
    } catch (mpError: any) {
       console.error('Erro SDK Mercado Pago:', JSON.stringify(mpError, null, 2));
       
       // Extrair mensagem de erro amigável se possível
       let errorMessage = 'Erro ao criar pagamento no Mercado Pago.';
       let errorDetail = '';

       if (mpError.cause) {
           const causes = Array.isArray(mpError.cause) ? mpError.cause : [mpError.cause];
           errorDetail = causes.map((c: any) => c.description || c.code).join('; ');
       }
       
       if (mpError.message) errorMessage = mpError.message;

       return NextResponse.json({ 
         error: errorMessage, 
         detail: errorDetail || JSON.stringify(mpError),
         payload_sent: isTestEnv ? paymentData : 'hidden' // Retorna payload em teste para debug
       }, { status: 400 });
    }

    if (result.status === 'approved') {
       // Atualizar pedido para 'Pedido Confirmado' e adicionar info na observação
       let novaObservacao = pedido.observacao_cliente || '';
       const infoPagamento = ` (Pagamento Online - APROVADO - ID: ${result.id})`;
       
       if (!novaObservacao.includes('APROVADO')) {
          novaObservacao += infoPagamento;
       }

       const { error: updateError } = await supabaseAdmin
         .from('pedidos')
         .update({ 
           status_pedido: 'Pedido Confirmado',
           observacao_cliente: novaObservacao
         })
         .eq('id', orderId);

       if (updateError) {
         console.error('Erro ao atualizar status do pedido:', updateError);
       }
    } else if (result.status === 'in_process') {
       // Apenas logar ou adicionar observação de pendente
       let novaObservacao = pedido.observacao_cliente || '';
       if (!novaObservacao.includes('Pendente')) {
          novaObservacao += ` (Pagamento Online - Pendente - ID: ${result.id})`;
          
          await supabaseAdmin
            .from('pedidos')
            .update({ 
              observacao_cliente: novaObservacao
            })
            .eq('id', orderId);
       }
    }

    return NextResponse.json({
      status: result.status,
      id: result.id,
      detail: result.status_detail
    });

  } catch (error: any) {
    console.error('Erro ao processar pagamento:', error);
    return NextResponse.json({ 
      error: error.message || 'Erro ao processar pagamento',
      details: error.cause 
    }, { status: 500 });
  }
}
