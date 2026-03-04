import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    const { user, error: authError, status } = await getAuthContext(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Não autenticado' }, { status: status || 401 });
    }

    // Buscar cliente_id na tabela clientes
    let clientId = user.id;
    
    // Tentar encontrar o cliente pelo ID do usuário auth
    const { data: client } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();
      
    if (client) {
      clientId = client.id;
    } else {
      // Tentar por email se ID não bater (fallback)
      const { data: clientByEmail } = await supabaseAdmin
        .from('clientes')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      
      if (clientByEmail) {
        clientId = clientByEmail.id;
      }
    }

    // 1. Contar Endereços
    // A tabela correta é enderecos_clientes
    const { count: addressesCount, error: addrError } = await supabaseAdmin
      .from('enderecos_clientes')
      .select('*', { count: 'exact', head: true })
      .eq('cliente_id', clientId);

    if (addrError) {
      console.error('Error fetching addresses count:', addrError);
    }

    // 2. Contar Cupons Disponíveis (Ativos e dentro da validade)
    const now = new Date().toISOString();
    
    // Cupons ativos são aqueles com status 'ativo' e data_fim maior que agora (ou nula, se for vitalício)
    const { count: couponsCount, error: couponError } = await supabaseAdmin
      .from('cupons')
      .select('*', { count: 'exact', head: true })
      .eq('status_cupom', 'ativo')
      .or(`data_fim.is.null,data_fim.gte.${now}`);

    if (couponError) {
      console.error('Error fetching coupons count:', couponError);
    }

    return NextResponse.json({
      addresses: addressesCount || 0,
      coupons: couponsCount || 0
    });

  } catch (err: any) {
    console.error('API Stats Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
