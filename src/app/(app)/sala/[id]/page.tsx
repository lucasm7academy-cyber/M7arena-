'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Swords, Users, Shield } from 'lucide-react';

export default function SalaDetalhesPage() {
  const params = useParams();
  const router = useRouter();
  const salaId = params?.id as string;

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <button
          onClick={() => router.push('/jogar')}
          className="flex items-center gap-2 text-white/50 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors cursor-pointer font-headline"
        >
          <ArrowLeft size={16} /> Voltar para Lobbies
        </button>

        <div className="rounded-3xl border border-white/10 p-8 bg-black/40 backdrop-blur-md">
          <h1 className="text-3xl font-black uppercase text-white font-headline">Sala #{salaId}</h1>
          <p className="text-white/40 text-sm mt-2">Lobby de partida e chat em tempo real.</p>
        </div>
      </div>
    </div>
  );
}
