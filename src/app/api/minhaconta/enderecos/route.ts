import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

// Helper to get client ID
async function getClientId(user: any) {
  // 1. Tenta buscar pelo ID direto
  const { data: client } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  if (client?.id) return client.id;

  // 2. Tenta buscar pelo email (caso ID seja diferente por algum motivo de migração)
  if (user.email) {
    const { data: clientByEmail } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
      
    if (clientByEmail?.id) return clientByEmail.id;
  }

  // 3. Se não encontrar, CRIA o cliente automaticamente (Lazy Creation)
  // Isso resolve o problema de usuários criados no Auth mas sem registro na tabela clientes
  console.log(`[GetClientId] Cliente não encontrado para user ${user.id}. Criando registro...`);
  
  const { data: newClient, error: createError } = await supabaseAdmin
    .from('clientes')
    .insert([
      {
        id: user.id,
        email: user.email,
        nome: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Cliente',
        criado_em: new Date().toISOString()
      }
    ])
    .select('id')
    .single();

  if (createError) {
    console.error('[GetClientId] Erro ao criar cliente automaticamente:', createError);
    // Se falhar a criação (ex: race condition), tenta buscar de novo ou retorna null
    return null; 
  }

  return newClient?.id;
}

export async function GET(request: Request) {
  try {
    const { user, error: authError, status } = await getAuthContext(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: authError || 'Não autenticado' }, { status: status || 401 });
    }

    const clientId = await getClientId(user);

    if (!clientId) {
      return NextResponse.json({ error: 'Perfil de cliente não encontrado' }, { status: 404 });
    }

    const { data: addresses, error: addrError } = await supabaseAdmin
      .from('enderecos_clientes')
      .select('*')
      .eq('cliente_id', clientId)
      .order('criado_em', { ascending: false });

    if (addrError) throw addrError;

    return NextResponse.json({
      addresses: addresses || [],
      clientId: clientId
    });
  } catch (err: any) {
    console.error('API Endereços Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { user, error: authError, status } = await getAuthContext(request);
    if (authError || !user) return NextResponse.json({ error: authError || 'Não autenticado' }, { status: status || 401 });

    const clientId = await getClientId(user);
    if (!clientId) return NextResponse.json({ error: 'Perfil de cliente não encontrado' }, { status: 404 });

    const body = await request.json();
    
    // Add cliente_id to the payload
    const payload = {
      ...body,
      cliente_id: clientId
    };

    const { data, error } = await supabaseAdmin
      .from('enderecos_clientes')
      .insert([payload])
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { user, error: authError, status } = await getAuthContext(request);
    if (authError || !user) return NextResponse.json({ error: authError || 'Não autenticado' }, { status: status || 401 });

    const clientId = await getClientId(user);
    if (!clientId) return NextResponse.json({ error: 'Perfil de cliente não encontrado' }, { status: 404 });

    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) return NextResponse.json({ error: 'ID do endereço é obrigatório' }, { status: 400 });

    // Ensure we don't update cliente_id
    delete updates.cliente_id;
    delete updates.criado_em;

    const { data, error } = await supabaseAdmin
      .from('enderecos_clientes')
      .update(updates)
      .eq('id', id)
      .eq('cliente_id', clientId) // Security check: ensure address belongs to user
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json(data);
  } catch (err: any) {
    console.error('API PUT Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { user, error: authError, status } = await getAuthContext(request);
    if (authError || !user) return NextResponse.json({ error: authError || 'Não autenticado' }, { status: status || 401 });

    const clientId = await getClientId(user);
    if (!clientId) return NextResponse.json({ error: 'Perfil de cliente não encontrado' }, { status: 404 });

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) return NextResponse.json({ error: 'ID do endereço é obrigatório' }, { status: 400 });

    const { error } = await supabaseAdmin
      .from('enderecos_clientes')
      .delete()
      .eq('id', id)
      .eq('cliente_id', clientId); // Security check

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API DELETE Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
