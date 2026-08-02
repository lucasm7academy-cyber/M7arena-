'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import {
  Trophy,
  Headset,
  LogOut,
  User as UserIcon,
  Users,
  Link as LinkIcon,
  ShieldCheck,
  Menu,
  X,
  ChevronDown,
  UserPlus,
  UserCircle,
  LogIn,
} from 'lucide-react';
import { FaTwitch, FaDiscord } from 'react-icons/fa6';
import { SiLeagueoflegends } from 'react-icons/si';
import { FaFontAwesomeFlag } from 'react-icons/fa';
import { motion, AnimatePresence } from 'framer-motion';
import { useSound } from '@/hooks/useSound';
import { usePerfil } from '@/contexts/PerfilContext';
import NotificationBell from '@/components/notifications/NotificationBell';

// Link de convite do servidor Discord da M7
const DISCORD_URL = 'https://discord.gg/E5crDcKqnt';

// Link do chat de tickets de suporte no Discord
const SUPORTE_URL = 'https://discord.gg/kz6p2zAvfc';

// No site atual esta imagem vinha do Storage do Supabase; aqui é servida do próprio app.
const LOGO_URL = '/images/logo-m7.png';

const AVATAR_FALLBACK =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23121212' width='100' height='100'/%3E%3Ccircle cx='50' cy='38' r='18' fill='%23444'/%3E%3Cellipse cx='50' cy='78' rx='30' ry='20' fill='%23444'/%3E%3C/svg%3E";

