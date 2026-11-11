import React from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';

export const CUT_FRAME = 'polygon(14px 0, 100% 0, 100% calc(100% - 14px), calc(100% - 14px) 100%, 0 100%, 0 14px)';
export const CUT_FRAME_INNER = 'polygon(13.8px 0, 100% 0, 100% calc(100% - 13.8px), calc(100% - 13.8px) 100%, 0 100%, 0 13.8px)';

export const ModalBase = ({ onClose, children, gradientFrom, title, transparent = false }: {
  onClose: () => void;
  children: React.ReactNode;
  gradientFrom?: string;
  title?: string;
  transparent?: boolean;
}) => (
  <motion.div
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    className={`fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-y-auto ${!transparent ? 'bg-black/80 backdrop-blur-md' : ''}`}
    onClick={onClose}
  >
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.15 }}
      className="relative w-full max-w-lg p-[1.5px] shadow-2xl max-h-[90vh] flex flex-col"
      style={{
        clipPath: CUT_FRAME,
        background: `linear-gradient(135deg, ${gradientFrom || '#FFB700'}, rgba(255,255,255,0.08) 100%)`,
        boxShadow: `0 0 50px -10px ${gradientFrom || '#FFB700'}40`
      }}
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      <div
        className="w-full h-full bg-[#08080a] relative overflow-y-auto custom-scrollbar flex flex-col"
        style={{ clipPath: CUT_FRAME_INNER }}
      >
        {title && (
          <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
            <h2 className="text-white font-black text-lg tracking-tight uppercase">{title}</h2>
            <button onClick={onClose} className="text-white/30 hover:text-white p-1 transition-colors cursor-pointer">
              <X className="w-5 h-5" />
            </button>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </motion.div>
  </motion.div>
);
