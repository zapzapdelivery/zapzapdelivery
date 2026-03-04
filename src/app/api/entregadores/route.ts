import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';
import fs from 'fs';
import path from 'path';

function logErrorToFile(error: any) {
  try {
    const logPath = path.join(process.cwd(), 'api-error.log');
    const timestamp = new Date().toISOString();
    const message = `[${timestamp}] Error in /api/entregadores: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}\n`;
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
    const { user, establishmentId, isSuperAdmin, role, error, status: authStatus } = await getAuthContext(request);
    
    if (error) {
      logErrorToFile({ message: 'Auth Error', error, status: authStatus });
      return NextResponse.json({ error }, { status: authStatus || 401 });
    }

    let query = supabaseAdmin
      .from('entregadores')
      .select('*')
      .order('criado_em', { ascending: false });

    if (!isSuperAdmin) {
        if (establishmentId) {
            query = query.eq('estabelecimento_id', establishmentId);
        } else {
             if (role !== 'admin') {
                return NextResponse.json([]);
             }
        }
    }

    const { data: entregadores, error: entregadoresError } = await query;

    if (entregadoresError) {
      logErrorToFile({ message: 'Query Error', error: entregadoresError });
      throw entregadoresError;
    }

    const formattedEntregadores = entregadores.map((entregador: any) => {
      return {
        id: entregador.id,
        nome: entregador.nome_entregador || 'Sem Nome',
        cpf: entregador.cpf || '-',
        telefone: entregador.telefone || '-',
        veiculo: entregador.veiculo || '-',
        status: entregador.status_entregador || 'inativo',
        avatar_url: entregador.imagem_entregador_url,
        criado_em: entregador.criado_em,
        cep: entregador.cep,
        endereco: entregador.endereco,
        numero: entregador.numero,
        bairro: entregador.bairro,
        cidade: entregador.cidade,
        uf: entregador.uf,
        complemento: entregador.complemento,
        tipo_cnh: entregador.tipo_cnh
      };
    });

    return NextResponse.json(formattedEntregadores);
  } catch (err: any) {
    logErrorToFile(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { user, establishmentId, isSuperAdmin, role, error, status: authStatus } = await getAuthContext(request);
    
    if (error) {
      return NextResponse.json({ error }, { status: authStatus || 401 });
    }

    const body = await request.json();
    const { email, senha, nome, telefone, veiculo, tipo_cnh, cep, endereco, numero, bairro, cidade, uf, complemento, status: entregadorStatus, avatar_url, estabelecimento_id: bodyEstabelecimentoId } = body;

    // 1. Create Auth User if email and password are provided
    let userId = null;
    if (email && senha) {
      try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password: senha,
          email_confirm: true,
          user_metadata: {
            name: nome,
            avatar_url: avatar_url
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
            // Update password if it was provided
            await supabaseAdmin.auth.admin.updateUserById(userId, { password: senha });
          } else {
            return NextResponse.json({ error: 'Erro ao criar usuário de autenticação: ' + authError.message }, { status: 400 });
          }
        } else {
          userId = authUser.user.id;
        }
      } catch (authErr: any) {
        console.error('Auth error:', authErr);
        return NextResponse.json({ error: 'Erro no processo de autenticação' }, { status: 500 });
      }
    }

    // 2. Get 'entregador' role type
    let tipoUsuarioId = '6dea9501-87e7-4095-8d48-c3fe65995313'; // Default ID from earlier check

    // 3. Create/Update public.usuarios if we have a userId
    if (userId) {
      const { error: upsertUserError } = await supabaseAdmin.from('usuarios').upsert({
        id: userId,
        nome: nome,
        email: email,
        telefone: telefone,
        status_usuario: (entregadorStatus === 'disponivel' || !entregadorStatus) ? 'ativo' : 'inativo',
        tipo_usuario_id: tipoUsuarioId,
        estabelecimento_id: bodyEstabelecimentoId || establishmentId
      }, { onConflict: 'id' });

      if (upsertUserError) {
        return NextResponse.json({ error: 'Erro ao salvar perfil do usuário: ' + upsertUserError.message }, { status: 500 });
      }

      // 4. Assign role in user_roles
      await supabaseAdmin.from('user_roles').upsert({
        user_id: userId,
        role: 'entregador'
      }, { onConflict: 'user_id' });
    }

    // Mapping frontend fields to DB fields
    const dbData: any = {
      nome_entregador: nome,
      cpf: body.cpf ? body.cpf.replace(/\D/g, '') : null,
      telefone: telefone,
      veiculo: veiculo,
      tipo_cnh: tipo_cnh,
      cep: cep,
      endereco: endereco,
      numero: numero,
      bairro: bairro,
      cidade: cidade,
      uf: uf,
      complemento: complemento,
      estabelecimento_id: bodyEstabelecimentoId || establishmentId,
      status_entregador: entregadorStatus || 'disponivel',
      imagem_entregador_url: avatar_url
    };

    // If we created a user, use its ID for the entregador record
    if (userId) {
      dbData.id = userId;
    }

    const { data, error: insertError } = await supabaseAdmin
      .from('entregadores')
      .upsert([dbData], { onConflict: 'id' })
      .select()
      .single();

    if (insertError) {
      logErrorToFile({ message: 'Insert/Upsert Error', error: insertError });
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }

    return NextResponse.json(data);
  } catch (err: any) {
    logErrorToFile(err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
