import React from 'react';
import { Swords } from 'lucide-react';
import type { ApiBetQueue } from '../../lib/api';

export interface FilaConfig {
  id: ApiBetQueue;
  label: string;
  sub: string;
  desc: string;
  tag: string;
  bg: string;
  accent: string;
}

interface FilaSelectorProps {
  filas: FilaConfig[];
  onSelect: (queue: ApiBetQueue) => void;
}

export const FilaSelector: React.FC<FilaSelectorProps> = ({ filas, onSelect }) => {
  return (
    <div className="flex-1">
      {/* Cabeçalho de Seleção */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-[#FFB700]/15 flex items-center justify-center">
            <Swords className="w-4 h-4 text-[#FFB700]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-black uppercase tracking-widest text-white">
              Escolha a Fila do Desafio
            </h2>
            <p className="text-[11px] text-white/40">
              Selecione o modo ranqueado que você jogará a seguir
            </p>
          </div>
        </div>
        <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-[#FFB700] bg-[#FFB700]/10 border border-[#FFB700]/30 rounded-lg shrink-0">
          Etapa 1 de 2
        </span>
      </div>

      <p className="text-xs text-white/50 mb-5 leading-relaxed">
        Escolha a fila da sua próxima partida para liberar seus objetivos. Desafie a si mesmo no Rift: Vitória, Derrota, abates e First Blood.
      </p>

      {/* Grid de Cards Altos de Fila */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {filas.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => onSelect(f.id)}
            className="relative rounded-2xl overflow-hidden cursor-pointer group transition-all duration-300 hover:scale-[1.02] border border-white/10 hover:border-white/25 hover:shadow-[0_0_30px_rgba(0,0,0,0.8)] text-left min-h-[300px] sm:min-h-[340px] flex flex-col justify-between p-6 sm:p-7"
          >
            {/* Imagem de Fundo com Zoom Suave */}
            <div
              className="absolute inset-0 bg-cover bg-center opacity-35 group-hover:opacity-50 transition-all duration-500 group-hover:scale-105"
              style={{ backgroundImage: `url(${f.bg})` }}
            />
            {/* Gradiente Escuro Protetor */}
            <div
              className="absolute inset-0 opacity-85 transition-opacity"
              style={{
                background: `linear-gradient(135deg, ${f.accent}2a 0%, rgba(10,10,14,0.75) 45%, #08080c 100%)`,
              }}
            />
            {/* Glow Radial no Hover */}
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-30 transition-opacity duration-500 pointer-events-none"
              style={{ background: `radial-gradient(circle at top right, ${f.accent} 0%, transparent 70%)` }}
            />

            {/* Header do Card com Badges */}
            <div className="relative z-10 w-full flex items-center justify-between gap-2">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-lg bg-black/70 border backdrop-blur-md"
                style={{ borderColor: `${f.accent}50`, color: f.accent }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: f.accent }} />
                {f.tag}
              </span>
              <div
                className="w-10 h-10 rounded-xl bg-black/60 border border-white/10 flex items-center justify-center backdrop-blur-md group-hover:scale-110 transition-transform"
                style={{ color: f.accent }}
              >
                <Swords className="w-5 h-5" />
              </div>
            </div>

            {/* Conteúdo Central e Inferior */}
            <div className="relative z-10 w-full mt-auto pt-6">
              <span className="text-[11px] font-black uppercase tracking-widest text-white/50 block mb-1">
                {f.sub}
              </span>
              <h3 className="text-white font-black text-2xl sm:text-3xl uppercase tracking-tight drop-shadow-md leading-none mb-2.5">
                {f.label}
              </h3>
              <p className="text-white/60 text-xs sm:text-sm font-medium leading-relaxed mb-5 line-clamp-2">
                {f.desc}
              </p>

              <div
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-black transition-all group-hover:shadow-lg group-hover:translate-x-0.5"
                style={{ background: f.accent }}
              >
                <span>Escolher esta fila</span>
                <span className="group-hover:translate-x-1 transition-transform">→</span>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default FilaSelector;
