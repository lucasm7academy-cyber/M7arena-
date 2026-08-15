// src/components/admin/FinanceiroDashboard.tsx
// Dashboard financeiro do painel admin (ADR-032). Gráfico estilo barbearia:
// cards bento clicáveis (faturamento/saques/lucro) que filtram a linha exibida,
// com período (hoje/7/30/tudo) e SVG de linhas com área + tooltip no hover.
// Fonte dos dados: GET /api/admin/financeiro (servidor agrega, nunca o cliente).
import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { api, type ApiFinanceiro } from '../../lib/api';

type Periodo = 'today' | '7' | '30' | 'all';
type Filtro = 'faturamento' | 'saques' | 'lucro' | null;

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'today', label: 'Hoje' },
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: 'all', label: 'Todo histórico' },
];

const CORES = {
  faturamento: '#FFB700',
  saques: '#FF3131',
  lucro: '#00FF41',
};

function CardStyle() {
  return {
    border: '1px solid rgba(255,255,255,0.08)',
    background: 'linear-gradient(180deg, rgba(22, 28, 44, 0.8) 0%, rgba(15, 19, 30, 0.9) 100%)',
    boxShadow: '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
    backdropFilter: 'blur(16px)',
  };
}

const fmtBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const fmtCurto = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `R$ ${(v / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
  if (abs >= 1_000) return `R$ ${(v / 1_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k`;
  return fmtBRL(v);
};

export function FinanceiroDashboard() {
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const [dados, setDados] = useState<ApiFinanceiro | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [carregando, setCarregando] = useState(true);

  const carregar = useCallback(async (p: Periodo) => {
    setCarregando(true);
    try {
      const r = await api.adminFinanceiro.get(p);
      setDados(r);
    } catch {
      setDados(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar(periodo);
  }, [periodo, carregar]);

  const serie = dados?.serie ?? [];
  const temDados = serie.length > 0;
  const totalFaturamento = dados?.totais.faturamento ?? 0;
  const totalSaques = dados?.totais.saques ?? 0;
  const totalLucro = dados?.totais.lucro ?? 0;

  const toggleFiltro = (f: Exclude<Filtro, null>) =>
    setFiltro(prev => (prev === f ? null : f));

  const cards = [
    {
      id: 'faturamento' as const,
      label: 'Faturamento',
      valor: totalFaturamento,
      sub: 'Venda de MC (R$)',
      icone: TrendingUp,
      cor: CORES.faturamento,
      ativo: filtro === null || filtro === 'faturamento',
    },
    {
      id: 'saques' as const,
      label: 'Saques',
      valor: totalSaques,
      sub: 'Pago ao cliente (R$)',
      icone: TrendingDown,
      cor: CORES.saques,
      ativo: filtro === null || filtro === 'saques',
    },
    {
      id: 'lucro' as const,
      label: 'Lucro',
      valor: totalLucro,
      sub: 'MC retido em taxas (R$)',
      icone: Wallet,
      cor: CORES.lucro,
      ativo: filtro === null || filtro === 'lucro',
    },
  ];

  const maxChartValue = Math.max(
    10,
    ...serie.map(d => {
      if (filtro === 'faturamento') return Math.max(d.faturamento, 10);
      if (filtro === 'saques') return Math.max(d.saques, 10);
      if (filtro === 'lucro') return Math.max(d.lucro, 10);
      return Math.max(d.faturamento, d.saques, d.lucro, 10);
    })
  );

  const len = serie.length;
  const getX = (index: number) => (len > 1 ? (index * 540) / (len - 1) : 270);
  const getY = (val: number) => 170 - (Math.max(0, val) / maxChartValue) * 150;

  const pontos = (campo: 'faturamento' | 'saques' | 'lucro') =>
    serie.map((d, idx) => ({ x: getX(idx), y: getY(d[campo]), data: d }));

  const linhas = {
    faturamento: pontos('faturamento'),
    saques: pontos('saques'),
    lucro: pontos('lucro'),
  };

  const pathDe = (pts: { x: number; y: number }[]) =>
    pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

  const areaDe = (pts: { x: number; y: number }[]) =>
    pts.length > 0 ? `${pathDe(pts)} L ${pts[pts.length - 1].x} 170 L ${pts[0].x} 170 Z` : '';

  const porHora = periodo === 'today';
  const rotuloX = (data: string) => {
    if (porHora) {
      const m = data.match(/^(\d{4})-(\d{2})-(\d{2}) (\d{2}):00$/);
      return m ? `${Number(m[4])}h` : data;
    }
    const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}` : data;
  };

  const filtroAtivo = filtro ?? 'todos';
  const referencia = filtro === 'faturamento' ? linhas.faturamento
    : filtro === 'saques' ? linhas.saques
    : filtro === 'lucro' ? linhas.lucro
    : linhas.lucro;

  return (
    <div className="rounded-2xl p-5 lg:p-6 space-y-5 shadow-xl" style={CardStyle()}>
      {/* Header + seletor de período */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-black text-sm uppercase tracking-wider flex items-center gap-2">
            <Wallet className="w-4 h-4 text-primary" /> Financeiro
          </h3>
          <p className="text-zinc-400 text-[11px] mt-0.5">Faturamento, saques e lucro · R$1 = 100 MC</p>
        </div>
        <div className="flex gap-1 p-1 rounded-xl bg-[#0e1320] border border-white/10 self-start shadow-inner">
          {PERIODOS.map(p => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                periodo === p.id ? 'bg-gradient-to-r from-primary to-yellow-500 text-black shadow-md' : 'text-zinc-400 hover:text-white hover:bg-white/[0.08]'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cards bento clicáveis */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {cards.map(c => {
          const Icon = c.icone;
          return (
            <button
              key={c.id}
              onClick={() => toggleFiltro(c.id)}
              className={`p-4 rounded-2xl text-left transition-all border ${
                c.ativo ? 'bg-[#131a29] border-white/15 hover:bg-[#192236] shadow-md' : 'bg-[#0e1320]/60 border-white/5 opacity-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">{c.label}</span>
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shadow-sm"
                  style={{ background: `${c.cor}18`, border: `1px solid ${c.cor}35` }}>
                  <Icon className="w-4 h-4" style={{ color: c.cor }} />
                </div>
              </div>
              {carregando ? (
                <div className="h-7 w-24 bg-white/5 rounded-md animate-pulse" />
              ) : (
                <p className="text-2xl font-black tracking-tighter" style={{ color: c.cor }}>
                  {fmtBRL(c.valor)}
                </p>
              )}
              <p className="text-[10px] text-zinc-400 mt-1">{c.sub}</p>
            </button>
          );
        })}
      </div>

      {/* Dinheiro no projeto (não entra na série — é snapshot) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="p-4 rounded-2xl border border-[#00F0FF]/30 bg-[#00F0FF]/[0.04] shadow-md">
          <p className="text-[10px] font-black text-zinc-400 uppercase tracking-widest">Dinheiro no projeto</p>
          {carregando ? (
            <div className="h-7 w-28 bg-white/5 rounded-md animate-pulse mt-1" />
          ) : (
            <p className="text-2xl font-black tracking-tighter text-[#00F0FF] mt-0.5">
              {fmtBRL(dados?.totais.dinheiroNoProjeto ?? 0)}
            </p>
          )}
          <p className="text-[10px] text-zinc-400 mt-1">
            {(dados?.totais.mcEmCirculacao ?? 0).toLocaleString('pt-BR')} MC em circulação
          </p>
        </div>
      </div>

      {/* Gráfico SVG */}
      <div className="border border-white/10 rounded-2xl p-4 bg-[#0e1320]/80 space-y-3 shadow-inner">
        <h4 className="text-xs text-zinc-300 font-bold tracking-wide">
          {filtro === 'faturamento' && 'Evolução do Faturamento'}
          {filtro === 'saques' && 'Evolução de Saques'}
          {filtro === 'lucro' && 'Evolução do Lucro'}
          {filtro === null && 'Evolução Financeira'}
        </h4>

        {!carregando && !temDados ? (
          <div className="py-10 text-center border border-dashed border-white/10 rounded-xl">
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-wider">Nenhum movimento no período</p>
          </div>
        ) : carregando ? (
          <div className="flex items-center justify-center py-10">
            <RefreshCw className="w-5 h-5 text-zinc-400 animate-spin" />
          </div>
        ) : (
          <div className="relative w-full h-56 flex flex-col">
            <div className="relative w-full h-48 flex">
              {/* Eixo Y */}
              <div className="w-12 h-full flex flex-col justify-between items-end pr-2 py-2 select-none text-[10px] font-medium text-zinc-400 leading-none shrink-0">
                {[1, 0.75, 0.5, 0.25, 0].map((ratio, idx) => (
                  <span key={idx} className="whitespace-nowrap">{fmtCurto(ratio * maxChartValue)}</span>
                ))}
              </div>

              {/* Plot */}
              <div className="relative flex-1 h-full min-w-0">
                <svg viewBox="0 0 540 180" className="w-full h-full overflow-visible" preserveAspectRatio="none">
                  <defs>
                    {(['faturamento', 'saques', 'lucro'] as const).map(campo => (
                      <linearGradient key={campo} id={`glow-${campo}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={CORES[campo]} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={CORES[campo]} stopOpacity="0" />
                      </linearGradient>
                    ))}
                  </defs>

                  {/* Grid */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, idx) => (
                    <line key={idx} x1="0" y1={170 - ratio * 150} x2="540" y2={170 - ratio * 150}
                      stroke="rgba(255,255,255,0.08)" strokeDasharray="3,3" strokeWidth="1" />
                  ))}
                  <line x1="0" y1="170" x2="540" y2="170" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />

                  {/* Áreas */}
                  {filtroAtivo === 'faturamento' || filtroAtivo === 'todos' ? (
                    <path d={areaDe(linhas.faturamento)} fill="url(#glow-faturamento)" />
                  ) : null}
                  {filtroAtivo === 'saques' || filtroAtivo === 'todos' ? (
                    <path d={areaDe(linhas.saques)} fill="url(#glow-saques)" />
                  ) : null}
                  {filtroAtivo === 'lucro' || filtroAtivo === 'todos' ? (
                    <path d={areaDe(linhas.lucro)} fill="url(#glow-lucro)" />
                  ) : null}

                  {/* Linhas */}
                  {filtroAtivo === 'faturamento' || filtroAtivo === 'todos' ? (
                    <path d={pathDe(linhas.faturamento)} fill="none" stroke={CORES.faturamento} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(255,183,0,0.35)]" />
                  ) : null}
                  {filtroAtivo === 'saques' || filtroAtivo === 'todos' ? (
                    <path d={pathDe(linhas.saques)} fill="none" stroke={CORES.saques} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(255,49,49,0.3)]" />
                  ) : null}
                  {filtroAtivo === 'lucro' || filtroAtivo === 'todos' ? (
                    <path d={pathDe(linhas.lucro)} fill="none" stroke={CORES.lucro} strokeWidth="2.5"
                      strokeLinecap="round" strokeLinejoin="round" className="drop-shadow-[0_2px_4px_rgba(0,255,65,0.3)]" />
                  ) : null}

                  {/* Tooltip hover */}
                  {referencia.map((p, index) => {
                    const alvo = serie[index];
                    if (!alvo) return null;
                    return (
                      <g key={index} className="group cursor-pointer">
                        <foreignObject
                          x={Math.max(p.x - 75, 5)}
                          y={Math.min(Math.max(p.y - 95, 5), 90)}
                          width="150"
                          height="90"
                          className="opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 overflow-visible"
                        >
                          <div className="bg-[#131a29] border border-white/15 text-zinc-300 text-[11px] p-2.5 rounded-xl shadow-2xl space-y-1 leading-tight select-none">
                            <div className="font-black text-white text-center border-b border-white/10 pb-1 mb-1">
                              {rotuloX(alvo.data)}
                            </div>
                            {(filtro === null || filtro === 'faturamento') && (
                              <div className="flex justify-between gap-2">
                                <span className="text-zinc-400">Faturamento</span>
                                <span className="font-bold" style={{ color: CORES.faturamento }}>{fmtBRL(alvo.faturamento)}</span>
                              </div>
                            )}
                            {(filtro === null || filtro === 'saques') && (
                              <div className="flex justify-between gap-2">
                                <span className="text-zinc-400">Saques</span>
                                <span className="font-bold" style={{ color: CORES.saques }}>{fmtBRL(alvo.saques)}</span>
                              </div>
                            )}
                            {(filtro === null || filtro === 'lucro') && (
                              <div className="flex justify-between gap-2">
                                <span className="text-zinc-400">Lucro</span>
                                <span className="font-bold" style={{ color: CORES.lucro }}>{fmtBRL(alvo.lucro)}</span>
                              </div>
                            )}
                          </div>
                        </foreignObject>
                      </g>
                    );
                  })}
                </svg>
              </div>
            </div>

            {/* Eixo X */}
            <div className="w-full pl-12 flex justify-between items-center pt-2 text-[9px] font-medium text-zinc-400 select-none overflow-hidden">
              {(() => {
                const totalItems = serie.length;
                return serie.map((d, index) => {
                  const hide = totalItems > 6 && index % 2 !== 0 && index !== totalItems - 1;
                  return (
                    <span key={index} className={`text-center ${hide ? 'hidden sm:inline-block' : 'inline-block'}`}>
                      {rotuloX(d.data)}
                    </span>
                  );
                });
              })()}
            </div>
          </div>
        )}

        {/* Legenda */}
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 pt-2 border-t border-white/10 text-[11px] text-zinc-400 select-none">
          {(filtro === null || filtro === 'faturamento') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CORES.faturamento }} />
              Faturamento
            </div>
          )}
          {(filtro === null || filtro === 'saques') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CORES.saques }} />
              Saques
            </div>
          )}
          {(filtro === null || filtro === 'lucro') && (
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: CORES.lucro }} />
              Lucro
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
