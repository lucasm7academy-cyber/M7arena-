import { NextResponse } from 'next/server';

// Rota de API para vagas de recrutamento
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const role = searchParams.get('role');

  // Retorna os posts de recrutamento
  return NextResponse.json({
    posts: [],
    roleFilter: role || null,
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({
      success: true,
      post: {
        id: `rec-${Date.now()}`,
        ...body,
        created_at: new Date().toISOString(),
      },
    });
  } catch {
    return NextResponse.json({ message: 'Erro ao criar vaga' }, { status: 400 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    return NextResponse.json({ success: true, post: body });
  } catch {
    return NextResponse.json({ message: 'Erro ao atualizar vaga' }, { status: 400 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    return NextResponse.json({ success: true, id });
  } catch {
    return NextResponse.json({ message: 'Erro ao deletar vaga' }, { status: 400 });
  }
}
