import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/server-auth';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('tipo_estabelecimentos')
      .select('id, name:nome')
      .order('nome');

    if (error) {
      console.error('Error fetching marketplace categories:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Internal error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
