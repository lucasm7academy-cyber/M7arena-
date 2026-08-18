// src/pages/campeonatos.tsx
// NOVA VERSÃO - Página de Campeonatos (Cut-Edge Design System)

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Trophy, Crown, Calendar, Clock, Users, Coins, CreditCard,
  ChevronLeft, ChevronRight, Timer, Sparkles, Target, Swords, Shield, UserCheck, ShieldCheck,
  Search, RefreshCw, X, SlidersHorizontal, Settings, Diamond
} from 'lucide-react';
import { useRole } from '../contexts/RoleContext';
import { api, type ApiLegacyTournament } from '../lib/api';

// ============================================
// POLÍGONOS CUT-EDGE OFICIAIS DA M7 ARENA
// ============================================
const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
const CUT_FRAME_INNER = 'polygon(13.8px 0, 100% 0, 100% calc(100% - 13.8px), calc(100% - 13.8px) 100%, 0 100%, 0 13.8px)';
const CUT_BUTTON = 'polygon(9px 0, 100% 0, 100% calc(100% - 9px), calc(100% - 9px) 100%, 0 100%, 0 9px)';
const CUT_BUTTON_INNER = 'polygon(8.8px 0, 100% 0, 100% calc(100% - 8.8px), calc(100% - 8.8px) 100%, 0 100%, 0 8.8px)';
const CUT_BADGE = 'polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px)';
const CUT_BADGE_INNER = 'polygon(5.8px 0, 100% 0, 100% calc(100% - 5.8px), calc(100% - 5.8px) 100%, 0 100%, 0 5.8px)';

// ============================================
// CACHE DE MÓDULO — persiste durante a sessão do app (SPA)
// Evita re-fetch toda vez que o usuário navega para esta página.
// TTL de 5 minutos; uma nova busca só acontece ao recarregar a aba.
// ============================================
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutos
let _campeonatosCache: { data: any[]; ts: number } | null = null;
let _imagensCache: Record<string, { logo: string; banner: string }> = {};

// ============================================
// CARDS DE DESTAQUE (EM BREVE)
// ============================================

const destaquesCards: any[] = [];

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

const statusPriority: Record<string, number> = {
  'abertas': 1,
  'andamento': 2,
  'breve': 3,
  'finalizado': 4
};

// Mapeia status do banco (snake_case) para o valor exibido nos cards
const mapDbStatus = (dbStatus: string): string => {
  switch (dbStatus) {
    case 'inscricoes_em_breve': return 'breve';
    case 'inscricoes_abertas':  return 'abertas';
    case 'em_andamento':        return 'andamento';
    case 'finalizado':          return 'finalizado';
    default:                    return dbStatus;
  }
};

