'use client';

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { StreamEmbed } from './StreamEmbed';

interface StreamModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: string;
  title?: string;
  viewerCount?: number;
}

export function StreamModal({
  isOpen,
  onClose,
  channel,
  title = 'Transmissão ao Vivo',
  viewerCount = 0,
}: StreamModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-black/90 rounded-2xl border border-primary/20 w-full max-w-4xl overflow-hidden"
          >
            <div className="flex items-center justify-between p-4 border-b border-primary/10">
              <div className="flex-1">
                <h2 className="text-xl font-bold text-white">{channel}</h2>
                <p className="text-sm text-on-surface-variant mt-1">
                  {title} • {viewerCount.toLocaleString()} espectadores
                </p>
              </div>
              <button onClick={onClose} className="text-on-surface-variant hover:text-white transition-colors p-2">
                <X size={24} />
              </button>
            </div>
            <div className="aspect-video bg-surface">
              <StreamEmbed channel={channel} className="w-full h-full" />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}