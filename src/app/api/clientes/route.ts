import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import fs from 'fs';
import path from 'path';

function logErrorToFile(error: any) {
  try {
    const logPath = path.join(process.cwd(), 'api-error.log');
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] Error in /api/clientes: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}\n`;
    fs.appendFileSync(logPath, message);
  } catch (e) {
    console.error('Failed to write to log file:', e);
  }
}

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    logErrorToFile({ message: 'Supabase Admin client not configured' });
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);
    
    if (error) {
      logErrorToFile({ message: 'Auth Error', error, status });
      return NextResponse.json({ error }, { status: status || 401 });
    }

    let query = supabaseAdmin
      .from('clientes')
      .select('*')
      .order('criado_em', { ascending: false });

    if (!isSuperAdmin) {
        if (establishmentId) {
            query = query.eq('estabelecimento_id', establishmentId);
        } else {
             // Se não tiver estabelecimento e não for super admin, retorna vazio ou erro?
             // Vamos retornar vazio por segurança se não conseguir determinar o contexto
             if (role !== 'admin') { // Assumindo que admin pode ver tudo, mas aqui estamos filtrando
                // Se for um usuário comum sem estabelecimento vinculado (o que não deve acontecer para logados nessa tela)
                // Retorna lista vazia
                return NextResponse.json([]);
             }
        }
    }

    const { data: clients, error: clientsError } = await query;

    if (clientsError) {
      logErrorToFile({ message: 'Query Error', error: clientsError });
      throw clientsError;
    }

    // Buscar último pedido para cada cliente
    const clientIds = clients.map((c: any) => c.id);
    
    let ordersMap = new Map();
    if (clientIds.length > 0) {
        const { data: lastOrders, error: ordersError } = await supabaseAdmin
            .from('pedidos')
            .select('cliente_id, criado_em')
            .in('cliente_id', clientIds)
            .order('criado_em', { ascending: false });
        
        if (ordersError) {
            logErrorToFile({ message: 'Orders Query Error', error: ordersError });
            // Don't throw, just ignore orders
        } else if (lastOrders) {
            // Como ordenamos por criado_em desc, o primeiro encontro de cada cliente é o mais recente
            lastOrders.forEach((o: any) => {
                if (!ordersMap.has(o.cliente_id)) {
                    ordersMap.set(o.cliente_id, o.criado_em);
                }
            });
        }
    }

    const formattedClients = clients.map((client: any) => {
      // Normalize status to handle case sensitivity (ativo/Ativo)
      const rawStatus = client.status_cliente || 'ativo';
      const normalizedStatus = rawStatus.toLowerCase();
      const status = normalizedStatus === 'ativo' ? 'Ativo' : 'Inativo';

      return {
        id: client.id,
        name: client.nome_cliente || 'Sem Nome',
        email: client.email || '-',
        phone: client.telefone || '-',
        cpf: client.cpf || '-',
        status: status,
        avatar_url: client.imagem_cliente_url,
        lastOrder: ordersMap.get(client.id) || null,
        criado_em: client.criado_em
      };
    });

    return NextResponse.json(formattedClients);
  } catch (err: any) {
    logErrorToFile(err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    logErrorToFile({ message: 'Supabase Admin client not configured' });
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);

    if (error) {
      logErrorToFile({ message: 'Auth Error', error, status });
      return NextResponse.json({ error }, { status: status || 401 });
    }

    const body = await request.json();
    const { 
        estabelecimento_id, 
        nome_cliente, 
        email, 
        cpf, 
        telefone, 
        status_cliente, 
        imagem_cliente_url,
        senha,
        // Address fields
        cep,
        endereco,
        numero,
        complemento,
        bairro,
        cidade,
        uf,
        ponto_referencia,
        tipo_endereco
    } = body;

    // Validation
    if (!nome_cliente) {
        return NextResponse.json({ error: 'Nome do cliente é obrigatório' }, { status: 400 });
    }

    // Check for duplicates (Email, CPF, Telefone)
    const duplicateChecks = [];
    if (email) duplicateChecks.push(supabaseAdmin.from('clientes').select('id').eq('email', email).maybeSingle());
    if (cpf) duplicateChecks.push(supabaseAdmin.from('clientes').select('id').eq('cpf', cpf).maybeSingle());
    if (telefone) duplicateChecks.push(supabaseAdmin.from('clientes').select('id').eq('telefone', telefone).maybeSingle());

    if (duplicateChecks.length > 0) {
        const results = await Promise.all(duplicateChecks);
        for (let i = 0; i < results.length; i++) {
            const { data: existing } = results[i];
            if (existing) {
                let field = '';
                if (email && i === 0) field = 'E-mail';
                else if (cpf && (email ? i === 1 : i === 0)) field = 'CPF';
                else field = 'Telefone';
                
                return NextResponse.json({ error: `Já existe um cliente cadastrado com este ${field}` }, { status: 400 });
            }
        }
    }

    // Determine target establishment
    let targetEstablishmentId = establishmentId;
    
    if (isSuperAdmin) {
        if (!estabelecimento_id) {
             return NextResponse.json({ error: 'Estabelecimento é obrigatório para admin' }, { status: 400 });
        }
        targetEstablishmentId = estabelecimento_id;
    } else {
        // Regular user must create in their own establishment
        if (!targetEstablishmentId) {
             return NextResponse.json({ error: 'Usuário sem estabelecimento vinculado' }, { status: 403 });
        }
    }

    // 1. Create/Get Auth User First (Mandatory as per user requirement)
    if (!senha || !email) {
        return NextResponse.json({ error: 'E-mail e senha são obrigatórios para cadastrar um cliente' }, { status: 400 });
    }

    let userId: string | null = null;
    
    try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: senha,
            email_confirm: true,
            user_metadata: {
                name: nome_cliente,
                avatar_url: imagem_cliente_url
            }
        });

        if (authError) {
            // If user exists, try to get it
            const listed = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
            const existing = (listed?.data?.users || []).find((u: any) => 
                String(u?.email || '').toLowerCase() === String(email || '').toLowerCase()
            );
            
            if (existing) {
                userId = existing.id;
                await supabaseAdmin.auth.admin.updateUserById(userId, { password: senha });
            } else {
                logErrorToFile({ message: 'Auth Creation Error', error: authError });
                return NextResponse.json({ error: 'Erro ao criar usuário de autenticação: ' + authError.message }, { status: 500 });
            }
        } else {
            userId = authUser.user.id;
        }
    } catch (authProcessError) {
        logErrorToFile({ message: 'Auth Process Error', error: authProcessError });
        return NextResponse.json({ error: 'Erro crítico no processo de autenticação' }, { status: 500 });
    }

    if (!userId) {
        return NextResponse.json({ error: 'Não foi possível gerar um ID de usuário' }, { status: 500 });
    }

    // 2. Get 'cliente' role type
    const { data: tipo, error: tipoError } = await supabaseAdmin
        .from('tipos_usuarios')
        .select('id, nome_tipo_usuario')
        .eq('nome_tipo_usuario', 'cliente')
        .maybeSingle();
    
    let tipoUsuarioId = tipo?.id;

    if (!tipoUsuarioId || tipoError) {
        const { data: allTypes } = await supabaseAdmin.from('tipos_usuarios').select('id, nome_tipo_usuario');
        const clienteType = allTypes?.find(t => t.nome_tipo_usuario.toLowerCase().includes('cliente'));
        tipoUsuarioId = clienteType?.id;
    }

    // 3. Create/Update public.usuarios
    const { error: upsertUserError } = await supabaseAdmin.from('usuarios').upsert({
        id: userId,
        nome: nome_cliente,
        email: email,
        telefone: telefone,
        status_usuario: status_cliente || 'ativo',
        tipo_usuario_id: tipoUsuarioId,
        estabelecimento_id: targetEstablishmentId
        // avatar_url column does not exist in 'usuarios' table, removed to fix "User Upsert Error"
    }, { onConflict: 'id' });

    if (upsertUserError) {
        logErrorToFile({ message: 'User Upsert Error', error: upsertUserError });
        return NextResponse.json({ error: 'Erro ao salvar perfil do usuário' }, { status: 500 });
    }

    // 4. Assign role in user_roles
    await supabaseAdmin.from('user_roles').upsert({
        user_id: userId,
        role: 'cliente'
    }, { onConflict: 'user_id' });

    // 5. Create record in public.clientes using the SAME userId
    const payload = {
        id: userId, // CRITICAL: Use the same ID from Auth/Users
        estabelecimento_id: targetEstablishmentId,
        nome_cliente,
        email,
        cpf,
        telefone,
        status_cliente: status_cliente || 'ativo',
        imagem_cliente_url
    };

    const { data: clientData, error: insertError } = await supabaseAdmin
        .from('clientes')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();

    if (insertError) {
        logErrorToFile({ message: 'Client Insert/Upsert Error', error: insertError });
        return NextResponse.json({ error: 'Erro ao salvar dados do cliente' }, { status: 500 });
    }

    // 6. Insert Address if provided
    if (endereco || cep) {
        let finalComplemento = complemento;
        if (ponto_referencia) {
             finalComplemento = finalComplemento 
                ? `${finalComplemento} - Ref: ${ponto_referencia}`
                : `Ref: ${ponto_referencia}`;
        }

        const addressPayload = {
            cliente_id: userId, // Use the same userId
            cep,
            endereco,
            numero,
            complemento: finalComplemento,
            bairro,
            cidade,
            uf
        };

        const { error: addressError } = await supabaseAdmin
            .from('enderecos_clientes')
            .insert(addressPayload);
        
        if (addressError) {
            logErrorToFile({ message: 'Address Insert Error', error: addressError });
        }
    }

    return NextResponse.json(clientData);

  } catch (err: any) {
    logErrorToFile(err);
    return NextResponse.json({ error: err?.message || 'Internal Server Error' }, { status: 500 });
  }
}
