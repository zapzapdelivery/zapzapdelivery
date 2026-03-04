import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

async function checkTargetPermission(targetUserId: string, requestEstablishmentId: string | null, isSuperAdmin: boolean) {
  if (isSuperAdmin) return true;
  if (!requestEstablishmentId) return false;

  // Get target user's establishment
  const { data: targetUserData } = await supabaseAdmin
    .from('usuarios')
    .select('estabelecimento_id')
    .eq('id', targetUserId)
    .single();
  
  // If user not found in DB, establishment admin cannot verify ownership, so deny.
  if (!targetUserData) return false; 
  
  return requestEstablishmentId === targetUserData.estabelecimento_id;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const { id } = await params;
  const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);

  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  // Se o usuário está tentando editar a si mesmo, permite
  const isSelf = user.id === id;

  if (role === 'atendente' && !isSelf) {
    // Se for atendente tentando editar outro usuário, verifica permissões adicionais se necessário
    // Por padrão, bloqueia edição de terceiros para atendente, a menos que se queira liberar
    // Vamos manter restrito a terceiros, mas liberar o próprio.
    return NextResponse.json({ error: 'Acesso negado: Usuários atendentes não têm permissão para editar outros usuários.' }, { status: 403 });
  }

  // Se for o próprio usuário, bypass checkTargetPermission (que exige establishmentId)
  let allowed = isSelf;
  
  if (!allowed) {
    allowed = await checkTargetPermission(id, establishmentId, isSuperAdmin);
  }
  
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { data: user, error } = await supabaseAdmin
      .from('usuarios')
      .select('*, estabelecimentos(id, nome_estabelecimento), tipos_usuarios(id, nome_tipo_usuario)')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching user:', error);
      return NextResponse.json({ error: error.message }, { status: 404 });
    }

    // Include avatar_url from Auth metadata since it's missing from public.usuarios table
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(id);
    const responseData = {
      ...user,
      avatar_url: authUser?.user?.user_metadata?.avatar_url || null
    };

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const { id } = await params;
  const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);

  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  // Se o usuário está tentando editar a si mesmo, permite
  const isSelf = user.id === id;

  if (role === 'atendente' && !isSelf) {
    return NextResponse.json({ error: 'Acesso negado: Usuários atendentes não têm permissão para editar outros usuários.' }, { status: 403 });
  }

  const allowed = isSelf || await checkTargetPermission(id, establishmentId, isSuperAdmin);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { name, email, phone, active, profile, establishment, partner, password, avatar_url } = body;

    // 1. Update auth user (email, password) if needed
    const authUpdates: any = {};
    if (email) authUpdates.email = email;
    if (password) authUpdates.password = password;
    if (name) authUpdates.user_metadata = { name };

    if (Object.keys(authUpdates).length > 0) {
      const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates);
      if (authError) {
        return NextResponse.json({ error: authError.message }, { status: 400 });
      }
    }

    // 2. Update public.usuarios table
    const updates: any = {};
    if (name) updates.nome = name;
    if (email) updates.email = email;
    if (phone) updates.telefone = phone;
    if (active !== undefined) updates.status_usuario = active ? 'ativo' : 'inativo';
    if (profile) updates.tipo_usuario_id = profile;
    if (establishment) updates.estabelecimento_id = establishment;
    
    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .update(updates)
      .eq('id', id);

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    // 3. Update establishment ownership if establishment changed
    // if (establishment) {
    //   await supabaseAdmin.from('estabelecimentos').update({ user_id: id }).eq('id', establishment);
    // }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const { id } = await params;
  const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);

  if (error) {
    return NextResponse.json({ error }, { status: status || 401 });
  }

  if (role === 'atendente') {
    return NextResponse.json({ error: 'Acesso negado: Usuários atendentes não têm permissão para acessar este módulo.' }, { status: 403 });
  }

  const allowed = await checkTargetPermission(id, establishmentId, isSuperAdmin);
  if (!allowed) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // 1. Fetch user auth data to get metadata (avatar_url) and delete image
    const { data: authUser, error: fetchAuthError } = await supabaseAdmin.auth.admin.getUserById(id);

    if (!fetchAuthError && authUser?.user?.user_metadata?.avatar_url) {
      const bucket = 'avatars';
      const url = authUser.user.user_metadata.avatar_url;
      try {
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split(`/storage/v1/object/public/${bucket}/`);
        if (pathParts.length === 2) {
          const path = decodeURIComponent(pathParts[1]);
          await supabaseAdmin.storage.from(bucket).remove([path]);
        }
      } catch (e) {
        console.warn('Error deleting user avatar:', e);
      }
    }

    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authError) {
      // If user is not found in Auth but exists in DB (inconsistent state), 
      // we should allow deleting from DB directly to clean up.
      if (authError.message === 'User not found') {
        console.warn(`User ${id} not found in Auth, deleting from public.usuarios directly.`);
        const { error: dbError } = await supabaseAdmin
          .from('usuarios')
          .delete()
          .eq('id', id);
          
        if (dbError) {
          return NextResponse.json({ error: dbError.message }, { status: 400 });
        }
        return NextResponse.json({ success: true });
      }

      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
