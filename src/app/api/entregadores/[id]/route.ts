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
      .from('entregadores')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError) throw fetchError;
    if (!data) return NextResponse.json({ error: 'Entregador não encontrado' }, { status: 404 });

    // Check permissions
    if (!isSuperAdmin) {
      if (data.estabelecimento_id !== establishmentId && establishmentId) {
        return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
      }
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error fetching delivery driver:', err);
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
    
    // Mapping frontend fields to DB fields
    const dbData: any = {
      nome_entregador: body.nome,
      cpf: body.cpf ? body.cpf.replace(/\D/g, '') : null,
      telefone: body.telefone,
      veiculo: body.veiculo,
      tipo_cnh: body.tipo_cnh,
      cep: body.cep,
      endereco: body.endereco,
      numero: body.numero,
      bairro: body.bairro,
      cidade: body.cidade,
      uf: body.uf,
      complemento: body.complemento,
      status_entregador: body.status,
      imagem_entregador_url: body.avatar_url
    };

    // Only allow changing establishment if superadmin
    if (isSuperAdmin && body.estabelecimento_id) {
      dbData.estabelecimento_id = body.estabelecimento_id;
    }

    // Check permissions
    const { data: existing, error: checkError } = await supabaseAdmin
        .from('entregadores')
        .select('estabelecimento_id, id')
        .eq('id', id)
        .single();
    
    if (checkError || !existing) {
        return NextResponse.json({ error: 'Entregador não encontrado' }, { status: 404 });
    }

    if (!isSuperAdmin) {
        if (existing.estabelecimento_id !== establishmentId && establishmentId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
    }

    const { data, error: updateError } = await supabaseAdmin
      .from('entregadores')
      .update(dbData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) throw updateError;

    // 2. Sync with usuarios table and Auth using the same ID
    try {
      // Check if user exists in usuarios table
      const { data: userData } = await supabaseAdmin
        .from('usuarios')
        .select('id, email')
        .eq('id', id)
        .single();

      if (userData) {
        // Update usuarios table
        const userUpdate: any = {
          nome: body.nome,
          telefone: body.telefone,
          status_usuario: body.status === 'disponivel' ? 'ativo' : 'inativo',
          estabelecimento_id: body.estabelecimento_id || dbData.estabelecimento_id
        };

        // Update email in usuarios if provided
        if (body.email) {
          userUpdate.email = body.email;
        }

        await supabaseAdmin
          .from('usuarios')
          .update(userUpdate)
          .eq('id', id);

        // Update Auth
        const authUpdate: any = {
          user_metadata: { 
            name: body.nome,
            avatar_url: body.avatar_url
          }
        };

        if (body.email) authUpdate.email = body.email;
        if (body.senha) authUpdate.password = body.senha;

        await supabaseAdmin.auth.admin.updateUserById(id, authUpdate);
      }
    } catch (syncError) {
      console.error('Error syncing user data:', syncError);
      // We don't throw here to not break the delivery driver update
    }

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('Error updating delivery driver:', err);
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
    const { data: existing, error: checkError } = await supabaseAdmin
        .from('entregadores')
        .select('estabelecimento_id')
        .eq('id', id)
        .single();
    
    if (checkError || !existing) {
        return NextResponse.json({ error: 'Entregador não encontrado' }, { status: 404 });
    }

    if (!isSuperAdmin) {
        if (existing.estabelecimento_id !== establishmentId && establishmentId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
    }

    const { error: deleteError } = await supabaseAdmin
      .from('entregadores')
      .delete()
      .eq('id', id);

    if (deleteError) throw deleteError;

    // 2. Delete from usuarios and Auth using the same ID
    try {
      const { data: userData } = await supabaseAdmin
        .from('usuarios')
        .select('id')
        .eq('id', id)
        .single();

      if (userData) {
        // Delete from usuarios (RLS/Foreign keys might handle this if set up, but let's be explicit)
        await supabaseAdmin.from('usuarios').delete().eq('id', userData.id);
        // Delete from Auth
        await supabaseAdmin.auth.admin.deleteUser(userData.id);
      }
    } catch (syncError) {
      console.error('Error deleting user sync:', syncError);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error deleting delivery driver:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
