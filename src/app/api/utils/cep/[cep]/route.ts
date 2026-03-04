
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ cep: string }> }
) {
  const { cep } = await params;

  if (!cep || cep.length !== 8) {
    return NextResponse.json(
      { error: 'CEP inválido' },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`, {
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error(`ViaCEP returned status ${response.status}`);
    }

    const data = await response.json();

    if (data.erro) {
      return NextResponse.json(
        { error: 'CEP não encontrado' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Erro ao consultar ViaCEP:', error);
    return NextResponse.json(
      { error: 'Erro ao consultar serviço de CEP' },
      { status: 500 }
    );
  }
}
