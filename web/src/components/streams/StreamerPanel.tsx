'use client';

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Tv2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { usePerfilSafe } from '../../contexts/PerfilContext';

interface StreamerPanelProps {
  usuarioId: string;
  salaId: string;
  isTransmitting: boolean;
  onStatusChange?: (transmitting: boolean) => void;
}

export function StreamerPanel({
  usuarioId,
  salaId,
  isTransmitting,
  onStatusChange,
}: StreamerPanelProps) {
  const { perfil } = usePerfilSafe();
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleStream = async () => {
    if (!perfil || perfil.cargo !== 'streamer') return;
    setIsLoading(true);
    try {
      if (isTransmitting) {
        await supabase
          .from('sala_streams')
          .delete()
          .eq('sala_id', salaId)
          .eq('user_id', usuarioId);
        onStatusChange?.(false);
      } else {
        const { error } = await supabase
          .from('sala_streams')
          .insert({
            sala_id: salaId,
            user_id: usuarioId,
            twitch_channel: perfil.riotId || perfil.nome,
            ativo: true,
          });
        if (error) throw error;
        onStatusChange?.(true);
      }
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  if (!perfil || perfil.cargo !== 'streamer') return null;

  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed right-4 top-20 md:right-8 md:top-24 z-40"
    >
      <button
        onClick={handleToggleStream}
        disabled={isLoading}
        className={`flex items-center gap-3 px-4 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all border-2 ${
          isTransmitting
            ? 'bg-purple-600/40 border-purple-500 text-purple-200 hover:bg-purple-600/60'
            : 'bg-purple-600/10 border-purple-500/30 text-purple-400 hover:bg-purple-600/20 hover:border-purple-500/50'
        } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <Tv2 className="w-5 h-5" />
        <span className="hidden sm:inline">
          {isTransmitting ? '🔴 TRANSMITINDO' : '📹 TRANSMITIR'}
        </span>
        <span className="sm:hidden">
          {isTransmitting ? '🔴' : '📹'}
        </span>
      </button>
    </motion.div>
  );
}