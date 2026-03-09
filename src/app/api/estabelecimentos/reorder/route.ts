
import { NextResponse } from 'next/server';
import { supabaseAdmin, getAuthContext } from '@/lib/server-auth';

export async function POST(request: Request) {
  if (!supabaseAdmin) {
    return NextResponse.json({ error: 'Supabase Admin client not configured' }, { status: 500 });
  }

  try {
    const { isSuperAdmin, role, error: authError, status } = await getAuthContext(request);

    if (authError) {
      return NextResponse.json({ error: authError }, { status: status || 401 });
    }

    // Allow Super Admin OR Admin users
    // If the role is explicitly 'atendente' or 'estabelecimento', we deny.
    // Otherwise, we assume they are some form of admin/parceiro who can reorder.
    if (!isSuperAdmin && role === 'atendente') {
      return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }
    
    // Also block if it's a regular establishment user trying to reorder ALL establishments
    // Unless we implement reordering of their own products, but this is establishments reorder.
    if (!isSuperAdmin && role === 'estabelecimento') {
       return NextResponse.json({ error: 'Acesso negado.' }, { status: 403 });
    }

    const body = await request.json();
    const { items } = body; // items: { id: string, ordem: number }[]

    if (!Array.isArray(items)) {
      return NextResponse.json({ error: 'Items array is required' }, { status: 400 });
    }

    // Update each item
    // We can use upsert if we select id and ordem
    const updates = items.map((item: any, index: number) => ({
      id: item.id,
      ordem: index // Use the index as the order
    }));

    const { error } = await supabaseAdmin
      .from('estabelecimentos')
      .upsert(updates, { onConflict: 'id' });

    if (error) {
      console.error('Error reordering establishments:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Unexpected error in reorder:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
