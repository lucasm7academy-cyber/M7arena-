import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';

interface ToastProps {
  id: string;
  title: string;
  message: string;
  type?: 'success' | 'error' | 'info';
  onClose: (id: string) => void;
  duration?: number;
}

export const Toast: React.FC<ToastProps> = ({
  id,
  title,
  message,
  type = 'info',
  onClose,
  duration = 5000,
}) => {
  React.useEffect(() => {
    const timer = setTimeout(() => onClose(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onClose]);

  const bgColor = {
    success: 'bg-green-500/20 border-green-500/50',
    error: 'bg-red-500/20 border-red-500/50',
    info: 'bg-purple-500/20 border-purple-500/50',
  }[type];

  const titleColor = {
    success: 'text-green-400',
    error: 'text-red-400',
    info: 'text-purple-400',
  }[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      exit={{ opacity: 0, y: 20, x: 20 }}
      className={`fixed bottom-6 right-6 max-w-sm p-4 rounded-xl border ${bgColor} backdrop-blur-sm shadow-xl z-[999]`}
    >
      <div className="flex justify-between items-start gap-3">
        <div className="flex-1">
          <h4 className={`font-bold ${titleColor}`}>{title}</h4>
          <p className="text-white/80 text-sm mt-1">{message}</p>
        </div>
        <button
          onClick={() => onClose(id)}
          className="text-white/50 hover:text-white transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </motion.div>
  );
};

interface ToastContainerProps {
  toasts: ToastProps[];
  onRemove: (id: string) => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({ toasts, onRemove }) => {
  return (
    <AnimatePresence>
      {toasts.map((toast) => (
        <Toast key={toast.id} {...toast} onClose={onRemove} />
      ))}
    </AnimatePresence>
  );
};
