'use client';

import React from 'react';
import { motion } from 'motion/react';
import { Play } from 'lucide-react';
import { StreamModal } from './StreamModal';

interface WatchStreamPanelProps {
  channel: string;
  isOpen: boolean;
  onOpenModal: () => void;
}

export function WatchStreamPanel({
  channel,
  isOpen,
  onOpenModal,
}: WatchStreamPanelProps) {
  return (
    <motion.div
      initial={{ x: 100, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 100, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="fixed right-4 bottom-4 md:right-8 md:bottom-8 z-40"
    >
      <button
        onClick={onOpenModal}
        className="flex items-center gap-3 px-4 py-3 rounded-xl font-black uppercase tracking-wider text-sm transition-all border-2 bg-blue-600/10 border-blue-500/30 text-blue-400 hover:bg-blue-600/20 hover:border-blue-500/50 animate-pulse"
      >
        <Play className="w-5 h-5" />
        <span className="hidden sm:inline">ASSISTIR LIVE</span>
        <span className="sm:hidden">🔴</span>
      </button>
    </motion.div>
  );
}
