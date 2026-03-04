import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function GET(
  request: Request,
  props: { params: Promise<{ id: string }> }
) {
  const params = await props.params;
  try {
    const { establishmentId, isSuperAdmin, error, status } = await getAuthContext(request);
    if (error) return NextResponse.json({ error }, { status: status || 401 });

    const clientId = params.id;

    // Verify client belongs to establishment (if not super admin)
    if (!isSuperAdmin && establishmentId) {
        const { data: client, error: clientError } = await supabaseAdmin
            .from('clientes')
            .select('estabelecimento_id')
            .eq('id', clientId)
            .single();
        
        if (clientError || !client) {
             return NextResponse.json({ error: 'Cliente não encontrado' }, { status: 404 });
        }

        if (client.estabelecimento_id !== establishmentId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
        }
    }

    const { data: addresses, error: addressesError } = await supabaseAdmin
      .from('enderecos_clientes')
      .select('*')
      .eq('cliente_id', clientId);

    if (addressesError) throw addressesError;

    return NextResponse.json(addresses);
  } catch (err: any) {
    console.error('Error fetching addresses:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
