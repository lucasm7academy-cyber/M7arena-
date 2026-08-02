import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    streams: [
      {
        id: 'stream-1',
        user_id: 'user-1',
        twitch_channel: 'm7stream',
        stream_title: 'Transmissão Oficial M7Arena — Torneio ao Vivo!',
        viewer_count: 142,
        thumbnail_url: '/images/fundoryzecortado.png',
        ao_vivo: true,
        updated_at: new Date().toISOString(),
      },
    ],
  });
}
