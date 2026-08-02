import { NextResponse } from 'next/server';

export async function GET() {
  // Retorna a lista de campeonatos cadastrados
  return NextResponse.json({
    campeonatos: [
      {
        id: 'camp-1',
        titulo: 'M7 Premier League - Edição I',
        frase: 'O maior torneio amador da Summoner’s Rift.',
        status: 'inscricoes_abertas',
        vagas: '16/32',
        tier: 'Free Elo',
        data: '15/08/2026',
        premiacao: 'R$ 1.500,00',
        taxa: 'Grátis',
        tem_outros_premios: true,
        outros_premios: 'RP + Troféu',
        theme_color: '#FFB700',
        formato: 'Eliminatória Dupla',
        organizacao: 'M7 Arena',
      },
    ],
    total: 1,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      campeonato: {
        id: `camp-${Date.now()}`,
        ...body,
        created_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ message: 'Erro ao criar campeonato' }, { status: 400 });
  }
}
