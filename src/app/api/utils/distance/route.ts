
import { NextResponse } from 'next/server';
import { geocodeAddress, calculateDistance } from '@/lib/geocoding';

export async function POST(request: Request) {
  try {
    const { origin, destination } = await request.json();

    if (!origin || !destination) {
      return NextResponse.json(
        { error: 'Endereços de origem e destino são obrigatórios' },
        { status: 400 }
      );
    }

    console.log('[Distance API] Calculating distance...');
    console.log('[Distance API] Origin:', origin);
    console.log('[Distance API] Destination:', destination);

    const [originCoords, destinationCoords] = await Promise.all([
      geocodeAddress(origin),
      geocodeAddress(destination)
    ]);

    if (!originCoords) {
      console.error('[Distance API] Could not geocode origin');
      return NextResponse.json(
        { error: 'Não foi possível localizar o endereço de origem' },
        { status: 400 }
      );
    }

    if (!destinationCoords) {
      console.error('[Distance API] Could not geocode destination');
      return NextResponse.json(
        { error: 'Não foi possível localizar o endereço de destino' },
        { status: 400 }
      );
    }

    const distance = calculateDistance(originCoords, destinationCoords);
    
    console.log('[Distance API] Coords:', { origin: originCoords, destination: destinationCoords });
    console.log('[Distance API] Distance:', distance);

    return NextResponse.json({
      distance,
      originCoords,
      destinationCoords
    });
  } catch (error: any) {
    console.error('[Distance API] Error:', error);
    return NextResponse.json(
      { error: 'Erro ao calcular distância' },
      { status: 500 }
    );
  }
}
