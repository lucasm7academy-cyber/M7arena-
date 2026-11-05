import React, { useState, useRef, useEffect } from 'react';
import { Bell, AlertCircle, Trophy, TrendingDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'motion/react';
import { useSound } from '../../hooks/useSound';
import { playNotificationSound } from '../../lib/notification-sound';

type BetNotification = {
  id: string;
  type: string;
  title: string;
  message: string;
  payload?: Record<string, any>;
  read: boolean;
  createdAt: string;
};

/**
 * Sino de notificações. A simplificação removeu convites/solicitações de time
 * (B03); restam as notificações persistentes de apostas individuais.
 */
export default function NotificationBell() {
  const { user } = useAuth();
  const { playSound } = useSound();
  const [notifications, setNotifications] = useState<BetNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const carregarNotificacoes = async () => {
    if (!user || isLoading) return;
    setIsLoading(true);
    try {
      const data = await api.notifications.list();
      setNotifications((data.notifications ?? []) as BetNotification[]);
      setUnread(data.unreadCount ?? 0);

      if ((data.unreadCount ?? 0) > 0) {
        playNotificationSound();
        api.notifications.markAllRead().catch(() => {});
        setUnread(0);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erro ao carregar notificações.');
      setTimeout(() => setErrorMsg(null), 4000);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggleBell = async () => {
    playSound('click');
    if (!isOpen) await carregarNotificacoes();
    setIsOpen((prev) => !prev);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggleBell}
        className="relative h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all md:h-auto md:w-auto md:p-2 group"
      >
        <div className="absolute inset-0 bg-primary/10 blur-lg rounded-full group-hover:bg-primary/20 transition-all" />
        <Bell className={`w-5 h-5 md:w-5 md:h-5 relative z-10 ${unread > 0 ? 'text-primary' : 'text-white/60'} group-hover:text-primary transition-colors drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]`} />
        {unread > 0 && (
          <span className="absolute top-2 right-2 md:top-1 md:right-1 w-2.5 h-2.5 md:w-2.5 md:h-2.5 bg-red-500 rounded-full border-2 border-[#0a0b0f] animate-pulse z-20 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            className="absolute right-0 mt-2 w-96 max-h-96 bg-[#0a0b0f] border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-50"
          >
            <div className="sticky top-0 bg-[#0a0b0f] border-b border-white/10 p-4 flex items-center justify-between">
              <h3 className="text-white font-black uppercase tracking-widest text-sm">Notificações</h3>
              {notifications.length > 0 && (
                <button
                  onClick={() => { setNotifications([]); setUnread(0); }}
                  className="text-[0.75rem] text-white/40 hover:text-white/80 transition-colors font-bold uppercase"
                >
                  Limpar
                </button>
              )}
            </div>

            <div className="overflow-y-auto max-h-80 space-y-2 p-3">
              {isLoading ? (
                <div className="text-center py-8 text-white/40 text-sm">Carregando...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">Sem notificações</div>
              ) : (
                notifications.map((notif) => {
                  const delta = Number(notif.payload?.delta ?? 0);
                  const Icon = delta > 0 ? Trophy : delta < 0 ? TrendingDown : AlertCircle;
                  const color = delta > 0 ? 'text-green-400' : delta < 0 ? 'text-red-400' : 'text-zinc-400';
                  return (
                    <div key={notif.id} className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all">
                      <div className="flex items-center gap-2 mb-2">
                        <Icon className={`w-4 h-4 ${color}`} />
                        <p className="text-xs font-bold text-white/60 uppercase">{notif.title}</p>
                      </div>
                      <p className="text-sm text-white">{notif.message}</p>
                    </div>
                  );
                })
              )}
            </div>

            {errorMsg && (
              <div className="border-t border-white/10 bg-red-500/10 text-red-300 text-xs p-3 text-center">{errorMsg}</div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
