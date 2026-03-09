
import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  const { role, establishmentId, error: authError, status } = await getAuthContext(request);

  if (authError) {
    return NextResponse.json({ error: authError }, { status: status || 401 });
  }

  if (role !== 'estabelecimento' && role !== 'admin' && role !== 'super_admin') {
    return NextResponse.json({ error: 'Acesso negado' }, { status: 403 });
  }

  try {
    const { isOpen } = await request.json();

    if (typeof isOpen !== 'boolean') {
      return NextResponse.json({ error: 'Invalid parameter: isOpen must be boolean' }, { status: 400 });
    }

    // Se for estabelecimento, só pode alterar o próprio
    if (role === 'estabelecimento' && !establishmentId) {
      return NextResponse.json({ error: 'ID do estabelecimento não encontrado' }, { status: 400 });
    }

    const targetId = establishmentId; // Se for admin, poderia passar no body, mas por enquanto vamos focar no estabelecimento alterando o próprio status.

    const { error } = await supabaseAdmin
      .from('estabelecimentos')
      .update({ is_open: isOpen })
      .eq('id', targetId);

    if (error) {
      console.error('Error updating status:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, isOpen });
  } catch (err: any) {
    console.error('Unexpected error:', err);
    return NextResponse.json({ error: err.message || 'Internal Server Error' }, { status: 500 });
  }
}
