import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const offset = parseInt(searchParams.get('offset') || '0', 10);
  const limit = parseInt(searchParams.get('limit') || '40', 10);
  const search = searchParams.get('search') || '';

  // Retorna mock inicial estático e seguro para preencher a listagem em dev/build
  const jogadores = Array.from({ length: 12 }, (_, i) => ({
    id: `player-${i + 1}`,
    riotId: `Invocador#${1000 + i}`,
    nome: `Invocador ${i + 1}`,
    nivel: 30 + i * 2,
    elo: 'Platina' as const,
    iconeId: 1,
    partidas: 120 + i * 5,
    winRate: 58,
    titulos: 1,
    rolePrincipal: 'TOP' as const,
    roleSecundaria: 'JG' as const,
    isVIP: i % 3 === 0,
    isVerified: true,
    kda: 3.8,
    csPorMinuto: 7.5,
    participacaoKill: 68,
    conquistas: ['MVPs do Mês'],
    mp: 250,
    mc: 50,
  }));

  const totalCount = 12;

  return NextResponse.json({ jogadores, totalCount });
}