export default function Layout({ children }: { children: React.ReactNode }) {
  const { data: session, status } = useSession();
  const user = session?.user;
  const authLoading = status === 'loading';

  const { perfil } = usePerfil();
  const router = useRouter();
  const pathname = usePathname() || '';

  const isSalaPage = pathname.startsWith('/sala/') || pathname.startsWith('/sala-mod1/');
  const isDraftPage = pathname.startsWith('/draft/');
  const isGamePage = isSalaPage || isDraftPage;
  const { playSound } = useSound();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isGamePage);
  const [isVipModalOpen, setIsVipModalOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // No modelo novo a conta do jogo vive em gameAccounts, não numa flag do perfil.
  const contaVinculada = (perfil?.gameAccounts?.length ?? 0) > 0;
  const avatar = perfil?.avatarUrl || user?.image || AVATAR_FALLBACK;
  const nomeExibicao =
    perfil?.riotId?.split('#')[0] || perfil?.displayName || user?.email?.split('@')[0] || 'Jogador';

  const navigateWithSound = (path: string) => {
    playSound('click');
    router.push(path);
  };

  const handleLogoutWithSound = async () => {
    playSound('click');
    await signOut({ callbackUrl: '/lobby' });
  };

  // Fechar sidebar ao entrar em página de jogo
  useEffect(() => {
    setIsSidebarOpen(!isGamePage);
  }, [isGamePage]);

  // Fechar dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navItems = [
    { label: 'Início', icon: SiLeagueoflegends, path: '/lobby' },
    { label: 'Campeonatos', icon: Trophy, path: '/campeonatos' },
    { label: 'Times', icon: FaFontAwesomeFlag, path: '/times' },
    { label: 'Jogadores', icon: UserIcon, path: '/players' },
    { label: 'LIVES', icon: FaTwitch, path: '/streamers' },
    { label: 'Recrutamento', icon: UserPlus, path: '/recrutamento' },
    { label: 'Quem somos?', icon: UserCircle, path: '/quem-somos' },
  ];

  const profileMenuItems = [
    { label: 'Minha conta', icon: UserIcon, path: '/perfil' },
    { label: 'Equipes', icon: Users, path: '/times' },
    { label: 'Vincular conta', icon: LinkIcon, path: '/vincular' },
    { label: 'Políticas', icon: ShieldCheck, path: '/politicas' },
  ];

  const sidebarWidths = isGamePage
    ? `${isSidebarOpen ? 'w-[220px] xl:w-[240px] 2xl:w-[200px] flex' : 'w-0 !hidden'} shrink-0 transition-all duration-300 ease-out overflow-hidden`
    : 'hidden lg:flex lg:w-[220px] xl:w-[240px] 2xl:w-[200px] shrink-0';

  // Loading inicial
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#050506] flex items-center justify-center">
        <div className="animate-pulse text-primary">Carregando...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050506]">
      {/* Header */}
      <header className="bg-black/60 backdrop-blur-sm fixed top-0 z-50 w-full h-[68px] md:h-16 border-b border-primary shadow-lg">
        <div className="absolute bottom-0 left-0 w-full h-0 bg-primary shadow-[0_0_10px_rgba(255,255,0,0.5)] z-50"></div>

        <div className="flex justify-between items-center h-full px-3.5 md:px-6">
          <div className="flex items-center gap-2 md:gap-4">
            <button
              className={`text-white/80 hover:text-primary transition-colors h-14 w-14 md:h-16 md:w-16 flex items-center justify-center rounded-xl hover:bg-white/5 lg:h-auto lg:w-auto lg:p-2 lg:rounded-lg ${isGamePage ? '' : 'lg:hidden'}`}
              onClick={() => {
                playSound('click');
                if (isGamePage) {
                  setIsSidebarOpen(!isSidebarOpen);
                } else {
                  setIsMobileMenuOpen(!isMobileMenuOpen);
                }
              }}
            >
              <Menu className="w-6 h-6 md:w-6 md:h-6" />
            </button>

            <Link
              href="/lobby"
              onClick={() => playSound('click')}
              className="lg:hidden flex items-center hover:opacity-90 transition-all"
            >
              <img
                alt="M7 Academy Logo"
                className="h-10 md:h-14 w-auto object-contain drop-shadow-[0_0_2px_#FFFF00] drop-shadow-[0_0_5px_#FFFF00] drop-shadow-[0_0_10px_rgba(255,255,0,0.4)]"
                src={LOGO_URL}
              />
            </Link>

            <Link
              href="/lobby"
              onClick={() => playSound('click')}
              className="hidden lg:flex items-center gap-2 xl:gap-3 hover:opacity-90 transition-all group"
            >
              <div className="relative">
                <img
                  alt="M7 Academy Logo"
                  className="h-8 xl:h-10 w-auto object-contain relative z-10 drop-shadow-[0_0_2px_#FFFF00] drop-shadow-[0_0_5px_#FFFF00] drop-shadow-[0_0_10px_rgba(255,255,0,0.4)]"
                  src={LOGO_URL}
                />
              </div>
              <div className="flex flex-col">
                <h1 className="text-sm xl:text-base font-black tracking-tighter text-primary uppercase font-arial-bold italic leading-tight">
                  M7 ACADEMY
                </h1>
                <span className="text-[6px] xl:text-[8px] text-white/40 tracking-[0.2em] xl:tracking-[0.3em] uppercase">
                  jogue e divirta-se!
                </span>
              </div>
            </Link>

            <div className="hidden xl:flex items-center gap-3 ml-2">
              <div className="w-[1px] h-5 bg-white/20"></div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  {!user ? (
                    <h2 className="font-body text-sm font-light tracking-wide">
                      <span className="text-primary font-semibold">Bem-vindo,</span>
                      <span className="text-white/80 ml-1">Visitante</span>
                    </h2>
                  ) : !perfil ? (
                    <div className="h-4 w-36 bg-white/10 rounded animate-pulse" />
                  ) : (
                    <h2 className="font-body text-sm font-light tracking-wide">
                      <span className="text-primary font-semibold">Bem-vindo,</span>
                      <span className="text-white/80 ml-1">{nomeExibicao}</span>
                    </h2>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3 lg:gap-5">
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => playSound('click')}
              className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-primary to-[#E6A600] text-black font-black text-[10px] sm:text-[11px] uppercase tracking-wider hover:brightness-110 transition-all active:scale-95 shadow-lg shadow-primary/20 md:px-3 md:py-1.5 md:rounded-full md:gap-1.5"
            >
              <FaDiscord className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" />
              <span>Discord</span>
            </a>

            {!user && (
              <Link
                href="/login"
                onClick={() => playSound('click')}
                className="flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-xl bg-gradient-to-r from-[#00C35A] to-[#008F39] text-white font-black text-[10px] sm:text-[11px] uppercase tracking-wider hover:brightness-110 transition-all active:scale-95 shadow-[0_0_15px_rgba(0,195,90,0.4)] md:px-3 md:py-1.5 md:rounded-full md:gap-1.5"
              >
                <LogIn className="w-3.5 h-3.5 md:w-3.5 md:h-3.5" />
                <span>Entrar</span>
              </Link>
            )}

            <NotificationBell />

            {user && (
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="relative group flex items-center justify-center h-10 w-10 md:h-12 md:w-12 rounded-xl hover:bg-white/5 transition-all md:h-auto md:w-auto md:flex md:items-center md:gap-1.5 md:p-1 md:rounded-xl"
                >
                  <div className="relative">
                    <div className="relative w-7 h-7 sm:w-8 sm:h-8 md:w-8 md:h-8 lg:w-9 lg:h-9 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_10px_rgba(255,255,0,0.3)]">
                      {!perfil ? (
                        <div className="w-full h-full bg-white/10 animate-pulse" />
                      ) : (
                        <img alt="Avatar" className="w-full h-full object-cover" src={avatar} />
                      )}
                    </div>
                  </div>
                  {/* SETA PARA BAIXO */}
                  <ChevronDown className="hidden md:block text-white/40 w-3 h-3 md:w-3 md:h-3 lg:w-3.5 lg:h-3.5 group-hover:text-primary transition-colors" />
                </button>

                {/* Dropdown Menu */}
                <AnimatePresence>
                  {isProfileOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute right-0 mt-2 w-72 bg-[#0a0b0f]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden z-[60]"
                    >
                      <div className="flex flex-col items-center pt-6 pb-4 px-4">
                        <div className="w-16 h-16 rounded-full border-2 border-primary overflow-hidden">
                          <img src={avatar} className="w-full h-full object-cover" alt="" />
                        </div>
                        <h2 className="text-white font-bold text-base mt-3">
                          {perfil?.riotId || user?.email?.split('@')[0] || 'Jogador'}
                        </h2>
                      </div>

                      <div className="px-3 pb-5 space-y-1">
                        {profileMenuItems.map((item) => (
                          <button
                            key={item.label}
                            onClick={() => {
                              navigateWithSound(item.path);
                              setIsProfileOpen(false);
                            }}
                            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-white/70 hover:text-primary hover:bg-white/5 transition-all"
                          >
                            <item.icon className="w-4 h-4" />
                            <span className="text-sm">{item.label}</span>
                          </button>
                        ))}
                        <div className="h-px bg-white/10 my-2"></div>
                        <button
                          onClick={handleLogoutWithSound}
                          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-red-400/80 hover:text-red-400 hover:bg-red-500/10 transition-all"
                        >
                          <LogOut className="w-4 h-4" />
                          <span className="text-sm">Sair</span>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex h-full pt-[68px] md:pt-16">
        {/* Sidebar Desktop */}
        <aside
          translate="no"
          className={`notranslate ${sidebarWidths} ${isGamePage ? (isSidebarOpen ? 'flex' : '!hidden') : 'hidden lg:flex'} bg-[#050505]/90 backdrop-blur-md border-r border-primary/40 flex-col z-[50] h-[calc(100vh-68px)] md:h-[calc(100vh-4rem)] sticky top-[68px] md:top-16 overflow-visible relative`}
        >
          <div className="absolute top-0 right-0 w-0 h-full bg-primary shadow-[-10px_0_15px_rgba(255,183,0,0.4)] z-50"></div>
          <div className="py-6 px-3 relative z-[60]">
            {contaVinculada ? (
              <Link
                href="/perfil"
                onClick={() => playSound('click')}
                className="flex flex-col items-center group/profile cursor-pointer"
              >
                <div className="relative mb-3 md:mb-4">
                  <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-full overflow-hidden border-[3px] border-primary shadow-[0_0_12px_rgba(255,183,0,0.3)] bg-[#050505] transition-all">
                    <img
                      alt="User Profile Avatar"
                      className="w-full h-full object-cover transition-transform duration-500 group-hover/profile:scale-110"
                      src={avatar}
                      onError={(e) => {
                        e.currentTarget.src = AVATAR_FALLBACK;
                      }}
                    />
                  </div>
                </div>
                <h3 className="text-white font-headline font-bold text-xs text-center transition-colors truncate max-w-full px-2">
                  {perfil?.riotId || user?.email?.split('@')[0] || 'Jogador'}
                </h3>
              </Link>
            ) : (
              <>
                {/* BALÃO DO PORO ANIMADO */}
                {perfil && (
                  <motion.div
                    initial={{ opacity: 0, x: -20, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      x: [0, -6, 0, -6, 0],
                      scale: 1,
                    }}
                    transition={{
                      x: {
                        duration: 2.5,
                        repeat: Infinity,
                        ease: 'easeInOut',
                      },
                      opacity: { duration: 0.3 },
                      scale: { duration: 0.3 },
                    }}
                    className="absolute top-4 -right-64 w-56 z-[60]"
                  >
                    <div className="bg-[#1a1b23] border-2 border-primary/50 rounded-2xl p-3 shadow-[0_0_30px_rgba(255,255,0,0.25)] relative">
                      <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-4 h-4 bg-[#1a1b23] border-l-2 border-t-2 border-primary/50 -rotate-45 z-0"></div>
                      <div className="flex items-center gap-3 relative z-10">
                        <motion.img
                          src="/images/poro1.png"
                          alt="Poro"
                          className="w-14 h-14 object-contain shrink-0"
                          animate={{
                            scale: [1, 1.2, 1, 1.2, 1],
                          }}
                          transition={{
                            duration: 2,
                            times: [0, 0.15, 0.3, 0.45, 0.6],
                            repeat: Infinity,
                            ease: 'easeInOut',
                          }}
                        />
                        <div className="text-left">
                          <p
                            className="text-[11px] font-black uppercase tracking-tighter text-white leading-tight"
                            style={{
                              textShadow:
                                '1px 1px 0 #000, -1px 1px 0 #000, 1px -1px 0 #000, -1px -1px 0 #000',
                            }}
                          >
                            Ei, você ainda não
                            <br />
                            vinculou sua conta!
                          </p>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Botão Vincular Conta */}
                <Link href="/vincular" onClick={() => playSound('click')} className="block w-full">
                  <div className="bg-primary hover:bg-yellow-500 text-black text-[10px] font-black uppercase tracking-[0.15em] py-5 px-3 rounded-xl text-center transition-all flex flex-col items-center justify-center gap-2 border-b-4 border-black/20">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="w-4 h-4" />
                      <span className="leading-tight">Vincular Conta</span>
                    </div>
                  </div>
                </Link>
              </>
            )}
          </div>

          {/* NAVEGAÇÃO - Menu da Sidebar */}
          <div className="flex-1 overflow-y-auto px-2 custom-scrollbar">
            <nav className="space-y-1">
              {navItems.map((item) => {
                const isActive = pathname === item.path;
                return (
                  <button
                    key={item.label}
                    onClick={() => navigateWithSound(item.path)}
                    className={`group relative flex items-center gap-3 px-3 py-2.5 rounded-r-sm font-headline font-bold text-sm uppercase tracking-wider transition-all duration-100 w-full ${
                      isActive
                        ? 'text-primary bg-primary/20 shadow-lg shadow-primary/5'
                        : 'text-white/50 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute left-0 w-1 h-8 bg-primary rounded"
                        transition={{ type: 'spring', duration: 0.3, bounce: 0.2 }}
                      />
                    )}
                    <item.icon
                      className={`w-4 h-4 transition-all ${isActive ? 'text-primary' : 'group-hover:text-primary'}`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* BOTÕES INFERIORES */}
          <div className="px-3 py-6 space-y-3 border-t border-white/5">
            <button
              onClick={() => {
                playSound('click');
                setIsVipModalOpen(true);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-primary to-[#E6A600] text-black rounded-xl font-headline text-[10px] uppercase tracking-[0.2em] font-black hover:brightness-110 transition-all shadow-lg shadow-primary/20"
            >
              TORNE-SE VIP
            </button>
            <button
              onClick={() => {
                playSound('click');
                window.open(SUPORTE_URL, '_blank', 'noopener,noreferrer');
              }}
              className="flex items-center justify-center gap-2 text-white/40 hover:text-primary py-2 text-[10px] uppercase tracking-widest font-headline transition-colors w-full"
            >
              <Headset className="w-3.5 h-3.5" />
              <span>Suporte</span>
            </button>
          </div>
        </aside>

        {/* Mobile Menu Overlay */}
        <AnimatePresence>
          {isMobileMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.1 }}
                className="fixed inset-0 bg-black/80 backdrop-blur-md z-[55] lg:hidden"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <motion.aside
                translate="no"
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 300 }}
                className="notranslate fixed inset-y-0 left-0 w-72 sm:w-80 bg-[#050505] border-r border-white/10 z-[60] py-6 flex flex-col lg:hidden shadow-2xl"
              >
                <div className="px-6 mb-6 flex justify-between items-center">
                  <div className="flex items-center gap-2.5">
                    <img alt="Logo" className="h-9 w-auto" src={LOGO_URL} />
                    <div>
                      <h1 className="text-base font-black text-primary font-headline italic leading-tight">
                        M7 ACADEMY
                      </h1>
                      <p className="text-[9px] text-white/40 tracking-wider">jogue e divirta-se!</p>
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      playSound('click');
                      setIsMobileMenuOpen(false);
                    }}
                    className="text-white/70 hover:text-primary p-2 rounded-lg hover:bg-white/5"
                  >
                    <X size={20} />
                  </button>
                </div>

                {contaVinculada && (
                  <div className="px-6 mb-6 pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3.5">
                      <div className="w-14 h-14 rounded-full overflow-hidden border-2 border-primary shadow-[0_0_10px_rgba(255,183,0,0.2)]">
                        <img src={avatar} className="w-full h-full object-cover" alt="" />
                      </div>
                      <div>
                        <p className="text-white font-black text-base leading-tight">
                          {perfil?.riotId || user?.email?.split('@')[0] || 'Jogador'}
                        </p>
                        <p className="text-primary text-[11px] font-black tracking-widest uppercase mt-0.5">
                          {perfil?.eloPrincipal && perfil.eloPrincipal !== 'Sem Elo'
                            ? perfil.eloPrincipal
                            : 'SEM RANQUEADA'}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                {user && perfil && !contaVinculada && (
                  <div className="px-6 mb-6">
                    <Link
                      href="/vincular"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        playSound('click');
                      }}
                    >
                      <motion.div
                        animate={{
                          y: [0, 2, 0],
                          boxShadow: [
                            '0 4px 0 0 rgba(0,0,0,0.3)',
                            '0 1px 0 0 rgba(0,0,0,0.3)',
                            '0 4px 0 0 rgba(0,0,0,0.3)',
                          ],
                        }}
                        transition={{
                          duration: 1.5,
                          repeat: Infinity,
                          ease: 'easeInOut',
                        }}
                        className="bg-primary text-black text-xs font-bold py-3.5 rounded-xl text-center relative z-10 border-b-4 border-black/20"
                      >
                        Vincular Conta Riot
                      </motion.div>
                    </Link>
                  </div>
                )}

                <nav className="flex-1 px-4 space-y-1.5">
                  {navItems.map((item) => (
                    <button
                      key={item.label}
                      onClick={() => {
                        playSound('click');
                        navigateWithSound(item.path);
                        setIsMobileMenuOpen(false);
                      }}
                      className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-headline text-[15px] uppercase tracking-wider transition-all text-left ${
                        pathname === item.path
                          ? 'text-primary bg-primary/10 font-black shadow-[0_0_15px_rgba(255,183,0,0.05)]'
                          : 'text-white/70 hover:text-white hover:bg-white/5 font-bold'
                      }`}
                    >
                      <item.icon
                        className={`w-5 h-5 transition-transform group-hover:scale-110 ${pathname === item.path ? 'text-primary' : 'text-white/60'}`}
                      />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </nav>

                <div className="px-6 mt-auto pt-6 border-t border-white/10">
                  <button
                    onClick={() => {
                      playSound('click');
                      setIsVipModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full py-3.5 bg-gradient-to-r from-primary to-[#E6A600] text-black rounded-xl font-headline text-xs uppercase tracking-widest font-black hover:brightness-110 active:scale-[0.98] transition-all shadow-lg shadow-primary/10"
                  >
                    TORNE-SE VIP
                  </button>
                  <button
                    onClick={() => {
                      playSound('click');
                      window.open(SUPORTE_URL, '_blank', 'noopener,noreferrer');
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center justify-center gap-2.5 text-white/40 hover:text-primary py-3.5 mt-2 text-xs uppercase tracking-widest font-headline font-bold transition-colors"
                  >
                    <Headset className="w-5 h-5" />
                    <span>Suporte</span>
                  </button>
                </div>
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main className="flex-1 relative overflow-y-auto h-[calc(100vh-68px)] md:h-[calc(100vh-4rem)]">
          <div className="min-h-full flex flex-col p-0">{children}</div>
        </main>
      </div>

      {/* VipModal entra aqui — componente próprio (app.port.carteira), ainda pendente.
          O estado isVipModalOpen já está ligado ao botão para não precisar mexer aqui depois. */}
      {isVipModalOpen && null}
    </div>
  );
}
