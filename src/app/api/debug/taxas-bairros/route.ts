
import { NextResponse } from 'next/server';
import { getAuthContext, supabaseAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  const auth = await getAuthContext(request);

  if (auth.error) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { establishmentId } = auth;

  try {
    const { data: config } = await supabaseAdmin
      .from('taxa_entregas')
      .select('*')
      .eq('estabelecimento_id', establishmentId)
      .maybeSingle();

    if (!config) {
        return NextResponse.json({ message: 'No delivery config found for this establishment' });
    }

    const { data: hoods, error } = await supabaseAdmin
      .from('taxas_bairros')
      .select('*')
      .eq('taxa_entrega_id', config.id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ 
        config,
        neighborhoods: hoods,
        count: hoods?.length || 0
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
