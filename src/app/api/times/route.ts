import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    teams: [
      {
        id: 'team-1',
        name: 'M7 Esports',
        tag: 'M7E',
        logoUrl: '/images/background.png',
        gradientFrom: '#FFB700',
        gradientTo: '#FF6600',
        pdl: 1850,
        winrate: 74,
        ranking: 1,
        wins: 45,
        gamesPlayed: 60,
        donoId: 'dono-1',
      },
      {
        id: 'team-2',
        name: 'Pain Gaming Fanatics',
        tag: 'PGF',
        logoUrl: '/images/fundoryzecortado.png',
        gradientFrom: '#0044FF',
        gradientTo: '#00D4FF',
        pdl: 1620,
        winrate: 65,
        ranking: 2,
        wins: 38,
        gamesPlayed: 58,
        donoId: 'dono-2',
      },
    ],
    total: 2,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      team: {
        id: `team-${Date.now()}`,
        ...body,
        pdl: 0,
        winrate: 0,
        ranking: 3,
        wins: 0,
        gamesPlayed: 0,
      },
    });
  } catch {
    return NextResponse.json({ message: 'Erro ao processar requisição' }, { status: 400 });
  }
}
