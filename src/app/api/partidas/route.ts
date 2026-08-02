import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  // Retorna lista de partidas do usuário ou salas abertas
  return NextResponse.json({
    partidas: [],
    total: 0,
    userId: userId || null,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      sala: {
        id: `sala-${Date.now()}`,
        modo: body.modo || '5v5',
        nome: body.nome || 'Nova Sala',
        created_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ message: 'Erro ao criar sala' }, { status: 400 });
  }
}
