import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);
    
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    // Permitir acesso para atendentes e outros perfis
    // if (role === 'atendente') { ... } // Removido bloqueio

    let query = supabaseAdmin
      .from('usuarios')
      .select('*, estabelecimentos(nome_estabelecimento), tipos_usuarios(nome_tipo_usuario)');

    if (!isSuperAdmin) {
      // Perfis restritos que só podem ver a si mesmos
      const restrictedRoles = ['atendente', 'cliente', 'entregador'];
      
      if (restrictedRoles.includes(role || '') || !establishmentId) {
        // Permite ver apenas o próprio usuário para gestão de perfil
        query = query.eq('id', user.id);
      } else {
        // Se tem estabelecimento (e é role 'estabelecimento' ou 'parceiro'), filtra pelo estabelecimento
        query = query.eq('estabelecimento_id', establishmentId);
      }
      
      // Rule: Establishments/Users cannot see the user everaldozs@gmail.com
      if (user?.email?.toLowerCase() !== 'everaldozs@gmail.com') {
        query = query.neq('email', 'everaldozs@gmail.com');
      }
    }

    // Fetch users from the 'usuarios' table with establishment name
    // Using admin client to bypass RLS policies for the admin dashboard list
    const { data: users, error: fetchError } = await query;

    if (fetchError) {
      console.error('Error fetching users from Supabase:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    // Fetch avatar_url from Auth metadata for each user
    const usersWithAvatars = await Promise.all((users || []).map(async (u: any) => {
      try {
        const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(u.id);
        return {
          ...u,
          avatar_url: authUser?.user?.user_metadata?.avatar_url || null
        };
      } catch (e) {
        return { ...u, avatar_url: null };
      }
    }));

    return NextResponse.json(usersWithAvatars);
  } catch (error) {
    console.error('Unexpected error in /api/usuarios:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { user, establishmentId, isSuperAdmin, role, error, status } = await getAuthContext(request);
    
    if (error) {
      return NextResponse.json({ error }, { status: status || 401 });
    }

    if (role === 'atendente' || role === 'estabelecimento') {
      return NextResponse.json({ error: 'Acesso negado: Este tipo de usuário não tem permissão para acessar este módulo.' }, { status: 403 });
    }

    const body = await request.json();
    let { name, email, phone, active, profile, establishment, partner, password, confirmPassword, avatar_url } = body;

    // Security check: Protect special user
    if (!isSuperAdmin && email === 'everaldozs@gmail.com') {
      return NextResponse.json({ error: 'Operação não permitida para este usuário.' }, { status: 403 });
    }

    // Enforce establishment isolation
    if (!isSuperAdmin) {
      if (!establishmentId) {
        return NextResponse.json({ error: 'Você não tem permissão para criar usuários.' }, { status: 403 });
      }
      // Force establishment to current user's establishment
      establishment = establishmentId;
    }

    const tempPassword = Math.random().toString(36).slice(-8) + 'Aa1!';
    let chosenPassword = tempPassword;
    let passwordProvided = false;
    let tipoUsuarioId: string | null = profile || null;
    let roleName = 'estabelecimento'; // Default role fallback

    // Logic to determine the correct role name based on the selected profile (tipo_usuario_id)
    if (tipoUsuarioId) {
      const { data: tipoData, error: tipoError } = await supabaseAdmin
        .from('tipos_usuarios')
        .select('nome_tipo_usuario')
        .eq('id', tipoUsuarioId)
        .single();
      
      if (!tipoError && tipoData) {
        // Normalize role name (e.g., 'Entregador' -> 'entregador')
        roleName = tipoData.nome_tipo_usuario.toLowerCase();
      }
    } else if (establishment) {
        // Fallback: if no profile selected but establishment exists, try to find 'estabelecimento' type
       const { data: tipo, error: tipoError } = await supabaseAdmin
         .from('tipos_usuarios')
         .select('id, nome_tipo_usuario')
         .eq('nome_tipo_usuario', 'estabelecimento')
         .single();
         
       if (!tipoError && tipo) {
         tipoUsuarioId = tipo.id;
         roleName = 'estabelecimento';
       }
    }

    if (typeof password === 'string' && password.length > 0) {
      const valid = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password);
      if (!valid) {
        return NextResponse.json({ error: 'Senha inválida: mínimo 8, maiúscula, minúscula, número e símbolo' }, { status: 400 });
      }
      if (confirmPassword !== undefined && password !== confirmPassword) {
        return NextResponse.json({ error: 'Senha e confirmação não conferem' }, { status: 400 });
      }
      chosenPassword = password;
      passwordProvided = true;
    }
    
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: chosenPassword,
      email_confirm: true,
      user_metadata: {
        name,
        avatar_url
      }
    });

    if (authError && !authUser?.user) {
      const msg = String(authError.message || '').toLowerCase();
      try {
        const listed = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
        const existing = (listed?.data?.users || []).find((u: any) => String(u?.email || '').toLowerCase() === String(email || '').toLowerCase());
        if (!existing) {
          return NextResponse.json({ error: authError.message }, { status: 400 });
        }
        
        // Update password if provided
        if (passwordProvided) {
          await supabaseAdmin.auth.admin.updateUserById(existing.id, { password: chosenPassword });
        }

        const { error: upsertUserError } = await supabaseAdmin
          .from('usuarios')
          .upsert(
            [
              {
                id: existing.id,
                nome: name,
                email: email,
                telefone: phone,
                status_usuario: active ? 'ativo' : 'inativo',
                tipo_usuario_id: tipoUsuarioId,
                estabelecimento_id: establishment || null,
              },
            ],
            { onConflict: 'id' }
          );
        if (upsertUserError) {
          return NextResponse.json({ error: upsertUserError.message }, { status: 400 });
        }
        await supabaseAdmin.from('user_roles').upsert([{ user_id: existing.id, role: roleName }], { onConflict: 'user_id' });
        // if (establishment) {
        //   await supabaseAdmin.from('estabelecimentos').update({ user_id: existing.id }).eq('id', establishment);
        // }
        return NextResponse.json({ success: true, user: existing });
      } catch (e: any) {
        return NextResponse.json({ error: e?.message || authError.message }, { status: 400 });
      }
    }

    const userId = authUser?.user?.id;
    if (!userId) {
      return NextResponse.json({ error: 'Falha ao criar usuário de autenticação' }, { status: 500 });
    }

    const { error: dbError } = await supabaseAdmin
      .from('usuarios')
      .insert([
        {
          id: userId,
          nome: name,
          email: email,
          telefone: phone,
          status_usuario: active ? 'ativo' : 'inativo',
          tipo_usuario_id: tipoUsuarioId,
          estabelecimento_id: establishment || null,
        },
      ]);

    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return NextResponse.json({ error: dbError.message }, { status: 400 });
    }

    await supabaseAdmin.from('user_roles').upsert([{ user_id: userId, role: roleName }], { onConflict: 'user_id' });
    // if (establishment) {
    //   await supabaseAdmin.from('estabelecimentos').update({ user_id: userId }).eq('id', establishment);
    // }

    return NextResponse.json({ success: true, user: authUser.user });
  } catch (error) {
    console.error('Unexpected error in POST /api/usuarios:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }
  try {
    const { isSuperAdmin, error: authError, status } = await getAuthContext(request);
    
    if (authError) {
      return NextResponse.json({ error: authError }, { status: status || 401 });
    }

    const body = await request.json();
    const email: string = body?.email;

    // Security check: Protect special user
    if (!isSuperAdmin && email === 'everaldozs@gmail.com') {
      return NextResponse.json({ error: 'Operação não permitida para este usuário.' }, { status: 403 });
    }

    if (!email || !email.trim()) {
      return NextResponse.json({ error: 'Email é obrigatório' }, { status: 400 });
    }
    const listed = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = (listed?.data?.users || []).find((u: any) => String(u?.email || '').toLowerCase() === String(email || '').toLowerCase());
    if (!existing) {
      return NextResponse.json({ error: 'Usuário não encontrado no Auth' }, { status: 404 });
    }
    const userId = existing.id;
    let tipoUsuarioId: string | null = null;
    try {
      const { data: tipo } = await supabaseAdmin
        .from('tipos_usuarios')
        .select('id, nome_tipo_usuario')
        .eq('nome_tipo_usuario', 'estabelecimento')
        .limit(1)
        .single();
      tipoUsuarioId = tipo?.id ?? null;
    } catch {
      tipoUsuarioId = null;
    }
    await supabaseAdmin.from('user_roles').upsert([{ user_id: userId, role: 'estabelecimento' }], { onConflict: 'user_id' });
    const { data: existingUsuario } = await supabaseAdmin
      .from('usuarios')
      .select('id')
      .eq('id', userId)
      .limit(1);
    if (Array.isArray(existingUsuario) && existingUsuario.length > 0) {
      await supabaseAdmin
        .from('usuarios')
        .update({ tipo_usuario_id: tipoUsuarioId })
        .eq('id', userId);
    } else {
      await supabaseAdmin
        .from('usuarios')
        .upsert([
          {
            id: userId,
            email,
            nome: existing?.user_metadata?.name ?? email.split('@')[0],
            status_usuario: 'ativo',
            tipo_usuario_id: tipoUsuarioId,
          },
        ], { onConflict: 'id' });
    }
    return NextResponse.json({ ok: true, user_id: userId, role: 'estabelecimento', tipo_usuario_id: tipoUsuarioId }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal Server Error' }, { status: 500 });
  }
}
