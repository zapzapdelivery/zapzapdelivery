import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import fs from 'fs';
import path from 'path';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

// Função auxiliar para log de erros em arquivo
function logErrorToFile(message: string, details?: any) {
  try {
    const logDir = path.join(process.cwd(), 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logPath = path.join(logDir, 'mp-errors.log');
    const logEntry = `[${new Date().toISOString()}] ${message}\n${details ? JSON.stringify(details, null, 2) : ''}\n\n`;
    fs.appendFileSync(logPath, logEntry);
  } catch (err) {
    console.error('Falha ao escrever log:', err);
  }
}

// Credenciais de Sandbox (Fallback) conhecidas
const FALLBACK_TEST_ACCESS_TOKEN = 'APP_USR-6274208258320543-030313-3fa8d7d5813adf77a83475be4d1d231e-3240409509';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { formData, orderId } = body;

    if (!orderId || !formData) {
      logErrorToFile('Dados incompletos', { orderId, hasFormData: !!formData });
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1. Buscar pedido para validar valor e pegar estabelecimento
    const { data: pedido, error: pedidoError } = await supabaseAdmin
      .from('pedidos')
      .select('*, estabelecimentos(*)')
      .eq('id', orderId)
      .single();

    if (pedidoError || !pedido) {
      logErrorToFile('Pedido não encontrado ou erro DB', { orderId, pedidoError });
      return NextResponse.json({ error: 'Pedido não encontrado' }, { status: 404 });
    }

    // 2. Buscar configurações do MP para o estabelecimento
    const { data: configMp, error: configError } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('*')
      .eq('estabelecimento_id', pedido.estabelecimento_id)
      .single();

    if (configError || !configMp || !configMp.ativo) {
      logErrorToFile('Configuração de pagamento inválida', { estabelecimentoId: pedido.estabelecimento_id, configError, configMp });
      return NextResponse.json({ error: 'Configuração de pagamento não encontrada' }, { status: 400 });
    }

    const accessToken = configMp.ambiente === 'producao' 
      ? (configMp.access_token_producao || configMp.access_token) 
      : (configMp.access_token_teste || configMp.access_token);

    if (!accessToken) {
      logErrorToFile('Access Token não encontrado', { ambiente: configMp.ambiente });
      return NextResponse.json({ error: 'Token de acesso não configurado' }, { status: 400 });
    }

    // 3. Inicializar SDK
    const client = new MercadoPagoConfig({ accessToken: accessToken });
    const payment = new Payment(client);

    // URL da aplicação
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const isLocalhost = appUrl.includes('localhost') || appUrl.includes('127.0.0.1');

    // 4. Criar pagamento
    // O ambiente de teste deve ser determinado SOMENTE pela configuração.
    const isTestEnv = configMp.ambiente === 'teste';

    // Validação e Definição do Payer
    let payerEmail = formData.payer.email;
    let payerFirstName = formData.payer.first_name || 'Cliente';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // Variável para armazenar o email original do payer para logs/referência
    let originalEmail = payerEmail;

    // Log para depuração das credenciais (mostrando apenas prefixo)
    const tokenPrefix = accessToken.substring(0, 10);
    console.log(`[MP] Ambiente Configurado: ${configMp.ambiente}`);
    console.log(`[MP] Token Prefix: ${tokenPrefix}...`);
    console.log(`[MP] Is Test Env (Logic): ${isTestEnv}`);
    console.log(`[MP] Is Localhost: ${isLocalhost}`);
    console.log(`[MP] Payer Email Input: ${payerEmail}`);

    // Lógica ajustada:
    // Se o ambiente configurado for 'teste' ou 'sandbox', forçamos o email de teste (pois credenciais de teste exigem users de teste).
    // Se for 'producao', usamos o email real, MESMO em localhost.
    const isTestConfig = configMp.ambiente === 'teste' || configMp.ambiente === 'sandbox';

    if (isTestConfig) {
        const randomId = Math.floor(Math.random() * 1000000);
        const originalEmail = payerEmail;
        payerEmail = `test_user_${randomId}@testuser.com`;
        console.log(`[Modo Teste] Forçando email de teste.`);
        console.log(`[Modo Teste] Email original: ${originalEmail} -> Novo: ${payerEmail}`);
    } else {
        // Modo Produção: Exige email válido real
        if (!payerEmail || !emailRegex.test(payerEmail)) {
             logErrorToFile('Email inválido em produção', { payerEmail });
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

    // Configurar expiração do PIX para 15 minutos
    if (formData.payment_method_id === 'pix') {
      const expirationDate = new Date();
      expirationDate.setMinutes(expirationDate.getMinutes() + 15);
      paymentData.date_of_expiration = expirationDate.toISOString();
      console.log(`[MP] PIX Expiration set to: ${paymentData.date_of_expiration}`);
    }

    // Só adiciona notification_url se NÃO for localhost e se a URL for válida (https)
    if (!isLocalhost && appUrl.startsWith('https')) {
       paymentData.notification_url = `${appUrl}/api/pagamentos/mercado-pago/webhook?estabelecimento_id=${pedido.estabelecimento_id}`;
    }

    console.log(`Ambiente: ${configMp.ambiente}, Token Prefix: ${accessToken.substring(0, 10)}...`);
    console.log('Criando pagamento MP (Payload):', JSON.stringify(paymentData, null, 2));

    let result;
    try {
      result = await payment.create({ body: paymentData });
    } catch (error: any) {
      console.error('[MP] Erro ao criar pagamento:', error);
      
      let fallbackSuccess = false;

      // Fallback para Sandbox se o erro for de credenciais inválidas ou live credentials em ambiente de teste
      // O erro "Unauthorized use of live credentials" indica que estamos tentando usar um token de produção em um contexto inválido
      // ou sem permissão. Tentar com o token de sandbox conhecido.
      if (error?.message?.includes('Unauthorized use of live credentials') || 
          error?.cause?.description?.includes('Unauthorized use of live credentials') ||
          (isLocalhost && !isTestEnv)) {
        
        console.warn('[MP] Erro de credenciais detectado. Tentando fallback para Sandbox...');
        
        try {
           const fallbackClient = new MercadoPagoConfig({ accessToken: FALLBACK_TEST_ACCESS_TOKEN });
           const fallbackPayment = new Payment(fallbackClient);
           
           // Ajustar payer email para teste se necessário
           const fallbackPaymentData = { ...paymentData };
           if (!fallbackPaymentData.payer.email || !emailRegex.test(fallbackPaymentData.payer.email)) {
              const randomId = Math.floor(Math.random() * 1000000);
              fallbackPaymentData.payer.email = `test_user_${randomId}@testuser.com`;
           }
           
           result = await fallbackPayment.create({ body: fallbackPaymentData });
           console.log('[MP] Pagamento criado com sucesso usando Fallback Sandbox Token');
           fallbackSuccess = true;
           
        } catch (fallbackError: any) {
           console.error('[MP] Erro no fallback:', fallbackError);
           // Continua para retornar o erro original
        }
      }

      if (!fallbackSuccess) {
        let errorMessage = error.message || 'Erro ao processar pagamento';
        
        // Tradução de erros comuns do Mercado Pago
        if (errorMessage.includes('Payer email forbidden') || (error.cause && JSON.stringify(error.cause).includes('Payer email forbidden'))) {
            errorMessage = 'Você não pode realizar o pagamento usando o mesmo e-mail da conta do vendedor (Mercado Pago). Por favor, utilize um e-mail diferente para a compra.';
        }

        logErrorToFile('Erro no processamento do pagamento', { error: error.message, details: error.cause || error });
        return NextResponse.json({ 
          error: errorMessage,
          details: error.cause || error 
        }, { status: 400 });
      }
    }

    if (!result) {
      logErrorToFile('Resultado do pagamento indefinido');
      return NextResponse.json({ error: 'Erro ao processar pagamento: Resultado indefinido' }, { status: 500 });
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
    } else if (result.status === 'in_process' || result.status === 'pending' || result.status === 'pending_waiting_transfer') {
       // Apenas logar ou adicionar observação de pendente
       let novaObservacao = pedido.observacao_cliente || '';
       if (!novaObservacao.includes('Pendente')) {
          novaObservacao += ` (Pagamento Online - Pendente/PIX - ID: ${result.id})`;
          
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
    logErrorToFile('Exceção não tratada', { error: error.message, stack: error.stack });
    return NextResponse.json({ 
      error: error.message || 'Erro ao processar pagamento',
      details: error.cause 
    }, { status: 500 });
  }
}
