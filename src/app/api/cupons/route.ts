import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase Admin client not configured' },
      { status: 500 }
    );
  }

  try {
    const ctx = await getAuthContext(request);
    const { role, establishmentId, isSuperAdmin, error, status } = ctx;

    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'parceiro')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const {
      estabelecimento_id,
      codigo_cupom,
      tipo_desconto,
      valor_desconto,
      limite_uso,
      data_inicio,
      data_fim,
      status_cupom,
    } = body || {};

    if (!codigo_cupom || typeof codigo_cupom !== 'string' || !codigo_cupom.trim()) {
      return NextResponse.json(
        { error: 'Código do cupom é obrigatório' },
        { status: 400 }
      );
    }

    const allowedTypes = ['percentual', 'fixo'];
    if (!tipo_desconto || !allowedTypes.includes(tipo_desconto)) {
      return NextResponse.json(
        { error: 'Tipo de desconto inválido' },
        { status: 400 }
      );
    }

    const numericValor =
      typeof valor_desconto === 'number'
        ? valor_desconto
        : parseFloat(String(valor_desconto).replace(',', '.'));

    if (Number.isNaN(numericValor) || numericValor <= 0) {
      return NextResponse.json(
        { error: 'Valor de desconto inválido' },
        { status: 400 }
      );
    }

    let estabelecimentoIdToUse: string | null = null;
    if (isSuperAdmin || role === 'admin' || role === 'parceiro') {
      estabelecimentoIdToUse = estabelecimento_id || null;
    } else {
      estabelecimentoIdToUse = establishmentId || null;
    }

    const statusValue =
      status_cupom === 'ativo' || status_cupom === 'inativo'
        ? status_cupom
        : 'ativo';

    const insertData: Record<string, any> = {
      estabelecimento_id: estabelecimentoIdToUse,
      codigo_cupom: codigo_cupom.trim(),
      tipo_desconto,
      valor_desconto: numericValor,
      limite_uso:
        typeof limite_uso === 'number'
          ? limite_uso
          : limite_uso != null
          ? parseInt(String(limite_uso), 10) || null
          : null,
      data_inicio: data_inicio || null,
      data_fim: data_fim || null,
      status_cupom: statusValue,
    };

    // Optional: include nome_cupom if column exists
    try {
      const { data: sampleRows } = await supabaseAdmin
        .from('cupons')
        .select('*')
        .limit(1);
      const available = new Set(Object.keys(sampleRows?.[0] || {}));
      if (available.has('nome_cupom')) {
        (insertData as any).nome_cupom = String(codigo_cupom).trim();
      }
    } catch {
      // ignore discovery errors, proceed without nome_cupom
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('cupons')
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (err: any) {
    console.error('Error creating coupon:', err);
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao criar cupom' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json(
      { error: 'Supabase Admin client not configured' },
      { status: 500 }
    );
  }

  try {
    const { role, establishmentId, isSuperAdmin, error, status } = await getAuthContext(request);
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (!role || (role !== 'admin' && role !== 'estabelecimento' && role !== 'parceiro')) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
    }

    const url = new URL(request.url);
    const idParam = url.searchParams.get('id');

    let query = supabaseAdmin
      .from('cupons')
      .select(`
        *,
        estabelecimentos (nome_estabelecimento)
      `);

    if (!isSuperAdmin) {
      if (establishmentId) {
        query = query.eq('estabelecimento_id', establishmentId);
      } else if (role === 'estabelecimento') {
        return NextResponse.json([]);
      }
    } else {
      const estabParam = url.searchParams.get('estabelecimento_id');
      if (estabParam) {
        query = query.eq('estabelecimento_id', estabParam);
      }
    }

    if (idParam) {
      query = query.eq('id', idParam);
    }

    const { data, error: fetchError } = await query
      .order('atualizado_em', { ascending: false, nullsFirst: false })
      .order('criado_em', { ascending: false });

    if (fetchError) {
      return NextResponse.json({ error: fetchError.message }, { status: 400 });
    }

    const now = new Date();
    const normalized = (data || []).map((row: any) => {
      const estab = row?.estabelecimentos || {};
      const estName = estab?.nome_estabelecimento || '';
      let statusValue = row?.status_cupom || 'ativo';
      if (row?.data_fim) {
        const endDate = new Date(row.data_fim);
        // Ajustar para o final do dia (23:59:59.999) para comparação correta
        endDate.setHours(23, 59, 59, 999);
        
        if (!Number.isNaN(endDate.getTime()) && endDate < now) {
          statusValue = 'expirado';
        }
      }
      let valueNumber: number | null = null;
      if (typeof row?.valor_desconto === 'number') {
        valueNumber = row.valor_desconto;
      } else if (typeof row?.valor_desconto === 'string') {
        const parsed = parseFloat(row.valor_desconto);
        valueNumber = Number.isNaN(parsed) ? null : parsed;
      }
      return {
        id: row.id,
        code: row.nome_cupom ?? row.codigo_cupom ?? '',
        description: null,
        type: row.tipo_desconto === 'fixo' ? 'fixo' : 'percentual',
        value: valueNumber,
        establishment: estName,
        validFrom: row.data_inicio || null,
        validTo: row.data_fim || null,
        status: statusValue,
      };
    });

    return NextResponse.json(normalized);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || 'Erro interno ao listar cupons' },
      { status: 500 }
    );
  }
}
