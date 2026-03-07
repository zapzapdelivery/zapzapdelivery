
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!supabaseAdmin) {
    console.error('Supabase Admin client not initialized. Check SUPABASE_SERVICE_ROLE_KEY environment variable.');
    return NextResponse.json({ error: 'Internal server configuration error' }, { status: 500 });
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('estabelecimentos')
      .select('uf, cidade')
      .eq('status_estabelecimento', 'ativo');

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    // Process data to group cities by state
    const locations: Record<string, string[]> = {};

    data?.forEach((item) => {
      const uf = item.uf?.trim().toUpperCase();
      const cidade = item.cidade?.trim();

      if (uf && cidade) {
        if (!locations[uf]) {
          locations[uf] = [];
        }
        if (!locations[uf].includes(cidade)) {
          locations[uf].push(cidade);
        }
      }
    });

    // Sort states and cities
    const sortedLocations: Record<string, string[]> = {};
    Object.keys(locations)
      .sort()
      .forEach((uf) => {
        sortedLocations[uf] = locations[uf].sort();
      });

    return NextResponse.json(sortedLocations);
  } catch (error) {
    console.error('Unexpected error fetching locations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
