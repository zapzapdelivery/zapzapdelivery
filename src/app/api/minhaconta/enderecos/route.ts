import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

// Helper to get client ID
async function getClientId(user: any) {
  const { data: client } = await supabaseAdmin
    .from('clientes')
    .select('id')
    .eq('id', user.id)
    .maybeSingle();

  let clientId = client?.id;

  if (!clientId) {
    const { data: clientByEmail } = await supabaseAdmin
      .from('clientes')
      .select('id')
      .eq('email', user.email)
      .maybeSingle();
    clientId = clientByEmail?.id;
  }
  return clientId;
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
