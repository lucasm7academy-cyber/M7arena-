import { NextResponse } from 'next/server';

export async function GET() {
  // Retorna a lista de notificações para o usuário logado (ex: convites pendentes e atualizações)
  return NextResponse.json({
    notifications: [],
    count: 0,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, notifId, conviteId, timeId, role } = body;

    if (action === 'clear_all') {
      return NextResponse.json({ success: true, notifications: [] });
    }

    if (action === 'accept' || action === 'decline') {
      return NextResponse.json({ success: true, notifId });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ message: 'Erro ao processar ação de notificação' }, { status: 400 });
  }
}
