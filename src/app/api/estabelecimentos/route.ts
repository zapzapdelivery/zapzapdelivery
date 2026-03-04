import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { role, error: authError, status } = await getAuthContext(request);
    
    if (authError) {
      return NextResponse.json({ error: authError }, { status: status || 401 });
    }

    if (role === 'atendente') {
       return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
    }
    
    // Se for um estabelecimento, ele só deve ver a si mesmo (ou nada, dependendo da regra de negócio)
    // Para simplificar e manter a segurança, vamos permitir que estabelecimentos vejam apenas seus dados
    // mas a rota de listagem geralmente é para admin. 
    // Vamos restringir a superadmin e parceiro por enquanto.
    if (role === 'estabelecimento') {
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
    }
    
    // ... fetch logic ...


    let data: any[] | null = null;
    let error: any = null;
    try {
      const r1 = await supabaseAdmin
        .from('estabelecimentos')
        .select('*')
        .order('created_at', { ascending: false });
      data = r1.data ?? null;
      error = r1.error ?? null;
      if (error && String(error.message || '').toLowerCase().includes('column')) {
        const r2 = await supabaseAdmin
          .from('estabelecimentos')
          .select('*')
          .order('criado_em', { ascending: false });
        data = r2.data ?? null;
        error = r2.error ?? null;
      }
    } catch (e: any) {
      error = e;
    }

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const normalized = (data ?? []).map((e: any) => {
      const id = e?.id;
      const name =
        e?.name ??
        e?.nome ??
        e?.nome_estabelecimento ??
        e?.fantasia ??
        e?.legal_name ??
        'Estabelecimento';
      const city = e?.city ?? e?.cidade ?? '';
      const state = e?.state ?? e?.uf ?? e?.estado ?? '';
      const isActiveRaw = e?.status_estabelecimento ?? e?.status ?? e?.ativo ?? e?.is_active;
      const isActive = isActiveRaw === 'ativo' || isActiveRaw === true;
      const createdAt = e?.created_at ?? e?.criado_em ?? null;
      const since = createdAt ? new Date(createdAt).getFullYear() : new Date().getFullYear();
      const tipoId = e?.tipo_estabelecimento_id ?? null;
      const rating = e?.rating ?? e?.avaliacao ?? 4.0;
      const distance = 0;
      const isOpen = isActive;
      const logoUrl =
        e?.logo_url ??
        e?.logoUrl ??
        e?.imagem_estabelecimento_url ??
        e?.imagem_estabelecimento_upload ??
        null;
      return {
        id,
        name,
        city,
        state,
        isActive,
        since,
        tipo_estabelecimento_id: tipoId,
        rating,
        distance,
        isOpen,
        logoUrl,
      };
    });

    return NextResponse.json(normalized);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const { role, error: authError, status } = await getAuthContext(request);
    
    if (authError) {
      return NextResponse.json({ error: authError }, { status: status || 401 });
    }

    if (role === 'estabelecimento' || role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
    }

    const body = await request.json();
    const { data: sampleRows } = await supabaseAdmin
      .from('estabelecimentos')
      .select('*')
      .limit(1);
    const available = new Set(Object.keys(sampleRows?.[0] || {}));

    const choose = (candidates: string[], value: any, normalize?: (v: any) => any) => {
      for (const key of candidates) {
        if (available.has(key)) {
          return { [key]: normalize ? normalize(value) : value };
        }
      }
      return {};
    };

    const insertObj: Record<string, any> = {
      ...choose(['nome_estabelecimento','nome','name','nome_fantasia','fantasia'], body.name),
      ...choose(['razao_social','legal_name'], body.legalName),
      ...choose(['cnpj_cpf','documento','cnpj','cpf'], body.document),
      ...choose(['email'], body.email),
      ...choose(['telefone','phone'], body.phone),
      ...choose(['whatsapp_principal','whatsapp_main'], body.whatsappMain),
      ...choose(['whatsapp_cozinha','whatsapp_kitchen'], body.whatsappKitchen),
      ...choose(['nome_atendente_ia','nome_atendente'], body.attendantName),
      ...choose(['whatsapp_atendente_ia','whatsapp_atendente'], body.attendantWhatsapp),
      ...choose(['cep'], body.cep),
      ...choose(['endereco','address'], body.address),
      ...choose(['numero','number'], body.number),
      ...choose(['complemento','complement'], body.complement),
      ...choose(['bairro','neighborhood'], body.neighborhood),
      ...choose(['cidade','city'], body.city),
      ...choose(['uf','estado','state'], body.state),
      ...choose(['logo_url','logoUrl','imagem_estabelecimento_url','imagem_estabelecimento_upload'], body.logoUrl),
      ...choose(['url_cardapio'], body.url_cardapio),
      ...choose(['baseurl','base_url','url_base'], body.baseUrl),
      ...choose(['instancia','instance'], body.instance),
      ...choose(['apikey','api_key'], body.apiKey),
      ...choose(['parceiro_id','partner_id','parceiro'], body.partner),
      ...choose(['tipo_estabelecimento_id'], body.tipo_estabelecimento_id),
    };

    if (body.planId) {
      if (available.has('plano_id')) {
        insertObj['plano_id'] = body.planId;
      } else if (available.has('plano_assinatura_id')) {
        insertObj['plano_assinatura_id'] = body.planId;
      } else if (available.has('plan_id')) {
        insertObj['plan_id'] = body.planId;
      }
    }

    if (available.has('status_estabelecimento')) {
      insertObj['status_estabelecimento'] = body.isActive ? 'ativo' : 'inativo';
    } else if (available.has('status')) {
      insertObj['status'] = body.isActive ? 'ativo' : 'inativo';
    } else if (available.has('ativo')) {
      insertObj['ativo'] = !!body.isActive;
    } else if (available.has('is_active')) {
      insertObj['is_active'] = !!body.isActive;
    }

    // Fallback minimal required keys if table is empty (best guess)
    if (sampleRows?.length === 0) {
      insertObj['nome_estabelecimento'] = insertObj['nome_estabelecimento'] ?? body.name ?? 'Estabelecimento';
      insertObj['cidade'] = insertObj['cidade'] ?? body.city ?? '';
      insertObj['uf'] = insertObj['uf'] ?? body.state ?? '';
      insertObj['tipo_estabelecimento_id'] = insertObj['tipo_estabelecimento_id'] ?? body.tipo_estabelecimento_id ?? null;
      insertObj['plano_assinatura_id'] = insertObj['plano_assinatura_id'] ?? body.planId ?? null;
      insertObj['parceiro_id'] = insertObj['parceiro_id'] ?? body.partner ?? null;
      insertObj['status'] = insertObj['status'] ?? (body.isActive ? 'ativo' : 'inativo');
      insertObj['url_cardapio'] = insertObj['url_cardapio'] ?? body.url_cardapio ?? null;
    }

    const { data, error } = await supabaseAdmin
      .from('estabelecimentos')
      .insert([insertObj])
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    const message = err?.message || 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
