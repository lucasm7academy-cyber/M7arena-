'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, ShieldCheck, RefreshCw, X } from 'lucide-react';
import { useSound } from '@/hooks/useSound';
import { useSession } from 'next-auth/react';
import RecruitmentCard from '@/components/recrutamento/RecruitmentCard';
import {
  RECRUITMENT_ROLES,
  type Recrutamento,
  type RoleRecrutamento,
} from '@/types/recrutamento';

export default function RecrutamentoPage() {
  const { playSound } = useSound();
  const router = useRouter();
  const { data: session } = useSession();
  const user = session?.user;
  const userId = (user as any)?.id || user?.email || '';

  const [posts, setPosts] = useState<Recrutamento[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleRecrutamento | null>(null);

  const podePublicar = !!userId;

  const loadData = async (role: RoleRecrutamento | null = roleFilter) => {
    setLoading(true);
    try {
      const url = role ? `/api/recrutamento?role=${role}` : '/api/recrutamento';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredPosts = useMemo(() => {
    if (!search) return posts;
    const q = search.toLowerCase();
    return posts.filter(
      (p) =>
        p.time?.nome.toLowerCase().includes(q) ||
        p.role.toLowerCase().includes(q) ||
        p.descricao.toLowerCase().includes(q)
    );
  }, [posts, search]);

  return (
    <div className="min-h-screen text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* HERO BANNER */}
        <div className="relative bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-lg shadow-black/20">
          <div
            className="absolute inset-0 z-0 opacity-20 pointer-events-none"
            style={{
              backgroundImage:
                'radial-gradient(circle at 20% 20%, rgba(255,183,0,0.15) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,107,0,0.1) 0%, transparent 50%)',
            }}
          />

          <div className="relative z-10 p-8 md:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-3 max-w-2xl">
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase leading-none tracking-widest text-white font-headline">
                Recrutar <span className="text-primary">Talentos</span>
              </h1>
              <p className="text-white/60 text-sm md:text-base font-medium leading-relaxed">
                A plataforma oficial para times buscarem novos talentos.
              </p>
            </div>

            {podePublicar && (
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  playSound('click');
                }}
                className="shrink-0 flex items-center gap-2.5 bg-gradient-to-r from-primary to-[#E6A600] text-black px-5 py-3.5 rounded-xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 transition-all cursor-pointer font-headline"
              >
                <Plus size={18} strokeWidth={3} />
                Criar Vaga
              </motion.button>
            )}
          </div>
        </div>

        {/* BARRA DE FILTROS (sticky) */}
        <div className="sticky top-4 z-40 rounded-2xl bg-[#0a0b0f]/80 backdrop-blur-md border border-white/10 p-3 md:p-4 flex flex-col md:flex-row items-center gap-3 shadow-lg shadow-black/20">
          {/* Search */}
          <div className="flex-1 w-full bg-white/5 border border-white/10 rounded-xl flex items-center px-4 py-3 gap-3 focus-within:border-primary/50 focus-within:bg-white/[0.08] transition-all">
            <Search size={18} className="text-white/40 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por time ou vaga..."
              className="bg-transparent border-none outline-none text-sm text-white w-full placeholder:text-white/30 font-bold"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="text-white/40 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Role filters */}
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1 md:pb-0 w-full md:w-auto">
            <button
              onClick={() => {
                playSound('click');
                setRoleFilter(null);
              }}
              className={`shrink-0 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all cursor-pointer font-headline ${
                !roleFilter
                  ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                  : 'bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-white'
              }`}
            >
              Todos
            </button>
            {RECRUITMENT_ROLES.map((role) => (
              <button
                key={role.value}
                onClick={() => {
                  playSound('click');
                  setRoleFilter(role.value);
                }}
                className={`shrink-0 flex items-center gap-2 px-4 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest border transition-all cursor-pointer font-headline ${
                  roleFilter === role.value
                    ? 'bg-primary text-black border-primary shadow-lg shadow-primary/20'
                    : 'bg-white/5 text-white/60 border-white/10 hover:border-white/20 hover:bg-white/10 hover:text-white'
                }`}
              >
                <img
                  src={role.img}
                  alt={role.label}
                  className={`w-4 h-4 object-contain ${
                    roleFilter === role.value ? 'brightness-0' : 'opacity-60'
                  }`}
                />
                {role.label}
              </button>
            ))}

            {/* Refresh */}
            <button
              onClick={() => {
                playSound('click');
                loadData();
              }}
              disabled={loading}
              className="shrink-0 px-3 py-2.5 rounded-xl border border-white/10 bg-white/5 text-white/60 hover:border-white/20 hover:text-white transition-all disabled:opacity-50 cursor-pointer"
              title="Atualizar"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* GRID DE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <AnimatePresence mode="popLayout">
            {filteredPosts.length > 0 ? (
              filteredPosts.map((post, idx) => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, scale: 0.9, y: 30 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: idx * 0.04, type: 'spring', damping: 25 }}
                >
                  <RecruitmentCard
                    post={post}
                    myUserId={userId}
                    onClick={() => router.push(`/times/${post.time_id}`)}
                    onEdit={() => {}}
                    onDelete={() => {}}
                  />
                </motion.div>
              ))
            ) : (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="col-span-full py-32 flex flex-col items-center justify-center text-center bg-[#0a0b0f]/60 backdrop-blur-xl border border-dashed border-white/10 rounded-2xl"
              >
                <ShieldCheck size={64} className="text-white/20 mb-4" />
                <p className="text-white/70 text-lg font-black uppercase tracking-widest font-headline">
                  Nenhum recrutamento no radar.
                </p>
                <p className="text-white/40 text-sm mt-2 font-medium">
                  Ajuste seus filtros ou volte em breve.
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
