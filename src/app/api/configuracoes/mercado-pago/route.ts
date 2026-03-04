
import { NextResponse } from 'next/server';
import { getAuthContext, supabaseAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  const auth = await getAuthContext(request);

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { establishmentId } = auth;

  if (!establishmentId) {
    return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
  }

  try {
    // Fetch Mercado Pago config
    const { data: config, error: configError } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('*')
      .eq('estabelecimento_id', establishmentId)
      .maybeSingle();

    if (configError) {
      console.error('Error fetching Mercado Pago config:', configError);
      // Return empty config if table doesn't exist or other error, but log it
      if (configError.code === '42P01') { // undefined_table
        return NextResponse.json({ error: 'Table not found. Please run migration.' }, { status: 500 });
      }
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    if (!config) {
      return NextResponse.json({ estabelecimento_id: establishmentId });
    }

    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Unexpected error in GET:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await getAuthContext(request);

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { establishmentId } = auth;

  if (!establishmentId) {
    return NextResponse.json({ error: 'Establishment not found' }, { status: 404 });
  }

  try {
    const body = await request.json();
    const { 
      public_key_teste, 
      access_token_teste, 
      public_key_producao, 
      access_token_producao,
      ambiente,
      ativo 
    } = body;

    // Check if config exists
    const { data: existingConfig } = await supabaseAdmin
      .from('configuracoes_mercadopago')
      .select('id')
      .eq('estabelecimento_id', establishmentId)
      .maybeSingle();

    const payload: any = {
      ativo,
      ambiente: ambiente || 'teste',
      updated_at: new Date().toISOString(),
      // Ensure legacy columns are populated to satisfy NOT NULL constraints
      public_key: (ambiente === 'producao' ? public_key_producao : public_key_teste) || '',
      access_token: (ambiente === 'producao' ? access_token_producao : access_token_teste) || '',
      // Ensure specific columns are populated (default to empty string if missing)
      public_key_teste: public_key_teste || '',
      access_token_teste: access_token_teste || '',
      public_key_producao: public_key_producao || '',
      access_token_producao: access_token_producao || ''
    };

    let result;
    if (existingConfig) {
      // Update
      result = await supabaseAdmin
        .from('configuracoes_mercadopago')
        .update(payload)
        .eq('id', existingConfig.id)
        .select()
        .single();
    } else {
      // Create
      payload.estabelecimento_id = establishmentId;
      payload.created_at = new Date().toISOString();
      
      result = await supabaseAdmin
        .from('configuracoes_mercadopago')
        .insert(payload)
        .select()
        .single();
    }

    if (result.error) {
      console.error('Error saving Mercado Pago config:', result.error);
      return NextResponse.json({ error: result.error.message }, { status: 500 });
    }

    return NextResponse.json(result.data);
  } catch (error: any) {
    console.error('Unexpected error in POST:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
