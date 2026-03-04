
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
    // Fetch delivery fee config
    const { data: config, error: configError } = await supabaseAdmin
      .from('taxa_entregas')
      .select('*')
      .eq('estabelecimento_id', establishmentId)
      .maybeSingle();

    if (configError) {
      return NextResponse.json({ error: configError.message }, { status: 500 });
    }

    // If no config exists, return default
    if (!config) {
      return NextResponse.json({
        tipo_taxa: 'fixo',
        valor_base: 0,
        ativo: true,
        neighborhoods: []
      });
    }

    // Always fetch neighborhoods if they exist, regardless of current type (for switching back and forth)
    // Or strictly follow type. Let's follow type to be consistent with UI.
    // Actually, UI might need them if user switches back to 'bairro' without saving.
    // But backend should be source of truth.
    
    let neighborhoods: any[] = [];
    
    // Fetch all neighborhoods for this config
    const { data: hoods, error: hoodsError } = await supabaseAdmin
      .from('taxas_bairros')
      .select('*')
      .eq('taxa_entrega_id', config.id)
      .order('nome_bairro');
    
    if (hoodsError) {
      console.error('Error fetching neighborhoods:', hoodsError);
    } else {
      neighborhoods = hoods || [];
    }

    return NextResponse.json({ ...config, neighborhoods });
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
      tipo_taxa, 
      valor_base, 
      preco_km, 
      km_base, 
      distancia_maxima, 
      ativo,
      neighborhoods 
    } = body;

    console.log('[DeliveryConfig] Received payload:', { 
      establishmentId,
      tipo_taxa, 
      neighborhoodsCount: Array.isArray(neighborhoods) ? neighborhoods.length : 'undefined',
      firstNeighborhood: Array.isArray(neighborhoods) && neighborhoods.length > 0 ? neighborhoods[0] : 'none'
    });

    // 1. Get or Create Config
    const { data: existingConfig, error: fetchError } = await supabaseAdmin
      .from('taxa_entregas')
      .select('id')
      .eq('estabelecimento_id', establishmentId)
      .maybeSingle();

    if (fetchError) {
      throw new Error('Error fetching config: ' + fetchError.message);
    }

    let configId;

    if (existingConfig) {
      // Update
      const { data, error } = await supabaseAdmin
        .from('taxa_entregas')
        .update({
          tipo_taxa,
          valor_base: valor_base || 0,
          preco_km: preco_km || 0,
          km_base: km_base || 0,
          distancia_maxima: distancia_maxima || null,
          ativo,
          atualizado_em: new Date().toISOString()
        })
        .eq('id', existingConfig.id)
        .select()
        .single();

      if (error) throw new Error('Error updating config: ' + error.message);
      configId = data.id;
    } else {
      // Insert
      const { data, error } = await supabaseAdmin
        .from('taxa_entregas')
        .insert({
          estabelecimento_id: establishmentId,
          tipo_taxa,
          valor_base: valor_base || 0,
          preco_km: preco_km || 0,
          km_base: km_base || 0,
          distancia_maxima: distancia_maxima || null,
          ativo
        })
        .select()
        .single();

      if (error) throw new Error('Error creating config: ' + error.message);
      configId = data.id;
    }

    // 2. Handle Neighborhoods
    // If tipo_taxa is 'bairro', we MUST sync neighborhoods.
    // If neighborhoods is provided as array, we sync.
    let savedCount = 0;

    if (tipo_taxa === 'bairro') {
      if (!Array.isArray(neighborhoods)) {
        console.warn('[DeliveryConfig] Warning: tipo_taxa is bairro but neighborhoods is not an array');
        // We do not delete existing if payload is malformed/missing to avoid accidental data loss
      } else {
        console.log('[DeliveryConfig] Syncing neighborhoods for configId:', configId);
        console.log('[DeliveryConfig] Deleting old neighborhoods for taxa_entrega_id:', configId);
        
        // Delete existing
        const { error: deleteError } = await supabaseAdmin
          .from('taxas_bairros')
          .delete()
          .eq('taxa_entrega_id', configId);
          
        if (deleteError) {
          console.error('[DeliveryConfig] Error deleting neighborhoods:', deleteError);
          throw new Error('Error clearing old neighborhoods: ' + deleteError.message);
        }

        // Insert new
        if (neighborhoods.length > 0) {
          const hoodsToInsert = neighborhoods.map((n: any) => ({
            taxa_entrega_id: configId,
            nome_bairro: n.nome_bairro,
            valor_taxa: n.valor_taxa
          }));
          
          console.log('[DeliveryConfig] Inserting neighborhoods:', hoodsToInsert);
          
          const { error: insertError, data: insertedData } = await supabaseAdmin
            .from('taxas_bairros')
            .insert(hoodsToInsert)
            .select();
          
          if (insertError) {
            console.error('[DeliveryConfig] Error inserting neighborhoods:', insertError);
            throw new Error('Error inserting neighborhoods: ' + insertError.message);
          }
          
          savedCount = insertedData ? insertedData.length : 0;
          console.log('[DeliveryConfig] Successfully inserted neighborhoods:', savedCount);
        } else {
          console.log('[DeliveryConfig] No neighborhoods to insert');
        }
      }
    } else {
      console.log('[DeliveryConfig] tipo_taxa is NOT bairro, skipping neighborhood sync. Value:', tipo_taxa);
    }

    return NextResponse.json({ success: true, id: configId, neighborhoodsSaved: savedCount });

  } catch (error: any) {
    console.error('[DeliveryConfig] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
