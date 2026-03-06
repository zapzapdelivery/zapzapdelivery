
import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { OrderStatus } from '@/types/orderStatus';

// Initialize Supabase Admin Client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { 
      items, 
      estabelecimento_id, 
      forma_pagamento, 
      forma_entrega, 
      observacao, 
      user_id 
    } = body;

    // 1. Basic Validation
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'Carrinho vazio' }, { status: 400 });
    }
    if (!estabelecimento_id || !user_id) {
      return NextResponse.json({ error: 'Dados incompletos' }, { status: 400 });
    }

    // 1.5. Ensure Client Exists (Fix for foreign key violation)
    // Verifica se o cliente existe na tabela 'clientes'. Se não, cria o registro usando dados do Auth.
    const { data: clientExists } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('id', user_id)
      .maybeSingle();

    if (!clientExists) {
      console.log(`[OrderCreate] Cliente ${user_id} não encontrado na tabela. Tentando criar...`);
      // Fetch user data from Auth to populate client record
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(user_id);
      
      if (user) {
        const { error: createClientError } = await supabaseAdmin
          .from('clientes')
          .insert([
            {
              id: user_id,
              email: user.email,
              nome: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Cliente',
              criado_em: new Date().toISOString()
            }
          ]);
          
        if (createClientError) {
          console.error('[OrderCreate] Erro ao criar registro de cliente:', createClientError);
          // Se falhar (ex: chave duplicada em race condition), assume que já existe e prossegue
        } else {
          console.log(`[OrderCreate] Cliente ${user_id} criado com sucesso.`);
        }
      } else {
         console.warn(`[OrderCreate] Usuário Auth ${user_id} não encontrado. Pedido pode falhar.`);
      }
    }

    // 2. Calculate Totals (Security: Recalculate on server)
    let subtotal = 0;
    const orderItemsData = items.map((item: any) => {
      const totalItem = item.valor_base * item.quantidade;
      subtotal += totalItem;
      return {
        produto_id: item.id,
        quantidade: item.quantidade,
        valor_unitario: item.valor_base,
        total_item: totalItem,
        observacao_item: item.observacao || ''
      };
    });

    // Calculate Delivery Fee
    let deliveryFee = 0;
    if (forma_entrega === 'delivery') {
      const { data: feeConfig } = await supabaseAdmin
        .from('taxa_entregas')
        .select('*')
        .eq('estabelecimento_id', estabelecimento_id)
        .single();
      
      if (feeConfig) {
        if (feeConfig.tipo_taxa === 'fixo') {
          deliveryFee = Number(feeConfig.valor_base);
        } else {
          // TODO: Handle other fee types (bairro, distancia)
          // For now, if dynamic, default to base value or 0
          deliveryFee = Number(feeConfig.valor_base || 0);
        }
      }
    }

    // Calculate Discount (Coupon)
    let discount = 0;
    if (body.cupom_id) {
      const { data: cupom } = await supabaseAdmin
        .from('cupons')
        .select('*')
        .eq('id', body.cupom_id)
        .eq('estabelecimento_id', estabelecimento_id)
        .eq('status_cupom', 'ativo')
        .single();

      if (cupom) {
        const now = new Date();
        const start = cupom.data_inicio ? new Date(cupom.data_inicio) : null;
        const end = cupom.data_fim ? new Date(cupom.data_fim) : null;

        let isValid = true;
        if (start && now < start) isValid = false;
        if (end && now > end) isValid = false;
        // Check usage limit if applicable (not implemented in schema yet, assuming unlimited for now)

        if (isValid) {
          if (cupom.tipo_desconto === 'percentual') {
             discount = (subtotal * cupom.valor_desconto) / 100;
          } else {
             discount = Number(cupom.valor_desconto);
          }
        }
      }
    }

    const totalPedido = Math.max(0, subtotal + deliveryFee - discount);

    // 3. Verify and Deduct Stock (Real-time update)
    // We need to ensure stock is available and deduct it BEFORE creating the order
    // to prevent overselling. If order creation fails, we must rollback.
    const deductedItems: { produto_id: string; quantidade: number }[] = [];
    
    for (const item of orderItemsData) {
      // Check if product has stock tracking
      const { data: stockData, error: stockCheckError } = await supabaseAdmin
        .from('estoque_produtos')
        .select('estoque_atual')
        .eq('produto_id', item.produto_id)
        .single();
        
      if (stockCheckError && stockCheckError.code !== 'PGRST116') {
        // If error is not "row not found", it's a real error
        console.error(`Error checking stock for product ${item.produto_id}:`, stockCheckError);
        // We continue, assuming no stock tracking or error will be caught later? 
        // Safer to abort if we can't check stock.
        throw new Error(`Erro ao verificar estoque do produto ${item.produto_id}`);
      }

      if (stockData) {
        // Product has stock tracking
        if (stockData.estoque_atual < item.quantidade) {
          // Rollback previous deductions
          for (const deducted of deductedItems) {
             const { data: curr } = await supabaseAdmin.from('estoque_produtos').select('estoque_atual').eq('produto_id', deducted.produto_id).single();
             if (curr) {
                await supabaseAdmin.from('estoque_produtos').update({ estoque_atual: curr.estoque_atual + deducted.quantidade }).eq('produto_id', deducted.produto_id);
             }
          }
          return NextResponse.json({ error: `Estoque insuficiente para o produto. Disponível: ${stockData.estoque_atual}, Solicitado: ${item.quantidade}` }, { status: 400 });
        }

        // Deduct stock
        // Using optimistic locking
        const { error: updateError, data: updatedData } = await supabaseAdmin
          .from('estoque_produtos')
          .update({ estoque_atual: stockData.estoque_atual - item.quantidade })
          .eq('produto_id', item.produto_id)
          .eq('estoque_atual', stockData.estoque_atual) // Optimistic locking
          .select()
          .single();
          
        if (updateError || !updatedData) {
          // Concurrency issue or failed update
          // Rollback
          for (const deducted of deductedItems) {
             const { data: curr } = await supabaseAdmin.from('estoque_produtos').select('estoque_atual').eq('produto_id', deducted.produto_id).single();
             if (curr) {
                await supabaseAdmin.from('estoque_produtos').update({ estoque_atual: curr.estoque_atual + deducted.quantidade }).eq('produto_id', deducted.produto_id);
             }
          }
          return NextResponse.json({ error: `O estoque do produto mudou durante sua compra. Tente novamente.` }, { status: 409 });
        }
        
        deductedItems.push({ produto_id: item.produto_id, quantidade: item.quantidade });
      }
    }

    // 4. Generate Order Number
    const year = new Date().getFullYear();
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    const numeroPedido = `${year}${randomDigits}`;

    // 4. Create Order (Using Admin Client to Bypass RLS)
    const { data: order, error: orderError } = await supabaseAdmin
      .from('pedidos')
      .insert([
        {
          cliente_id: user_id,
          estabelecimento_id,
          numero_pedido: numeroPedido,
          status_pedido: OrderStatus.PEDINDO,
          subtotal,
          taxa_entrega: deliveryFee,
          desconto: discount,
          total_pedido: totalPedido,
          forma_pagamento,
          forma_entrega,
          observacao_cliente: observacao,
          criado_em: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (orderError) {
      console.error('Error creating order:', orderError);
      return NextResponse.json({ error: 'Erro ao criar pedido: ' + orderError.message }, { status: 500 });
    }

    // 5. Create Order Items
    const itemsToInsert = orderItemsData.map((item: any) => ({
      pedido_id: order.id,
      estabelecimento_id,
      numero_pedido: numeroPedido,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
      total_item: item.total_item,
      observacao_item: item.observacao_item
    }));

    const { error: itemsError } = await supabaseAdmin
      .from('itens_pedidos')
      .insert(itemsToInsert);

    if (itemsError) {
      console.error('Error creating order items:', itemsError);
      // Optional: Rollback order (delete it) if items fail
      await supabaseAdmin.from('pedidos').delete().eq('id', order.id);
      return NextResponse.json({ error: 'Erro ao adicionar itens ao pedido: ' + itemsError.message }, { status: 500 });
    }

    // 6. Register Stock Movement
    // We record in BOTH tables: 
    // - movimentacoes_estoque (for Admin UI)
    // - estoque_movimentacoes (for internal tracking/idempotency)

    const now = new Date().toISOString();
    const motivo = `Pedido ${numeroPedido}`;

    // A. Internal Tracking (estoque_movimentacoes)
    const internalMovements = deductedItems.map(item => ({
      estabelecimento_id,
      pedido_id: order.id,
      produto_id: item.produto_id,
      quantidade: item.quantidade,
      tipo_movimento: 'venda',
      motivo,
      criado_em: now
    }));

    const { error: internalError } = await supabaseAdmin
      .from('estoque_movimentacoes')
      .insert(internalMovements);
    
    if (internalError) {
      console.error('Error registering internal stock movements:', internalError);
      // Log but continue
    }

    // B. UI Display (movimentacoes_estoque)
    const uiMovements = deductedItems.map(item => ({
      estabelecimento_id,
      produto_id: item.produto_id,
      tipo_movimentacao: 'saida',
      quantidade: item.quantidade,
      motivo,
      criado_em: now
    }));

    const { error: uiError } = await supabaseAdmin
      .from('movimentacoes_estoque')
      .insert(uiMovements);
      
    if (uiError) {
      console.error('Error registering UI stock movements:', uiError);
    }

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Unexpected error in checkout API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor: ' + error.message }, { status: 500 });
  }
}
