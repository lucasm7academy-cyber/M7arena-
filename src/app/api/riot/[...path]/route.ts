import { NextResponse } from "next/server";

const RIOT_API_BASE = "https://br1.api.riotgames.com";
const RIOT_AMERICAS_BASE = "https://americas.api.riotgames.com";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const { path } = await params;
  const apiKey = process.env.RIOT_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      { error: "Chave da Riot API não configurada no servidor." },
      { status: 500 }
    );
  }

  const pathString = path.join("/");
  const isAmericas = pathString.startsWith("account/v1") || pathString.startsWith("match/v5");
  const baseUrl = isAmericas ? RIOT_AMERICAS_BASE : RIOT_API_BASE;
  const targetUrl = `${baseUrl}/${pathString}`;

  try {
    const res = await fetch(targetUrl, {
      headers: {
        "X-Riot-Token": apiKey,
      },
      next: { revalidate: 300 }, // Cache de 5 minutos no Next.js
    } as any);

    if (!res.ok) {
      return NextResponse.json(
        { error: `Erro na Riot API: ${res.statusText}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Falha na comunicação com a Riot API." },
      { status: 500 }
    );
  }
}
