import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  
  const { role, isSuperAdmin, establishmentId: userEstablishmentId, error: authError, status } = await getAuthContext(request);
  
  if (authError) {
    return NextResponse.json({ error: authError }, { status: status || 401 });
  }

  const { id } = await props.params;

  // Permite acesso se:
  // 1. For Super Admin
  // 2. For Parceiro
  // 3. For o próprio estabelecimento acessando seus dados
  // 4. For um atendente do estabelecimento acessando os dados do seu estabelecimento
  const isOwner = userEstablishmentId === id;
  const isAllowed = isSuperAdmin || role === 'parceiro' || (isOwner && (role === 'estabelecimento' || role === 'atendente'));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
  }
  try {
    const { data, error } = await supabaseAdmin
      .from('estabelecimentos')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    const e: any = data;
    const normalized = {
      id: e?.id,
      name:
        e?.name ??
        e?.nome ??
        e?.nome_estabelecimento ??
        e?.fantasia ??
        e?.legal_name ??
        'Estabelecimento',
      legalName: e?.legal_name ?? e?.razao_social ?? '',
      document: e?.cnpj_cpf ?? e?.documento ?? e?.cnpj ?? e?.cpf ?? '',
      email: e?.email ?? '',
      phone: e?.telefone ?? e?.phone ?? '',
      whatsappMain: e?.whatsapp_principal ?? e?.whatsapp_main ?? '',
      whatsappKitchen: e?.whatsapp_cozinha ?? e?.whatsapp_kitchen ?? '',
      cep: e?.cep ?? '',
      address: e?.endereco ?? e?.address ?? '',
      number: e?.numero ?? e?.number ?? '',
      complement: e?.complemento ?? e?.complement ?? '',
      neighborhood: e?.bairro ?? e?.neighborhood ?? '',
      city: e?.cidade ?? e?.city ?? '',
      state: e?.uf ?? e?.estado ?? e?.state ?? '',
      logoUrl: e?.logo_url ?? e?.logoUrl ?? e?.imagem_estabelecimento_url ?? '',
      url_cardapio: e?.url_cardapio ?? '',
      partner: e?.parceiro_id ?? e?.partner_id ?? e?.parceiro ?? '',
      planId: e?.plano_id ?? e?.plano_assinatura_id ?? e?.plan_id ?? '',
      tipo_estabelecimento_id: e?.tipo_estabelecimento_id ?? '',
      attendantName: e?.nome_atendente_ia ?? e?.nome_atendente ?? '',
      attendantWhatsapp: e?.whatsapp_atendente_ia ?? e?.whatsapp_atendente ?? '',
      baseUrl: e?.baseurl ?? e?.base_url ?? e?.url_base ?? '',
      instance: e?.instancia ?? e?.instance ?? '',
      apiKey: e?.apikey ?? e?.api_key ?? '',
      isActive: (e?.status_estabelecimento ?? e?.status) === 'ativo' || e?.ativo === true || e?.is_active === true,
      created_at: e?.created_at ?? e?.criado_em ?? null,
    };
    return NextResponse.json(normalized);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  
  const { role, error: authError, status } = await getAuthContext(request);
  
  if (authError) {
    return NextResponse.json({ error: authError }, { status: status || 401 });
  }

  if (role === 'estabelecimento' || role === 'atendente') {
    return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
  }

  const { id } = await props.params;
  try {
    // 1. Fetch establishment to get logo_url/capa_url and delete images
    const { data: estData, error: fetchEstError } = await supabaseAdmin
      .from('estabelecimentos')
      .select('*') // Select all to catch potential image fields
      .eq('id', id)
      .single();

    if (!fetchEstError && estData) {
      const bucket = 'establishments';
      const imagesToDelete = [];
      
      if (estData.logo_url) imagesToDelete.push(estData.logo_url);
      if (estData.capa_url) imagesToDelete.push(estData.capa_url); // Assuming capa_url exists
      // Check for other potential field names
      if (estData.logoUrl) imagesToDelete.push(estData.logoUrl);
      
      for (const url of imagesToDelete) {
        try {
          const urlObj = new URL(url);
          const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
          if (pathParts.length === 2) {
            const path = decodeURIComponent(pathParts[1]);
            await supabaseAdmin.storage.from(bucket).remove([path]);
          }
        } catch (e) {
          console.warn('Error deleting establishment image:', e);
        }
      }
    }

    const { data: users, error: fetchUsersError } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('estabelecimento_id', id);

    if (fetchUsersError) {
      console.error('Erro ao buscar usuários do estabelecimento:', fetchUsersError);
      return NextResponse.json({ error: 'Erro ao buscar usuários vinculados' }, { status: 500 });
    }

    // 2. Para cada usuário, deletar do Supabase Auth e da tabela usuarios
    if (users && users.length > 0) {
      const deletePromises = users.map(async (user) => {
        // Deletar do Auth
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (authError) {
          console.error(`Erro ao deletar usuário Auth ${user.id}:`, authError);
          // Não lançar erro aqui para tentar deletar os outros
        }
        
        // Deletar da tabela usuarios (redundante se houver cascade no banco, mas garante limpeza)
        // Se a constraint for CASCADE, deletar do Auth pode já ter deletado daqui se o ID for o mesmo.
        // Mas vamos forçar a exclusão para garantir.
        const { error: dbError } = await supabaseAdmin
          .from('usuarios')
          .delete()
          .eq('id', user.id);
          
        if (dbError) {
           console.error(`Erro ao deletar usuário DB ${user.id}:`, dbError);
        }
      });

      await Promise.all(deletePromises);
    }

    // 3. Deletar o estabelecimento
    const { error } = await supabaseAdmin
      .from('estabelecimentos')
      .delete()
      .eq('id', id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ ok: true, id });
  } catch (err: any) {
    const message = err?.message || 'Unexpected error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const {
    role,
    isSuperAdmin,
    establishmentId: userEstablishmentId,
    error: authError,
    status,
  } = await getAuthContext(request);
  
  if (authError) {
    return NextResponse.json({ error: authError }, { status: status || 401 });
  }

  const { id } = await props.params;

  const isOwner = userEstablishmentId === id;
  const isAllowed =
    isSuperAdmin ||
    role === 'parceiro' ||
    (isOwner && (role === 'estabelecimento' || role === 'atendente'));

  if (!isAllowed) {
    return NextResponse.json({ error: 'Acesso negado para este tipo de usuário' }, { status: 403 });
  }
  const body = await request.json();

  try {
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

    const updateObj: Record<string, any> = {
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
        updateObj['plano_id'] = body.planId;
      } else if (available.has('plano_assinatura_id')) {
        updateObj['plano_assinatura_id'] = body.planId;
      } else if (available.has('plan_id')) {
        updateObj['plan_id'] = body.planId;
      }
    }

    if (available.has('status_estabelecimento')) {
      updateObj['status_estabelecimento'] = body.isActive ? 'ativo' : 'inativo';
    } else if (available.has('status')) {
      updateObj['status'] = body.isActive ? 'ativo' : 'inativo';
    } else if (available.has('ativo')) {
      updateObj['ativo'] = !!body.isActive;
    } else if (available.has('is_active')) {
      updateObj['is_active'] = !!body.isActive;
    }

    const { data, error } = await supabaseAdmin
      .from('estabelecimentos')
      .update(updateObj)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Unexpected error' }, { status: 500 });
  }
}