const Campeonatos = () => {
  const navigate = useNavigate();
  const { role, cargo, loadingRole } = useRole();
  const scrollRef = useRef<HTMLDivElement>(null);
  const torneiosRef = useRef<HTMLDivElement>(null);

  // Estados de filtro e busca
  const [busca, setBusca] = useState('');
  const [filtroModo, setFiltroModo] = useState('todos');
  const [torneiosCustom, setTorneiosCustom] = useState<any[]>([]);
  const [loadingTorneios, setLoadingTorneios] = useState(true);
  const [showSwipeHint, setShowSwipeHint] = useState(true);
  const [torneioImagens, setTorneioImagens] = useState<Record<string, { logo: string; banner: string }>>(_imagensCache);

  useEffect(() => {
    window.scrollTo(0, 0);
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = 0;
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [filtroModo, busca, torneiosCustom]);

  // Esconde a seta de swipe após o usuário interagir com o carrossel (mobile)
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => {
      if (el.scrollLeft > 20) setShowSwipeHint(false);
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [loadingTorneios, torneiosCustom]);

  // Carrega campeonatos da API própria — usa cache de módulo para evitar
  // re-fetch a cada navegação. Só busca de novo se o cache expirou (5 min)
  // ou se for a primeira visita na sessão.
  useEffect(() => {
    if (loadingRole) return;
    let cancelled = false;

    const fetchTorneios = async () => {
      // Cache válido → usa direto, sem spinner
      if (_campeonatosCache && Date.now() - _campeonatosCache.ts < CACHE_TTL_MS) {
        setTorneiosCustom(_campeonatosCache.data);
        setLoadingTorneios(false);
        return;
      }

      setLoadingTorneios(true);
      let data: ApiLegacyTournament[];
      try {
        data = await api.tournaments.list({ sort: 'created_at' });
      } catch (error) {
        if (cancelled) return;
        console.error('Erro ao buscar campeonatos:', error);
        setLoadingTorneios(false);
        return;
      }

      if (cancelled) return;

      const mapped = (data || []).map((t: any) => ({
        id: t.id,
        titulo: t.titulo,
        descricao: t.frase || 'Vagas limitadas, premiação em Pix e o melhor do competitivo de LoL.',
        status: mapDbStatus(t.status),
        vagas: t.vagas,
        tier: t.tier || 'Free Elo',
        data: t.data || '—',
        premio: t.premiacao ? (t.premiacao + (t.tem_outros_premios ? ' + Outros Prêmios' : '')) : '—',
        taxa: t.taxa || '—',
        org: t.organizacao || 'M7 Arena',
        themeColor: t.theme_color || '#FFB700',
        cor: t.theme_color || '#FFB700',
        bgImage: null,
        timesInscritos: t.times_inscritos || [],
        formato: t.formato,
      }));

      // Logo/banner já vêm na própria listagem — não precisa mais do fetch por card
      const imagens: Record<string, { logo: string; banner: string }> = {};
      for (const t of data) {
        imagens[t.id] = {
          logo: t.logo_url || '',
          banner: t.banner_url || '',
        };
      }
      _imagensCache = imagens;
      setTorneioImagens(imagens);

      // Atualiza cache de módulo
      _campeonatosCache = { data: mapped, ts: Date.now() };
      setTorneiosCustom(mapped);
      setLoadingTorneios(false);
    };

    fetchTorneios();
    return () => { cancelled = true; };
  }, [loadingRole]);

  const allCards = [...torneiosCustom, ...destaquesCards];

  const cardsFiltrados = allCards
    .filter(card => {
      const descricao = (card.descricao || card.frase || '').toLowerCase();
      const matchBusca = card.titulo.toLowerCase().includes(busca.toLowerCase()) ||
                         descricao.includes(busca.toLowerCase());
      const matchStatus = filtroModo === 'todos' || card.status === filtroModo;
      return matchBusca && matchStatus;
    })
    .sort((a, b) => {
      const priorityA = (statusPriority as any)[a.status] || 99;
      const priorityB = (statusPriority as any)[b.status] || 99;
      return priorityA - priorityB;
    });

  return (
    <div className="min-h-screen bg-transparent text-white font-sans p-6 md:p-10 overflow-x-hidden relative">
      
      {/* Scanline Overlay */}
      <div className="fixed inset-0 pointer-events-none bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,118,0.06))] bg-[length:100%_2px,3px_100%] z-50 opacity-20" />

      <div className="max-w-[1400px] mx-auto space-y-10 relative z-10">
        
        {/* ============================================ */}
        {/* BANNER PRINCIPAL (ESPAÇO PARA IMAGEM) */}
        {/* ============================================ */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative p-[1px] aspect-[4/5] sm:aspect-video lg:aspect-[2.8/1] w-full group shadow-[0_0_50px_rgba(0,0,0,0.5)]"
          style={{
            clipPath: CUT_FRAME,
            background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(0, 255, 65, 0.3), rgba(255, 255, 255, 0.05))',
          }}
        >
          <div
            className="relative w-full h-full bg-black overflow-hidden"
            style={{ clipPath: CUT_FRAME_INNER }}
          >
            {/* Background Image/Art Placeholder */}
            <div className="absolute inset-0 z-0 overflow-hidden">
              
              {/* Gradiente responsivo: vertical no mobile para legibilidade perfeita do texto na base, horizontal no desktop */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent sm:bg-gradient-to-r sm:from-black sm:via-black/40 sm:to-transparent z-10" />

              <video
                autoPlay
                muted
                loop
                playsInline
                className="w-full h-full object-cover object-[center_15%] opacity-60 transition-transform duration-700 group-hover:scale-105"
              >
                <source src="/images/animated-battle-academia.webm" type="video/webm" />
              </video>

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
                  <span className="text-[#00FF41] text-[10px] md:text-sm font-black uppercase tracking-[0.3em]">
                    SEASON • 2026 
                  </span>
                </div>

                <h1 className="text-2xl sm:text-5xl md:text-7xl font-black uppercase leading-[0.9] tracking-tighter break-words">
                  A Glória Não Espera<br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-white/40">
                  Entre e Conquiste
                  </span>
                </h1>

                <p className="text-white/40 text-[10px] sm:text-sm md:text-lg font-medium max-w-xs sm:max-w-xl leading-relaxed">
                   Entre para os melhores torneios de LoL, dispute premiações em Pix e suba no ranking por PDL. Do Bronze ao Desafiante, o desafio espera por você no Rift.
                </p>

                {/* Action Buttons styled after Cut-Edge */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 md:gap-4 pt-4">
                  <button 
                    onClick={() => torneiosRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                    className="group relative p-[1px] transition-all hover:scale-105 active:scale-95 shadow-[0_0_30px_rgba(0,255,65,0.3)] cursor-pointer"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: 'linear-gradient(135deg, #00FF41, #00CC33)'
                    }}
                  >
                    <div
                      className="px-6 md:px-10 py-3.5 md:py-4 bg-[#00FF41] text-black font-black text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      <span>Ver Torneios</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>

                  <button
                    onClick={() => navigate('/times')}
                    className="group relative p-[1px] transition-all hover:scale-105 active:scale-95 cursor-pointer"
                    style={{
                      clipPath: CUT_BUTTON,
                      background: 'linear-gradient(135deg, rgba(255,255,255,0.3), rgba(255,255,255,0.1))'
                    }}
                  >
                    <div
                      className="px-6 md:px-10 py-3.5 md:py-4 bg-black/80 group-hover:bg-white/10 text-white font-black text-[10px] md:text-xs uppercase tracking-[0.2em] flex items-center justify-center gap-2 transition-colors"
                      style={{ clipPath: CUT_BUTTON_INNER }}
                    >
                      <span>Criar Time</span>
                      <ChevronRight size={14} />
                    </div>
                  </button>
                </div>
              </motion.div>
            </div>

            {/* Destaque Tag Floating */}
            <div className="absolute top-4 right-4 sm:top-6 sm:right-6 z-20">
              <div
                className="p-[1px] backdrop-blur-md shadow-lg"
                style={{
                  clipPath: CUT_BADGE,
                  background: 'linear-gradient(135deg, rgba(0, 255, 65, 0.5), rgba(255, 255, 255, 0.1))',
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-black/70"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  <div className="w-1.5 h-1.5 bg-[#00FF41] animate-pulse" style={{ clipPath: CUT_BADGE }} />
                  <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest text-[#00FF41]">Destaque Principal</span>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ============================================ */}
        {/* CARDS DE DESTAQUE - TORNEIOS EM BREVE */}
        {/* ============================================ */}
        <div ref={torneiosRef} className="space-y-6 scroll-mt-24">
          <p className="text-white/40 text-sm max-w-2xl leading-relaxed">
            Torneios de LoL com premiação em Pix, salas por tier e vagas limitadas.
            Encontre o campeonato ideal para o seu nível e garanta sua inscrição antes que as chaves fechem.
          </p>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3 shrink-0">
              <div
                className="p-[1px] shrink-0"
                style={{
                  clipPath: CUT_BADGE,
                  background: 'linear-gradient(135deg, rgba(255, 183, 0, 0.5), rgba(255, 255, 255, 0.1))'
                }}
              >
                <div
                  className="w-8 h-8 bg-[#08080a] flex items-center justify-center"
                  style={{ clipPath: CUT_BADGE_INNER }}
                >
                  <Trophy className="w-4 h-4 text-[#FFB700]" />
                </div>
              </div>
              <h2 className="text-xl font-black text-white uppercase tracking-widest">
                Campeonatos
              </h2>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Barra de busca Cut-Edge */}
              <div
                className="relative p-[1px] transition-all"
                style={{
                  clipPath: CUT_BUTTON,
                  background: busca ? 'linear-gradient(135deg, #FFB700, rgba(255, 255, 255, 0.1))' : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <div
                  className="relative flex items-center bg-[#08080a]"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <Search className="absolute left-3 w-3.5 h-3.5 text-white/30" />
                  <input
                    type="text"
                    placeholder="BUSCAR TORNEIO..."
                    value={busca}
                    onChange={(e) => setBusca(e.target.value)}
                    className="bg-transparent py-2 pl-9 pr-3 text-white text-[10px] placeholder:text-white/20 focus:outline-none uppercase font-black tracking-wider w-[180px] transition-all"
                  />
                  {busca && (
                    <button
                      onClick={() => setBusca('')}
                      className="absolute right-2 text-white/40 hover:text-white cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Filtro de Status Cut-Edge */}
              <div
                className="relative p-[1px]"
                style={{
                  clipPath: CUT_BUTTON,
                  background: filtroModo !== 'todos' ? 'linear-gradient(135deg, #FFB700, rgba(255, 255, 255, 0.1))' : 'rgba(255, 255, 255, 0.1)'
                }}
              >
                <div
                  className="relative flex items-center bg-[#08080a]"
                  style={{ clipPath: CUT_BUTTON_INNER }}
                >
                  <select
                    value={filtroModo}
                    onChange={(e) => setFiltroModo(e.target.value)}
                    className="bg-transparent px-3 py-2 text-white text-[10px] font-black uppercase tracking-wider focus:outline-none cursor-pointer hover:bg-white/5 transition-colors"
                  >
                    <option value="todos" className="bg-[#08080a]">Todos os Status</option>
                    <option value="andamento" className="bg-[#08080a]">Em andamento</option>
                    <option value="abertas" className="bg-[#08080a]">Inscrições abertas</option>
                    <option value="breve" className="bg-[#08080a]">Inscrições em breve</option>
                  </select>
                </div>
              </div>

              {/* Botão Gerenciar Campeonato Cut-Edge */}
              {(role === 'admin' || cargo === 'organizador') && (
                <button
                  onClick={() => navigate('/admin/criar-campeonato')}
                  className="relative p-[1px] transition-all hover:scale-105 active:scale-95 shadow-[0_0_20px_rgba(255,183,0,0.2)] cursor-pointer group"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: 'linear-gradient(135deg, #FFB700, #FFC837)'
                  }}
                  title="Gerenciar Campeonatos"
                >
                  <div
                    className="w-9 h-9 bg-[#FFB700] hover:bg-[#FFB700]/90 text-black flex items-center justify-center transition-colors"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <Settings className="w-4 h-4" />
                  </div>
                </button>
              )}
            </div>
          </div>

          <div className="relative group/carousel">
            <div 
              ref={scrollRef}
              className="flex gap-5 overflow-x-auto custom-scrollbar pb-6 snap-x snap-mandatory scroll-smooth"
            >
              {loadingTorneios ? (
                <div className="w-full text-center py-20">
                  <div className="flex items-center justify-center gap-3 text-white/30">
                    <RefreshCw className="w-5 h-5 animate-spin" />
                    <span className="font-black uppercase tracking-widest text-sm">Buscando campeonatos...</span>
                  </div>
                </div>
              ) : cardsFiltrados.length === 0 ? (
                <div
                  className="w-full p-[1px] my-6"
                  style={{
                    clipPath: CUT_FRAME,
                    background: 'rgba(255, 255, 255, 0.1)',
                  }}
                >
                  <div
                    className="w-full text-center py-20 bg-[#08080a] flex flex-col items-center justify-center p-6"
                    style={{ clipPath: CUT_FRAME_INNER }}
                  >
                    <Trophy className="w-16 h-16 text-white/10 mb-4" />
                    <p className="text-white/30 font-black uppercase tracking-widest">Nenhum campeonato encontrado</p>
                    <p className="text-white/20 text-xs mt-2 uppercase tracking-widest">Ajuste a busca ou o filtro para ver os torneios disponíveis</p>
                  </div>
                </div>
              ) : (
                cardsFiltrados.map((card, idx) => {
                  const themeColor = (card as any).themeColor || card.cor || '#FFB700';
                  return (
                    <motion.div
                      key={card.id}
                      initial={{ opacity: 0, y: 20 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: 0.1 * idx }}
                      onClick={() => navigate(`/campeonato/${card.id}`)}
                      className="flex-none w-[85vw] sm:w-[340px] lg:w-[calc((100%-40px)/3)] p-[1px] transition-all relative group cursor-pointer snap-start min-h-[320px]"
                      style={{ 
                        clipPath: CUT_FRAME,
                        background: `linear-gradient(135deg, ${themeColor}80, ${themeColor}20, rgba(255, 255, 255, 0.05))`,
                        boxShadow: `0 8px 24px ${themeColor}26`,
                      }}
                    >
                      <div 
                        className="w-full h-full bg-[#08080a] p-6 relative overflow-hidden flex flex-col"
                        style={{
                          clipPath: CUT_FRAME_INNER
                        }}
                      >
                        {/* Background Image (Lazy Loaded Card by Card) */}
                        {torneioImagens[card.id]?.banner ? (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.2 }}
                            className="absolute inset-0 z-0 bg-cover bg-center group-hover:opacity-30 transition-opacity duration-300"
                            style={{ backgroundImage: `url(${torneioImagens[card.id].banner})` }}
                          />
                        ) : torneioImagens[card.id]?.logo ? (
                          <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 0.2 }}
                            className="absolute inset-0 z-0 bg-cover bg-center group-hover:opacity-30 transition-opacity duration-300"
                            style={{ backgroundImage: `url(${torneioImagens[card.id].logo})` }}
                          />
                        ) : (
                          <div className="absolute inset-0 z-0 bg-gradient-to-br from-white/5 to-transparent animate-pulse" />
                        )}
                        {/* Gradient Overlay */}
                        <div
                          className="absolute inset-0 z-0 opacity-80 pointer-events-none"
                          style={{ background: 'linear-gradient(to bottom, transparent 30%, rgba(8, 8, 10, 0.95) 100%)' }}
                        />

                        <div className="relative z-10 flex flex-col h-full">
                          <div className="flex-grow">
                            <div className="mb-2">
                               <h3 className="text-white font-black text-2xl uppercase tracking-tight line-clamp-1">
                                 {card.titulo}
                               </h3>
                            </div>
                            <p className="text-white/40 text-[13px] font-normal leading-snug line-clamp-2 mb-6">
                              {(card as any).descricao}
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
                                <span className="text-base font-medium">Tier: {(card as any).tier || 'Free Elo'}</span>
                              </div>
                              <div className="flex items-center gap-3 text-white/60">
                                <Users className="w-5 h-5 text-blue-400/70" strokeWidth={1.5} />
                                <span className="text-base font-medium">Times: {card.vagas}</span>
                              </div>
                              <div className="flex items-center text-white/40 pt-4">
                                <span className="text-sm font-medium">Organizado por {card.org}</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="pt-6 border-t border-white/10 mt-auto">
                            {card.status === 'breve' ? (
                              <div
                                className="p-[1px] w-[230px]"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: 'linear-gradient(135deg, rgba(255, 255, 255, 0.2), rgba(255, 255, 255, 0.05))',
                                }}
                              >
                                <div 
                                  className="flex items-center gap-2 px-5 py-2.5 bg-[#08080a] w-full h-full justify-start transition-all group-hover:bg-white/5"
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                >
                                  <Clock className="w-4 h-4 text-white/40" />
                                  <span className="text-white/40 text-[11px] font-black uppercase tracking-wider">
                                    Inscrições em breve
                                  </span>
                                </div>
                              </div>
                            ) : card.status === 'andamento' ? (
                              <div
                                className="p-[1px] w-[230px] shadow-[0_0_20px_rgba(255,183,0,0.3)] transition-transform hover:scale-[1.02]"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: 'linear-gradient(135deg, #FFB700, #FFC837)',
                                }}
                              >
                                <div 
                                  className="flex items-center gap-2 px-5 py-2.5 bg-[#FFB700] text-black w-full h-full justify-start"
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                >
                                  <div className="w-2.5 h-2.5 bg-black ml-0.5" style={{ clipPath: CUT_BADGE }} />
                                  <span className="text-black text-[11px] font-black uppercase tracking-wider">
                                    Em andamento
                                  </span>
                                </div>
                              </div>
                            ) : card.status === 'finalizado' ? (
                              <div
                                className="p-[1px] w-[230px] opacity-50 grayscale"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: 'rgba(255, 255, 255, 0.1)',
                                }}
                              >
                                <div 
                                  className="flex items-center gap-2 px-5 py-2.5 bg-[#141419] text-white/40 w-full h-full justify-start"
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                >
                                  <ShieldCheck className="w-4 h-4 text-white/40" />
                                  <span className="text-white/40 text-[11px] font-black uppercase tracking-wider">
                                    Finalizado
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <div
                                className="p-[1px] w-[230px] shadow-[0_0_30px_rgba(0,255,65,0.4)] transition-transform hover:scale-[1.02]"
                                style={{
                                  clipPath: CUT_BUTTON,
                                  background: 'linear-gradient(135deg, #00FF41, #00CC33)',
                                }}
                              >
                                <div 
                                  className="flex items-center gap-2 px-5 py-2.5 bg-[#00FF41] text-black w-full h-full justify-start"
                                  style={{ clipPath: CUT_BUTTON_INNER }}
                                >
                                  <UserCheck className="w-4 h-4 fill-black" />
                                  <span className="text-black text-[11px] font-black uppercase tracking-wider relative z-10">
                                    Inscrições abertas
                                  </span>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            {/* Seta pulsante (heartbeat) — apenas mobile, sumindo após o swipe */}
            {!loadingTorneios && cardsFiltrados.length > 1 && showSwipeHint && (
              <div
                className="sm:hidden absolute right-2 top-1/2 -translate-y-1/2 z-20 pointer-events-none"
                aria-hidden="true"
              >
                <div
                  className="p-[1px] shadow-[0_0_18px_rgba(255,183,0,0.45)] animate-heartbeat backdrop-blur-sm"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: 'linear-gradient(135deg, #FFB700, rgba(255, 183, 0, 0.3))'
                  }}
                >
                  <div
                    className="w-9 h-9 bg-black/80 flex items-center justify-center"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <ChevronRight className="w-5 h-5 text-[#FFB700]" />
                  </div>
                </div>
              </div>
            )}

            {cardsFiltrados.length > 3 && (
              <>
                <button
                  onClick={() => {
                    if (scrollRef.current && scrollRef.current.firstElementChild) {
                      const cardWidth = (scrollRef.current.firstElementChild as HTMLElement).offsetWidth || 340;
                      scrollRef.current.scrollBy({ left: -(cardWidth + 20), behavior: 'smooth' });
                    }
                  }}
                  className="absolute left-0 top-1/2 -translate-y-1/2 -ml-5 p-[1px] transition-all opacity-0 group-hover/carousel:opacity-100 z-10 shadow-lg cursor-pointer"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: 'linear-gradient(135deg, rgba(255, 183, 0, 0.4), rgba(255, 255, 255, 0.1))'
                  }}
                >
                  <div
                    className="w-10 h-10 bg-[#08080a] text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </div>
                </button>
                <button 
                  onClick={() => {
                    if (scrollRef.current && scrollRef.current.firstElementChild) {
                      const cardWidth = (scrollRef.current.firstElementChild as HTMLElement).offsetWidth || 340;
                      scrollRef.current.scrollBy({ left: (cardWidth + 20), behavior: 'smooth' });
                    }
                  }}
                  className="absolute right-0 top-1/2 -translate-y-1/2 -mr-5 p-[1px] transition-all opacity-0 group-hover/carousel:opacity-100 z-10 shadow-lg cursor-pointer"
                  style={{
                    clipPath: CUT_BUTTON,
                    background: 'linear-gradient(135deg, rgba(255, 183, 0, 0.4), rgba(255, 255, 255, 0.1))'
                  }}
                >
                  <div
                    className="w-10 h-10 bg-[#08080a] text-white/60 hover:text-white hover:bg-white/5 flex items-center justify-center transition-colors"
                    style={{ clipPath: CUT_BUTTON_INNER }}
                  >
                    <ChevronRight className="w-5 h-5" />
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Campeonatos;
