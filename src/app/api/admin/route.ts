import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    stats: {
      totalUsers: 1248,
      totalTeams: 86,
      totalMatches: 412,
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, userId, amount, currency } = body;

    if (action === 'adjust_balance') {
      return NextResponse.json({
        success: true,
        userId,
        newBalance: amount,
        currency: currency || 'MC',
      });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'Erro em operação administrativa' }, { status: 400 });
  }
}
