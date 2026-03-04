
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-auth';

export async function GET(request: Request) {
  try {
    // 1. Fetch all establishments to find the one we are interested in (or just list them)
    // For simplicity, let's just fetch all delivery configs and their neighborhoods
    
    const { data: configs, error: configError } = await supabaseAdmin
      .from('taxa_entregas')
      .select(`
        *,
        estabelecimentos (nome_estabelecimento),
        taxas_bairros (*)
      `);

    if (configError) {
      return NextResponse.json({ error: configError }, { status: 500 });
    }

    return NextResponse.json({ configs });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
