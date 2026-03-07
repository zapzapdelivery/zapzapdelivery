
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

export async function POST(request: Request) {
  try {
    const { codigo, estabelecimento_id, valor_pedido } = await request.json();

    if (!codigo || !estabelecimento_id) {
      return NextResponse.json(
        { error: 'Código do cupom e estabelecimento são obrigatórios' },
        { status: 400 }
      );
    }

    const normalizedCode = codigo.trim().toUpperCase();

    // Buscar cupom no banco usando os nomes corretos das colunas
    // Colunas: id, estabelecimento_id, codigo_cupom, tipo_desconto, valor_desconto, 
    // limite_uso, data_inicio, data_fim, status_cupom, criado_em, atualizado_em
    const { data: cupom, error } = await supabase
      .from('cupons')
      .select('*')
      .eq('codigo_cupom', normalizedCode)
      .eq('estabelecimento_id', estabelecimento_id)
      .eq('status_cupom', 'ativo')
      .maybeSingle();

    if (error) {
      console.error('Database error:', error);
      return NextResponse.json({ error: 'Erro ao consultar cupom' }, { status: 500 });
    }

    if (!cupom) {
      return NextResponse.json(
        { error: 'Cupom inválido ou não encontrado' },
        { status: 404 }
      );
    }

    const now = new Date();
    
    // Validar data de início
    if (cupom.data_inicio && new Date(cupom.data_inicio) > now) {
      return NextResponse.json(
        { error: 'Este cupom ainda não é válido' },
        { status: 400 }
      );
    }

    // Validar data de fim (expiração)
    if (cupom.data_fim) {
      const endDate = new Date(cupom.data_fim);
      // Ajustar para o final do dia (23:59:59.999)
      endDate.setHours(23, 59, 59, 999);
      
      if (endDate < now) {
        return NextResponse.json(
          { error: 'Este cupom expirou' },
          { status: 400 }
        );
      }
    }

    // Validar valor mínimo (coluna não existe atualmente, removido a verificação)
    /*
    if (cupom.valor_minimo && valor_pedido < cupom.valor_minimo) {
      return NextResponse.json(
        { error: `O valor mínimo para este cupom é R$ ${cupom.valor_minimo.toFixed(2)}` },
        { status: 400 }
      );
    }
    */

    // Validar limite de uso (coluna de uso atual não existe, removido a verificação)
    /*
    if (cupom.limite_uso && (cupom.quantidade_utilizada || 0) >= cupom.limite_uso) {
      return NextResponse.json(
        { error: 'Este cupom atingiu o limite máximo de usos' },
        { status: 400 }
      );
    }
    */

    // Mapear para o formato esperado pelo frontend
    const tipoFrontend = cupom.tipo_desconto === 'percentual' ? 'porcentagem' : 'valor';

    return NextResponse.json({
      success: true,
      cupom: {
        id: cupom.id,
        codigo: cupom.codigo_cupom,
        tipo: tipoFrontend,
        valor: cupom.valor_desconto,
        descricao: `Desconto de ${cupom.tipo_desconto === 'percentual' ? `${cupom.valor_desconto}%` : `R$ ${cupom.valor_desconto}`}`
      }
    });

  } catch (error: any) {
    console.error('Erro ao validar cupom:', error);
    return NextResponse.json(
      { error: 'Erro interno ao validar cupom' },
      { status: 500 }
    );
  }
}
