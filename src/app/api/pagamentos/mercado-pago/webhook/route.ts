import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { OrderStatus } from '@/types/orderStatus';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: Request) {
  try {
    const url = new URL(request.url);
    const estabelecimentoId = url.searchParams.get('estabelecimento_id');
    
    // O MP pode enviar type na query string ou body
    let body;
    try {
        body = await request.json();
    } catch (e) {
        body = {};
    }

    // Log para debug
    console.log('[Webhook MP] Recebido:', { 
        query: Object.fromEntries(url.searchParams), 
        bodyType: body.type,
        bodyTopic: body.topic,
        bodyAction: body.action,
        estabelecimentoId 
    });

    const type = body.type || url.searchParams.get('type') || url.searchParams.get('topic') || body.topic;
    // O ID pode vir em data.id (v1) ou id (v0/query)
    const id = body.data?.id || body.id || url.searchParams.get('data.id') || url.searchParams.get('id');

    // Se for notificação de teste de criação (comum ao configurar webhook)
    if (body.action === 'test.created') {
        console.log('[Webhook MP] Teste de webhook recebido com sucesso.');
        return NextResponse.json({ status: 'ok' });
    }

    if (!id || !estabelecimentoId) {
        // Se não tem ID ou estabelecimento, ignorar mas responder 200 para evitar retries infinitos se for algo irrelevante
        return NextResponse.json({ status: 'ignored', reason: 'missing_id_or_establishment' });
    }

    // O tópico 'payment' é usado para notificar sobre pagamentos criados/atualizados
    if (type === 'payment' || body.action?.startsWith('payment.')) {
        // 1. Buscar credenciais do estabelecimento
        const { data: configMp, error: configError } = await supabaseAdmin
            .from('configuracoes_mercadopago')
            .select('*')
            .eq('estabelecimento_id', estabelecimentoId)
            .single();

        if (configError || !configMp) {
            console.error('[Webhook MP] Configuração não encontrada para estabelecimento:', estabelecimentoId);
            return NextResponse.json({ error: 'Config not found' }, { status: 200 }); 
        }

        const accessToken = configMp.ambiente === 'producao' 
            ? configMp.access_token_producao 
            : configMp.access_token_teste;

        if (!accessToken) {
             console.error('[Webhook MP] Token não encontrado para estabelecimento:', estabelecimentoId);
             return NextResponse.json({ error: 'Token not found' }, { status: 200 });
        }

        // 2. Verificar pagamento na API do MP
        const client = new MercadoPagoConfig({ accessToken: accessToken });
        const payment = new Payment(client);
        
        try {
            const paymentInfo = await payment.get({ id });
            console.log(`[Webhook MP] Pagamento ${id} - Status: ${paymentInfo.status} - Ref: ${paymentInfo.external_reference}`);
            
            // 3. Atualizar pedido
            if (paymentInfo.external_reference) {
                const pedidoId = paymentInfo.external_reference;
                
                // Buscar pedido atual
                const { data: pedido, error: pedidoError } = await supabaseAdmin
                    .from('pedidos')
                    .select('id, status_pedido, observacao_cliente')
                    .eq('id', pedidoId)
                    .single();

                if (pedidoError || !pedido) {
                     console.error('[Webhook MP] Pedido não encontrado:', pedidoId);
                     return NextResponse.json({ error: 'Order not found' }, { status: 200 });
                }

                // Lógica de Atualização
                if (paymentInfo.status === 'approved') {
                    const statusAtual = pedido.status_pedido;
                    
                    // Se o pedido ainda está "Pedindo" (inicial), mudar para "Pedido Confirmado"
                    let novoStatus = statusAtual;
                    if (statusAtual === OrderStatus.PEDINDO) {
                        novoStatus = OrderStatus.CONFIRMADO;
                    }

                    // Tentar processar estoque se estiver confirmando agora
                    if (novoStatus === OrderStatus.CONFIRMADO && statusAtual !== OrderStatus.CONFIRMADO) {
                        try {
                            // Import dinâmico para evitar dependências circulares ou problemas de init
                            const { processStockDeduction } = await import('@/services/stockService');
                            const stockResult = await processStockDeduction(pedidoId);
                            
                            if (!stockResult.success) {
                                console.error(`[Webhook MP] Falha ao deduzir estoque para pedido ${pedidoId}: ${stockResult.error}`);
                                // Opcional: Adicionar erro na observação para visibilidade
                                // novaObservacao += ` | ALERTA: Erro ao baixar estoque: ${stockResult.error}`;
                            } else {
                                console.log(`[Webhook MP] Estoque deduzido com sucesso para pedido ${pedidoId}`);
                            }
                        } catch (stockErr) {
                            console.error(`[Webhook MP] Erro fatal ao chamar serviço de estoque:`, stockErr);
                        }
                    }

                    // Atualizar Observação
                    let novaObservacao = pedido.observacao_cliente || '';
                    if (novaObservacao.includes('(Pagamento Online - Pendente)')) {
                        novaObservacao = novaObservacao.replace('(Pagamento Online - Pendente)', `(Pagamento Online - APROVADO - ID: ${id})`);
                    } else if (!novaObservacao.includes('Pagamento Online - APROVADO')) {
                         novaObservacao += ` (Pagamento Online - APROVADO - ID: ${id})`;
                    }

                    // Só atualiza se houver mudança
                    if (novoStatus !== statusAtual || novaObservacao !== pedido.observacao_cliente) {
                        await supabaseAdmin
                            .from('pedidos')
                            .update({ 
                                status_pedido: novoStatus,
                                observacao_cliente: novaObservacao.trim()
                            })
                            .eq('id', pedidoId);
                            
                        console.log(`[Webhook MP] Pedido ${pedidoId} atualizado para ${novoStatus}`);
                    } else {
                        console.log(`[Webhook MP] Pedido ${pedidoId} já estava atualizado.`);
                    }

                } else if (paymentInfo.status === 'rejected' || paymentInfo.status === 'cancelled') {
                    // Se rejeitado/cancelado, restaurar estoque se necessário
                    try {
                        const { processStockReturn } = await import('@/services/stockService');
                        
                        // Determinar motivo correto
                        let reason = `Pagamento ${paymentInfo.status}`;
                        // Verifica se foi expirado (status_detail costuma ser 'expired' ou similar em caso de cancelamento por timeout)
                        if (paymentInfo.status_detail === 'expired' || paymentInfo.status === 'cancelled') {
                             // Se cancelado, assumimos expirado se não houver outro detalhe claro, ou se for PIX
                             reason = 'PIX Expirado';
                        }
                        
                        const stockResult = await processStockReturn(pedidoId, reason);
                        
                        if (!stockResult.success) {
                             console.error(`[Webhook MP] Falha ao retornar estoque para pedido ${pedidoId}: ${stockResult.error}`);
                        } else {
                             console.log(`[Webhook MP] Estoque retornado com sucesso para pedido ${pedidoId}`);
                        }
                    } catch (stockErr) {
                        console.error(`[Webhook MP] Erro fatal ao chamar serviço de estoque (retorno):`, stockErr);
                    }

                    // Atualizar observação
                    let novaObservacao = pedido.observacao_cliente || '';
                     if (novaObservacao.includes('(Pagamento Online - Pendente)')) {
                         novaObservacao = novaObservacao.replace('(Pagamento Online - Pendente)', '(Pagamento Online - FALHOU)');
                     } else if (!novaObservacao.includes('FALHOU') && !novaObservacao.includes('APROVADO')) {
                         novaObservacao += ` (Pagamento Online - ${paymentInfo.status?.toUpperCase()})`;
                     }
                     
                     // Se cancelado, atualizar status do pedido também
                     let novoStatus = pedido.status_pedido;
                     if (paymentInfo.status === 'cancelled') {
                         novoStatus = OrderStatus.CANCELADO_ESTABELECIMENTO; // Ou Cancelado Pelo Cliente? Melhor estabelecimento/sistema
                     }

                     if (novoStatus !== pedido.status_pedido || novaObservacao !== pedido.observacao_cliente) {
                        await supabaseAdmin
                            .from('pedidos')
                            .update({ 
                                status_pedido: novoStatus,
                                observacao_cliente: novaObservacao.trim() 
                            })
                            .eq('id', pedidoId);
                            
                        console.log(`[Webhook MP] Pedido ${pedidoId} atualizado (Pagamento Falhou/Cancelado)`);
                     }
                }
            }
        } catch (mpError) {
            console.error('[Webhook MP] Erro ao consultar API MP:', mpError);
            // Retorna 200 para o MP parar de tentar se for erro de lógica nossa, 
            // mas se for erro de rede, talvez 500 fosse melhor. 
            // Por segurança, retornamos 200 com log de erro.
        }
    }

    return NextResponse.json({ status: 'ok' });
  } catch (e) {
      console.error('[Webhook MP] Erro fatal:', e);
      return NextResponse.json({ status: 'error' }, { status: 500 });
  }
}
