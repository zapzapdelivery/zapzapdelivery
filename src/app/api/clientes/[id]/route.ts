import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { user, establishmentId, isSuperAdmin, error, status } = await getAuthContext(request);
    if (error) return NextResponse.json({ error }, { status: status || 401 });

    const id = params.id;

    const { data, error: fetchError } = await supabaseAdmin
      .from('clientes')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!data) return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });

    // Check permissions
    if (!isSuperAdmin) {
      if (data.estabelecimento_id !== establishmentId && establishmentId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error fetching client:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { user, establishmentId, isSuperAdmin, error, status } = await getAuthContext(request);
    if (error) return NextResponse.json({ error }, { status: status || 401 });

    const id = params.id;
    const body = await request.json();
    const { nome_cliente, email, cpf, telefone, status_cliente, imagem_cliente_url, estabelecimento_id } = body;

    // Check permissions
    const { data: existingClient, error: checkError } = await supabaseAdmin
        .from('clientes')
        .select('estabelecimento_id')
        .eq('id', id)
        .single();
    
    if (checkError || !existingClient) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (!isSuperAdmin) {
        if (existingClient.estabelecimento_id !== establishmentId && establishmentId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
        // Also ensure user can't change establishment_id
        if (estabelecimento_id && estabelecimento_id !== establishmentId) {
            return NextResponse.json({ error: 'Não é permitido alterar o estabelecimento' }, { status: 403 });
        }
    }

    // Check for duplicates (Email, CPF, Telefone) excluding current client
    const duplicateChecks = [];
    if (email) duplicateChecks.push(supabaseAdmin.from('clientes').select('id').eq('email', email).neq('id', id).maybeSingle());
    if (cpf) duplicateChecks.push(supabaseAdmin.from('clientes').select('id').eq('cpf', cpf).neq('id', id).maybeSingle());
    if (telefone) duplicateChecks.push(supabaseAdmin.from('clientes').select('id').eq('telefone', telefone).neq('id', id).maybeSingle());

    if (duplicateChecks.length > 0) {
        const results = await Promise.all(duplicateChecks);
        for (let i = 0; i < results.length; i++) {
            const { data: existing } = results[i];
            if (existing) {
                let field = '';
                // Logic to identify which field failed
                const fields = [];
                if (email) fields.push('E-mail');
                if (cpf) fields.push('CPF');
                if (telefone) fields.push('Telefone');
                
                field = fields[i];
                return NextResponse.json({ error: `Já existe outro cliente cadastrado com este ${field}` }, { status: 400 });
            }
        }
    }

    const payload: any = {
      nome_cliente,
      email,
      cpf,
      telefone,
      status_cliente,
      imagem_cliente_url,
      atualizado_em: new Date().toISOString()
    };

    if (isSuperAdmin && estabelecimento_id) {
        payload.estabelecimento_id = estabelecimento_id;
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('clientes')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // Address Update Logic
    const { 
        address_id,
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

    if (cep || endereco) {
        // Merge ponto_referencia into complemento
        let finalComplemento = complemento;
        if (ponto_referencia) {
             finalComplemento = finalComplemento 
                ? `${finalComplemento} - Ref: ${ponto_referencia}`
                : `Ref: ${ponto_referencia}`;
        }

        const addressPayload = {
            cep,
            endereco,
            numero,
            complemento: finalComplemento,
            bairro,
            cidade,
            uf
            // ponto_referencia and tipo_endereco removed
        };

        if (address_id) {
            // Update existing address
            const { error: addrUpdateError } = await supabaseAdmin
                .from('enderecos_clientes')
                .update({
                    ...addressPayload,
                    atualizado_em: new Date().toISOString()
                })
                .eq('id', address_id)
                .eq('cliente_id', id); // Safety check
            
            if (addrUpdateError) {
                console.error('Address Update Error:', addrUpdateError);
            }
        } else {
            // Insert new address
            const { error: addrInsertError } = await supabaseAdmin
                .from('enderecos_clientes')
                .insert({
                    ...addressPayload,
                    cliente_id: id
                });
            
            if (addrInsertError) {
                console.error('Address Insert Error:', addrInsertError);
            }
        }
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error updating client:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { user, establishmentId, isSuperAdmin, error, status } = await getAuthContext(request);
    if (error) return NextResponse.json({ error }, { status: status || 401 });

    const id = params.id;

    // Check permissions
    const { data: existingClient, error: checkError } = await supabaseAdmin
        .from('clientes')
        .select('estabelecimento_id')
        .eq('id', id)
        .single();
    
    if (checkError || !existingClient) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    if (!isSuperAdmin) {
        if (existingClient.estabelecimento_id !== establishmentId && establishmentId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
    }

    // 1. Buscar detalhes do cliente para ter o e-mail (usado como fallback para deletar Auth)
    const { data: clientData, error: clientFetchError } = await supabaseAdmin
        .from('clientes')
        .select('id, email, estabelecimento_id, imagem_cliente_url')
        .eq('id', id)
        .single();

    if (clientFetchError || !clientData) {
        return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
    }

    const clientEmail = clientData.email;

    // Check permissions
    if (!isSuperAdmin) {
        if (clientData.estabelecimento_id !== establishmentId && establishmentId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
    }

    // 2. Buscar se existe um usuário (public.usuarios) vinculado a este cliente
    // Tentamos pelo ID do cliente (que muitas vezes é o mesmo ID do Auth)
    const { data: linkedUserByUID } = await supabaseAdmin
      .from('usuarios')
      .select('id, email')
      .eq('id', id)
      .maybeSingle();
    
    // Fallback: Buscar pelo e-mail se não achou pelo ID
    let linkedUser = linkedUserByUID;
    if (!linkedUser && clientEmail) {
        const { data: userByEmail } = await supabaseAdmin
            .from('usuarios')
            .select('id, email')
            .eq('email', clientEmail)
            .maybeSingle();
        linkedUser = userByEmail;
    }

    // 3. Excluir pedidos vinculados
    await supabaseAdmin.from('pedidos').delete().eq('cliente_id', id);

    // 4. Excluir endereços vinculados
    const { error: addrDeleteError } = await supabaseAdmin
      .from('enderecos_clientes')
      .delete()
      .eq('cliente_id', id);

    if (addrDeleteError) {
      console.error('Error deleting client addresses:', addrDeleteError);
      return NextResponse.json({ error: 'Erro ao excluir endereços do cliente' }, { status: 500 });
    }

    // 5. Excluir o registro do cliente na tabela 'clientes'
    const { error: deleteError } = await supabaseAdmin
      .from('clientes')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // 5.1 Excluir imagem do storage se existir
    if (clientData?.imagem_cliente_url) {
        const bucket = 'avatars';
        const url = clientData.imagem_cliente_url;
        try {
            // Verifica se é uma URL do Supabase Storage
            if (url.includes('/storage/v1/object/public/')) {
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
                if (pathParts.length === 2) {
                    const filePath = decodeURIComponent(pathParts[1]);
                    const { error: storageError } = await supabaseAdmin.storage.from(bucket).remove([filePath]);
                    if (storageError) {
                        console.error(`[DELETE /api/clientes/${id}] Erro ao deletar imagem do storage (${filePath}):`, storageError);
                    } else {
                        console.log(`[DELETE /api/clientes/${id}] Imagem deletada do storage com sucesso: ${filePath}`);
                    }
                }
            }
        } catch (e) {
            console.warn(`[DELETE /api/clientes/${id}] Erro ao processar URL da imagem para exclusão:`, e);
        }
    }

    // 6. Limpeza do Usuário (DB + Auth)
    try {
        let authUserIdToDelete = linkedUser?.id || (id.length === 36 ? id : null);
        
        // Se não temos um ID de Auth confiável, tentamos listar usuários pelo e-mail
        if (!authUserIdToDelete && clientEmail) {
            console.log(`[DELETE /api/clientes/${id}] Tentando fallback por e-mail: ${clientEmail}`);
            const { data: listData, error: listError } = await supabaseAdmin.auth.admin.listUsers();
            
            if (listError) {
                console.error(`[DELETE /api/clientes/${id}] Erro ao listar usuários para fallback:`, listError);
            } else {
                const foundAuthUser = listData.users.find(u => u.email?.toLowerCase() === clientEmail.toLowerCase());
                if (foundAuthUser) {
                    authUserIdToDelete = foundAuthUser.id;
                    console.log(`[DELETE /api/clientes/${id}] Usuário encontrado via e-mail: ${authUserIdToDelete}`);
                } else {
                    console.log(`[DELETE /api/clientes/${id}] Nenhum usuário Auth encontrado com o e-mail: ${clientEmail}`);
                }
            }
        }

        if (authUserIdToDelete) {
            // Excluir de public.usuarios e user_roles primeiro
            await supabaseAdmin.from('user_roles').delete().eq('user_id', authUserIdToDelete);
            await supabaseAdmin.from('usuarios').delete().eq('id', authUserIdToDelete);
            
            // Excluir do Auth do Supabase
            const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUserIdToDelete);
            if (authDeleteError) {
                console.error(`[DELETE /api/clientes/${id}] Erro ao deletar usuário Auth (${authUserIdToDelete}):`, authDeleteError);
            } else {
                console.log(`[DELETE /api/clientes/${id}] Usuário Auth deletado com sucesso: ${authUserIdToDelete}`);
            }
        }
    } catch (cleanupErr) {
        console.error(`[DELETE /api/clientes/${id}] Erro crítico durante limpeza de usuário:`, cleanupErr);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting client:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
