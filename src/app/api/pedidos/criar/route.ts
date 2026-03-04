
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

    // 3. Generate Order Number
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

    return NextResponse.json({ success: true, order });

  } catch (error: any) {
    console.error('Unexpected error in checkout API:', error);
    return NextResponse.json({ error: 'Erro interno do servidor: ' + error.message }, { status: 500 });
  }
}
