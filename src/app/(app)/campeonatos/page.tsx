'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Trophy,
  Crown,
  Calendar,
  Clock,
  Users,
  Coins,
  CreditCard,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Search,
  RefreshCw,
  Diamond,
} from 'lucide-react';

const statusPriority: Record<string, number> = {
  abertas: 1,
  andamento: 2,
  breve: 3,
  finalizado: 4,
};

const mapDbStatus = (dbStatus: string): string => {
  switch (dbStatus) {
    case 'inscricoes_em_breve':
      return 'breve';
    case 'inscricoes_abertas':
      return 'abertas';
    case 'em_andamento':
      return 'andamento';
    case 'finalizado':
      return 'finalizado';
    default:
      return dbStatus;
  }
};

export default function CampeonatosPage() {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const torneiosRef = useRef<HTMLDivElement>(null);

  const [busca, setBusca] = useState('');
  const [filtroModo, setFiltroModo] = useState('todos');
  const [torneios, setTorneios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTorneios() {
      setLoading(true);
      try {
        const res = await fetch('/api/campeonatos');
        if (res.ok) {
          const data = await res.json();
          const mapped = (data.campeonatos || []).map((t: any) => ({
            id: t.id,
            titulo: t.titulo,
            descricao: t.frase || 'Prepare seu time para a arena oficial.',
            status: mapDbStatus(t.status),
            vagas: t.vagas,
            tier: t.tier || 'Free Elo',
            data: t.data || '—',
            premio: t.premiacao ? t.premiacao + (t.tem_outros_premios ? ' + Outros Prêmios' : '') : '—',
            taxa: t.taxa || '—',
            org: t.organizacao || 'M7 Arena',
            themeColor: t.theme_color || '#FFB700',
            cor: t.theme_color || '#FFB700',
            formato: t.formato,
          }));
          setTorneios(mapped);
        }
      } catch {
        setTorneios([]);
      } finally {
        setLoading(false);
      }
    }
    loadTorneios();
  }, []);

  const cardsFiltrados = torneios
    .filter((card) => {
      const desc = (card.descricao || '').toLowerCase();
      const matchBusca =
        card.titulo.toLowerCase().includes(busca.toLowerCase()) || desc.includes(busca.toLowerCase());
      const matchStatus = filtroModo === 'todos' || card.status === filtroModo;
      return matchBusca && matchStatus;
    })
    .sort((a, b) => {
      const priorityA = statusPriority[a.status] || 99;
      const priorityB = statusPriority[b.status] || 99;
      return priorityA - priorityB;
    });

  return (
    <div className="min-h-screen bg-[#050505] text-white font-sans p-6 md:p-10 overflow-x-hidden relative">
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-50 opacity-20" />

      <div className="max-w-[1400px] mx-auto space-y-10 relative z-10">
        {/* BANNER PRINCIPAL */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-xl overflow-hidden border border-white/10 aspect-[4/5] sm:aspect-video lg:aspect-[2.8/1] w-full flex group bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)]"
        >
          <div className="absolute inset-0 z-0 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent sm:bg-gradient-to-r sm:from-black sm:via-black/40 sm:to-transparent z-10" />
            <img
              src="/images/fundoryzecortado.png"
              alt="Ryze"
              className="w-full h-full object-cover object-[center_15%] opacity-60 transition-transform duration-700 group-hover:scale-105"
            />
          </div>

          {/* Content Wrapper */}
          <div className="relative z-20 flex flex-col justify-end sm:justify-center px-5 sm:px-12 md:px-20 pb-8 pt-20 sm:py-10 max-w-4xl w-full h-full">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 }}
              className="space-y-4 md:space-y-6"
            >
              <div className="flex items-center gap-2">
                <div className="w-8 h-px bg-[#00FF41]" />
                <span className="text-[#00FF41] text-[10px] md:text-sm font-black uppercase tracking-[0.3em] font-headline">
                  SEASON • 2026
                </span>
              </div>

              <h1 className="text-2xl sm:text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter font-headline break-words">
                A Glória Não Espera<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">
                  Entre e Conquiste
                </span>
              </h1>

              <p className="text-white/40 text-[10px] sm:text-sm md:text-lg font-medium max-w-xs sm:max-w-xl leading-relaxed">
                Entre para os melhores torneios, conquiste prêmios e escreva seu nome na história da M7 Arena. O desafio espera por você no Rift.
              </p>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 pt-4">
                <button
                  onClick={() => torneiosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  className="group relative px-6 md:px-10 py-3.5 md:py-4 bg-[#00FF41] text-black font-black text-[10px] md:text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,255,65,0.3)] cursor-pointer font-headline flex items-center justify-center gap-2"
                  style={{
                    clipPath: 'polygon(0 0, 100% 0, 100% 70%, 90% 100%, 0 100%)',
                  }}
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Ver Torneios <ChevronRight size={14} />
                  </span>
                </button>

                <button
                  onClick={() => router.push('/times')}
                  className="group relative px-6 md:px-10 py-3.5 md:py-4 border border-white/20 text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] overflow-hidden transition-all hover:bg-white/5 hover:border-white/40 active:scale-95 rounded-sm cursor-pointer font-headline flex items-center justify-center gap-2"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    Criar Time <ChevronRight size={14} />
                  </span>
                </button>
              </div>
            </motion.div>
          </div>

          <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
            <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/50 backdrop-blur-md border border-white/10 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-[#00FF41] animate-pulse" />
              <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-[#00FF41] font-headline">
                Destaque Principal
              </span>
            </div>
          </div>
        </motion.div>

        {/* CARDS DE TORNEIOS */}
        <div ref={torneiosRef} className="space-y-6 scroll-mt-24">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-[#FFB700]" />
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest font-headline">
                Campeonatos
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/20" />
                <input
                  type="text"
                  placeholder="BUSCAR TORNEIO..."
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="bg-white/5 border border-white/10 rounded-lg py-2 pl-9 pr-3 text-white text-[10px] placeholder:text-white/20 focus:outline-none focus:border-[#FFB700]/50 uppercase font-black tracking-wider w-[180px] transition-all font-headline"
                />
              </div>

              <select
                value={filtroModo}
                onChange={(e) => setFiltroModo(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-white text-[10px] font-black uppercase tracking-wider focus:outline-none cursor-pointer hover:bg-white/10 transition-colors font-headline"
              >
                <option value="todos" className="bg-black">Todos os Status</option>
                <option value="andamento" className="bg-black">Em andamento</option>
                <option value="abertas" className="bg-black">Inscrições abertas</option>
                <option value="breve" className="bg-black">Inscrições em breve</option>
              </select>
            </div>
          </div>

          <div className="relative group/carousel">
            <div
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto custom-scrollbar pb-6 snap-x snap-mandatory scroll-smooth"
            >
              {loading ? (
                <div className="w-full text-center py-20">
                  <div className="flex items-center justify-center gap-3 text-white/30">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="font-black uppercase tracking-widest text-sm font-headline">
                      Carregando campeonatos...
                    </span>
                  </div>
                </div>
              ) : cardsFiltrados.length === 0 ? (
                <div className="w-full text-center py-20 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
                  <Trophy className="w-16 h-16 text-white/10 mx-auto mb-4" />
                  <p className="text-white/30 font-black uppercase tracking-widest font-headline">
                    Nenhum campeonato encontrado
                  </p>
                </div>
              ) : (
                cardsFiltrados.map((card, idx) => (
                  <motion.div
                    key={card.id}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.1 * idx }}
                    onClick={() => router.push(`/campeonatos/${card.id}`)}
                    className="flex-none w-[85vw] sm:w-[340px] lg:w-[calc((100%-40px)/3)] p-[2px] transition-all relative group cursor-pointer snap-start min-h-[320px]"
                    style={{
                      backgroundColor: `${card.themeColor || card.cor}80`,
                      boxShadow: `0 8px 24px ${card.themeColor || card.cor}26`,
                      clipPath:
                        'polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px)',
                    }}
                  >
                    <div
                      className="w-full h-full bg-[#0A0A0A] flex flex-col p-6 relative overflow-hidden"
                      style={{
                        clipPath:
                          'polygon(11px 0, 100% 0, 100% calc(100% - 11px), calc(100% - 11px) 100%, 0 100%, 0 11px)',
                      }}
                    >
                      <div className="relative z-10 flex flex-col h-full">
                        <div className="flex-grow">
                          <div className="mb-2">
                            <h3 className="text-white font-black text-2xl uppercase tracking-tight line-clamp-1 font-headline">
                              {card.titulo}
                            </h3>
                          </div>
                          <p className="text-white/40 text-[13px] font-normal leading-snug line-clamp-2 mb-6">
                            {card.descricao}
                          </p>

                          <div className="mt-4 space-y-2 mb-6">
                            <div className="flex items-center gap-3 text-white/60">
                              <Coins className="w-5 h-5 text-yellow-400/70" strokeWidth={1.5} />
                              <span className="text-base font-medium">Prêmio: {card.premio}</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/60">
                              <CreditCard className="w-5 h-5 text-blue-400/70" strokeWidth={1.5} />
                              <span className="text-base font-medium">Taxa: {card.taxa}</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/60">
                              <Calendar className="w-5 h-5 text-[#FFB700]/70" strokeWidth={1.5} />
                              <span className="text-base font-medium">{card.data}</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/60">
                              <Diamond size={20} color="#14b8a6" />
                              <span className="text-base font-medium">Tier: {card.tier || 'Free Elo'}</span>
                            </div>
                            <div className="flex items-center gap-3 text-white/60">
                              <Users className="w-5 h-5 text-blue-400/70" strokeWidth={1.5} />
                              <span className="text-base font-medium">Times: {card.vagas}</span>
                            </div>
                            <div className="flex items-center text-white/40 pt-4">
                              <span className="text-sm font-medium">Organização {card.org}</span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-6 border-t border-white/10 mt-auto">
                          {card.status === 'breve' ? (
                            <div
                              className="p-px w-[230px] bg-white/10"
                              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                            >
                              <div
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#0A0A0A] w-full h-full justify-start transition-all hover:bg-white/5"
                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                              >
                                <Clock className="w-4 h-4 text-white/40" />
                                <span className="text-white/40 text-[11px] font-black uppercase tracking-wider font-headline">
                                  Inscrições em breve
                                </span>
                              </div>
                            </div>
                          ) : card.status === 'andamento' ? (
                            <div
                              className="p-px w-[230px] shadow-[0_0_20px_rgba(255,183,0,0.3)] bg-[#FFB700] hover:scale-[1.02] transition-transform"
                              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                            >
                              <div
                                className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-[#FFB700] via-[#FFC837] to-[#FFB700] text-black w-full h-full justify-start"
                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                              >
                                <div className="w-2.5 h-2.5 rounded-full bg-black ml-0.5" />
                                <span className="text-black text-[11px] font-black uppercase tracking-wider font-headline">
                                  Em andamento
                                </span>
                              </div>
                            </div>
                          ) : card.status === 'finalizado' ? (
                            <div
                              className="p-px w-[230px] bg-white/5 grayscale opacity-50"
                              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                            >
                              <div
                                className="flex items-center gap-2 px-5 py-2.5 bg-white/10 w-full h-full justify-start"
                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                              >
                                <ShieldCheck className="w-4 h-4 text-white/40" />
                                <span className="text-white/40 text-[11px] font-black uppercase tracking-wider font-headline">
                                  Finalizado
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div
                              className="p-px w-[230px] shadow-[0_0_30px_rgba(0,255,65,0.6)] bg-[#00FF41] hover:scale-[1.02] transition-transform"
                              style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                            >
                              <div
                                className="flex items-center gap-2 px-5 py-2.5 bg-[#00FF41] text-black w-full h-full justify-start"
                                style={{ clipPath: 'polygon(0 0, 100% 0, 100% 70%, 92% 100%, 0 100%)' }}
                              >
                                <UserCheck className="w-4 h-4 fill-black" />
                                <span className="text-black text-[11px] font-black uppercase tracking-wider relative z-10 font-headline">
                                  Inscrições abertas
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
