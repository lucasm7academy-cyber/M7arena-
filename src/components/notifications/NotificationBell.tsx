'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Bell, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '@/hooks/useSound';
import { useSession } from 'next-auth/react';

export interface NotificationItem {
  id: string;
  type: 'join_request' | 'invite_received' | 'status_update';
  subtype?: 'aceito' | 'recusado';
  convite_id?: string;
  time_id?: string;
  team_name?: string;
  player_riot_id?: string;
  de_user_id?: string;
  role?: string;
  message?: string;
  criado_em?: string;
}

export default function NotificationBell() {
  const { data: session } = useSession();
  const user = session?.user;
  const { playSound } = useSound();

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [notificationCount, setNotificationCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Click outside para fechar o popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Carrega notificações (lazy loading ao clicar no sino)
  const carregarNotificacoes = async () => {
    if (!user || isLoading) return;
    setIsLoading(true);

    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
        setNotificationCount(0);
      }
    } catch {
      // Falha silenciosa
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleBell = async () => {
    playSound('click');
    if (!isOpen) {
      await carregarNotificacoes();
    }
    setIsOpen((prev) => !prev);
  };

  const handleAcceptInvite = async (notif: NotificationItem) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', notifId: notif.id, conviteId: notif.convite_id, timeId: notif.time_id, role: notif.role }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
        playSound('success');
        setTimeout(() => window.location.reload(), 700);
      }
    } catch {
      setErrorMsg('Erro ao aceitar convite.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleDeclineInvite = async (notif: NotificationItem) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', notifId: notif.id, conviteId: notif.convite_id }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      playSound('click');
    } catch {
      // Falha silenciosa
    }
  };

  const handleAcceptRequest = async (notif: NotificationItem) => {
    try {
      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'accept', notifId: notif.id, conviteId: notif.convite_id, timeId: notif.time_id, role: notif.role }),
      });
      if (res.ok) {
        setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
        playSound('success');
        setTimeout(() => window.location.reload(), 700);
      }
    } catch {
      setErrorMsg('Erro ao aceitar solicitação.');
      setTimeout(() => setErrorMsg(null), 4000);
    }
  };

  const handleDeclineRequest = async (notif: NotificationItem) => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'decline', notifId: notif.id, conviteId: notif.convite_id }),
      });
      setNotifications((prev) => prev.filter((n) => n.id !== notif.id));
      playSound('click');
    } catch {
      // Falha silenciosa
    }
  };

  const handleClearAll = async () => {
    try {
      await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear_all' }),
      });
      setNotifications([]);
    } catch {
      // Falha silenciosa
    }
  };

  if (!user) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={handleToggleBell}
        className="relative h-10 w-10 md:h-12 md:w-12 flex items-center justify-center rounded-xl hover:bg-white/5 transition-all md:h-auto md:w-auto md:p-2 group"
      >
        <div className="absolute inset-0 bg-primary/10 blur-lg rounded-full group-hover:bg-primary/20 transition-all" />
        <Bell
          className={`w-5 h-5 md:w-5 md:h-5 relative z-10 ${
            notificationCount > 0 ? 'text-primary' : 'text-white/60'
          } group-hover:text-primary transition-colors drop-shadow-[0_0_8px_rgba(255,215,0,0.3)]`}
        />
        {notificationCount > 0 && (
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
            {/* Header */}
            <div className="sticky top-0 bg-[#0a0b0f] border-b border-white/10 p-4 flex items-center justify-between">
              <h3 className="text-white font-black uppercase tracking-widest text-sm">Notificações</h3>
              {notifications.length > 0 && (
                <button
                  onClick={handleClearAll}
                  className="text-[0.75rem] text-white/40 hover:text-white/80 transition-colors font-bold uppercase"
                >
                  Limpar
                </button>
              )}
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-80 space-y-2 p-3">
              {isLoading ? (
                <div className="text-center py-8 text-white/40 text-sm">Carregando...</div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-8 text-white/40 text-sm">Sem notificações</div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    className="p-3 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                  >
                    {notif.type === 'join_request' && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <Users className="w-4 h-4 text-yellow-400" />
                          <p className="text-xs font-bold text-white/60 uppercase">Solicitação de entrada</p>
                        </div>
                        <p className="text-sm text-white mb-2">
                          <span className="font-black">{notif.player_riot_id}</span> quer entrar em{' '}
                          <span className="text-primary">{notif.team_name}</span> como{' '}
                          <span className="text-yellow-400">{notif.role}</span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptRequest(notif)}
                            className="flex-1 px-3 py-1.5 bg-green-500/20 border border-green-500/40 text-green-400 rounded-lg text-xs font-bold hover:bg-green-500/30 transition-all"
                          >
                            Aceitar
                          </button>
                          <button
                            onClick={() => handleDeclineRequest(notif)}
                            className="flex-1 px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-all"
                          >
                            Recusar
                          </button>
                        </div>
                      </>
                    )}

                    {notif.type === 'invite_received' && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <CheckCircle2 className="w-4 h-4 text-blue-400" />
                          <p className="text-xs font-bold text-white/60 uppercase">Convite de time</p>
                        </div>
                        <p className="text-sm text-white mb-2">
                          Você foi convidado para <span className="text-primary font-black">{notif.team_name}</span> como{' '}
                          <span className="text-blue-400">{notif.role}</span>
                        </p>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAcceptInvite(notif)}
                            className="flex-1 px-3 py-1.5 bg-green-500/20 border border-green-500/40 text-green-400 rounded-lg text-xs font-bold hover:bg-green-500/30 transition-all"
                          >
                            Aceitar
                          </button>
                          <button
                            onClick={() => handleDeclineInvite(notif)}
                            className="flex-1 px-3 py-1.5 bg-red-500/20 border border-red-500/40 text-red-400 rounded-lg text-xs font-bold hover:bg-red-500/30 transition-all"
                          >
                            Recusar
                          </button>
                        </div>
                      </>
                    )}

                    {notif.type === 'status_update' && (
                      <>
                        <div className="flex items-center gap-2 mb-2">
                          <AlertCircle
                            className={`w-4 h-4 ${
                              notif.subtype === 'aceito' ? 'text-green-400' : 'text-red-400'
                            }`}
                          />
                          <p className="text-xs font-bold text-white/60 uppercase">
                            {notif.subtype === 'aceito' ? 'Convite aceito' : 'Convite recusado'}
                          </p>
                        </div>
                        <p className="text-sm text-white">
                          <span className="font-black">{notif.player_riot_id}</span>{' '}
                          {notif.subtype === 'aceito' ? 'aceitou seu convite' : 'recusou seu convite'} para{' '}
                          <span className="text-primary">{notif.team_name}</span>
                        </p>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Error message */}
            {errorMsg && (
              <div className="border-t border-white/10 bg-red-500/10 text-red-300 text-xs p-3 text-center">
                {errorMsg}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
