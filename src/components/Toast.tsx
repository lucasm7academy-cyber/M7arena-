'use client';

import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Info, X } from 'lucide-react';

export interface ToastItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'error';
}

export function Toast({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`flex items-start gap-3 p-4 rounded-xl shadow-xl border backdrop-blur-md text-white min-w-[280px] max-w-md ${
        toast.type === 'success'
          ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-100'
          : toast.type === 'error'
          ? 'bg-rose-950/90 border-rose-500/40 text-rose-100'
          : 'bg-purple-950/90 border-purple-500/40 text-purple-100'
      }`}
    >
      {toast.type === 'success' ? (
        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
      ) : (
        <Info className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
      )}
      <div className="flex-1 min-w-0">
        <p className="font-bold text-sm leading-tight">{toast.title}</p>
        <p className="text-xs opacity-80 mt-1 leading-snug">{toast.message}</p>
      </div>
      <button onClick={() => onRemove(toast.id)} className="opacity-50 hover:opacity-100 p-1">
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}

export function ToastContainer({ toasts, onRemove }: { toasts: ToastItem[]; onRemove: (id: string) => void }) {
  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2.5 pointer-events-none">
      <AnimatePresence>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onRemove={onRemove} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
